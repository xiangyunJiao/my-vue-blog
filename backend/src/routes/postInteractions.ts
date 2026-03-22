import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import sanitizeHtml from 'sanitize-html';
import { getDb } from '../db';
import type { SqlRow, WrappedDatabase } from '../db/types';
import { HttpError } from '../lib/errors';
import { getVisitorIdFromReq } from '../lib/visitor';
import { getHintForPostOnly } from '../lib/getMethodHint';
import { resError } from '../lib/httpJson';
import { payload, registerJsonRoute } from '../lib/apiRoute';

const router = Router();

function paramSlug(req: { params: { slug?: string | string[] } }): string {
  const s = req.params.slug;
  return Array.isArray(s) ? String(s[0] ?? '') : String(s ?? '');
}

const commentPostLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    resError(res, 429, '留言过于频繁，请稍后再试');
  },
});

const likePostLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    resError(res, 429, '操作过于频繁，请稍后再试');
  },
});

function parsePageLimit(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(query.limit || '50'), 10) || 50));
  return { page, limit, offset: (page - 1) * limit };
}

function getPublishedPostBySlug(db: WrappedDatabase, slug: string): SqlRow | null {
  return db
    .prepare('SELECT id, slug FROM posts WHERE slug = ? AND status = ?')
    .get(slug, 'published') as SqlRow | null;
}

/** 站点设置「作者昵称」，用于已登录博主回复留言时展示身份 */
function getSiteAuthorDisplayName(db: WrappedDatabase): string {
  const nameRow = db.prepare(`SELECT value FROM site_settings WHERE key = 'author_name'`).get() as
    | { value: string }
    | undefined;
  const raw = String(nameRow?.value ?? '').trim();
  if (raw) return raw.slice(0, 64);
  const titleRow = db.prepare(`SELECT value FROM site_settings WHERE key = 'site_title'`).get() as
    | { value: string }
    | undefined;
  const t = String(titleRow?.value ?? '').trim();
  if (t) return t.slice(0, 64);
  return '博主';
}

/** GET /posts/:slug/comments */
registerJsonRoute(router, 'get', '/posts/:slug/comments', async (ctx) => {
  const slug = paramSlug(ctx.req);
  const db = await getDb();
  const post = getPublishedPostBySlug(db, slug);
  if (!post) throw new HttpError(404, '文章不存在');

  const { page, limit, offset } = parsePageLimit(ctx.query);
  const countRow = db
    .prepare(`SELECT COUNT(*) AS c FROM comments WHERE post_id = ? AND status = 'approved'`)
    .get(post.id) as { c: number } | null;
  const total = countRow?.c ?? 0;

  const rows = db
    .prepare(
      `SELECT c.id, c.author_name, c.body, c.created_at, c.parent_id,
          par.author_name AS parent_author_name
       FROM comments c
       LEFT JOIN comments par ON par.id = c.parent_id
       WHERE c.post_id = ? AND c.status = 'approved'
       ORDER BY datetime(c.created_at) ASC
       LIMIT ? OFFSET ?`
    )
    .all(post.id, limit, offset);

  return {
    data: rows.map((r) => {
      const row = r as SqlRow;
      return {
        id: row.id,
        authorName: row.author_name,
        body: row.body,
        createdAt: row.created_at,
        parentId: row.parent_id != null ? row.parent_id : null,
        parentAuthorName: row.parent_author_name != null ? String(row.parent_author_name) : null,
      };
    }),
    page,
    limit,
    total,
  };
});

/** POST /posts/:slug/comments */
registerJsonRoute(
  router,
  'post',
  '/posts/:slug/comments',
  async (ctx) => {
    const slug = paramSlug(ctx.req);
    const db = await getDb();
    const post = getPublishedPostBySlug(db, slug);
    if (!post) throw new HttpError(404, '文章不存在');

    const bodyObj = ctx.body;
    let authorName = typeof bodyObj.authorName === 'string' ? bodyObj.authorName.trim() : '';
    let authorEmail = typeof bodyObj.authorEmail === 'string' ? bodyObj.authorEmail.trim() : '';
    const rawBody = typeof bodyObj.body === 'string' ? bodyObj.body : '';

    const body = sanitizeHtml(rawBody, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();
    if (!body || body.length > 2000) {
      throw new HttpError(400, '留言内容为 1～2000 个字符');
    }

    let parentId: number | null = null;
    const rawParent = (bodyObj as Record<string, unknown>).parentId;
    if (rawParent != null && rawParent !== '') {
      const n = parseInt(String(rawParent), 10);
      if (!Number.isFinite(n) || n < 1) {
        throw new HttpError(400, '无效的回复对象');
      }
      const parentRow = db
        .prepare(
          `SELECT id FROM comments WHERE id = ? AND post_id = ? AND status = 'approved'`
        )
        .get(n, post.id) as { id: number } | undefined;
      if (!parentRow) {
        throw new HttpError(400, '回复的留言不存在或不可用');
      }
      parentId = n;
    }

    const isAdminSession = !!(ctx.req.session && typeof ctx.req.session.userId === 'number');
    if (isAdminSession && parentId != null && !authorName) {
      authorName = getSiteAuthorDisplayName(db);
    }

    if (!authorName || authorName.length > 64) {
      throw new HttpError(400, '昵称为 1～64 个字符');
    }
    if (authorEmail) {
      if (authorEmail.length > 254) throw new HttpError(400, '邮箱过长');
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authorEmail);
      if (!emailOk) throw new HttpError(400, '邮箱格式不正确');
    } else {
      authorEmail = '';
    }

    const info = db
      .prepare(
        `INSERT INTO comments (post_id, author_name, author_email, body, status, parent_id)
         VALUES (?, ?, ?, ?, 'approved', ?)`
      )
      .run(post.id, authorName, authorEmail || null, body, parentId);

    return payload(
      {
        id: info.lastInsertRowid,
        message: '留言成功',
      },
      'created',
      201
    );
  },
  [commentPostLimiter]
);

/** GET：点赞接口存在，须 POST（地址栏 GET 不会点赞） */
router.get('/posts/:slug/like', getHintForPostOnly('点赞/取消赞请使用 POST，并带请求头 X-Blog-Visitor-Id（UUID v4）。'));

/** POST /posts/:slug/like — 需请求头 X-Blog-Visitor-Id（UUID v4） */
registerJsonRoute(
  router,
  'post',
  '/posts/:slug/like',
  async (ctx) => {
    const visitorId = getVisitorIdFromReq(ctx.req);
    if (!visitorId) {
      throw new HttpError(400, '请提供有效的 X-Blog-Visitor-Id 请求头（UUID）');
    }

    const slug = paramSlug(ctx.req);
    const db = await getDb();
    const post = getPublishedPostBySlug(db, slug);
    if (!post) throw new HttpError(404, '文章不存在');

    const existing = db
      .prepare('SELECT 1 FROM post_likes WHERE post_id = ? AND visitor_id = ?')
      .get(post.id, visitorId);

    if (existing) {
      db.prepare('DELETE FROM post_likes WHERE post_id = ? AND visitor_id = ?').run(post.id, visitorId);
    } else {
      db.prepare('INSERT INTO post_likes (post_id, visitor_id) VALUES (?, ?)').run(post.id, visitorId);
    }

    const liked = !existing;
    const countRow = db.prepare('SELECT COUNT(*) AS c FROM post_likes WHERE post_id = ?').get(post.id) as {
      c: number;
    } | null;
    const likeCount = countRow?.c ?? 0;

    return { liked, likeCount };
  },
  [likePostLimiter]
);

export default router;
