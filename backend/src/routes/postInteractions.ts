import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import sanitizeHtml from 'sanitize-html';
import { getDb } from '../db';
import type { SqlRow, WrappedDatabase } from '../db/types';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../lib/errors';
import { getVisitorIdFromReq } from '../lib/visitor';
import { resError } from '../lib/httpJson';

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

/** GET /posts/:slug/comments */
router.get(
  '/posts/:slug/comments',
  asyncHandler(async (req, res) => {
    const slug = paramSlug(req);
    const db = await getDb();
    const post = getPublishedPostBySlug(db, slug);
    if (!post) throw new HttpError(404, '文章不存在');

    const { page, limit, offset } = parsePageLimit(req.query as Record<string, unknown>);
    const countRow = db
      .prepare(`SELECT COUNT(*) AS c FROM comments WHERE post_id = ? AND status = 'approved'`)
      .get(post.id) as { c: number } | null;
    const total = countRow?.c ?? 0;

    const rows = db
      .prepare(
        `SELECT id, author_name, body, created_at FROM comments
         WHERE post_id = ? AND status = 'approved'
         ORDER BY datetime(created_at) ASC
         LIMIT ? OFFSET ?`
      )
      .all(post.id, limit, offset);

    res.json({
      data: rows.map((r) => {
        const row = r as SqlRow;
        return {
          id: row.id,
          authorName: row.author_name,
          body: row.body,
          createdAt: row.created_at,
        };
      }),
      page,
      limit,
      total,
    });
  })
);

/** POST /posts/:slug/comments */
router.post(
  '/posts/:slug/comments',
  commentPostLimiter,
  asyncHandler(async (req, res) => {
    const slug = paramSlug(req);
    const db = await getDb();
    const post = getPublishedPostBySlug(db, slug);
    if (!post) throw new HttpError(404, '文章不存在');

    const bodyObj = req.body as Record<string, unknown>;
    const authorName = typeof bodyObj.authorName === 'string' ? bodyObj.authorName.trim() : '';
    let authorEmail = typeof bodyObj.authorEmail === 'string' ? bodyObj.authorEmail.trim() : '';
    const rawBody = typeof bodyObj.body === 'string' ? bodyObj.body : '';

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

    const body = sanitizeHtml(rawBody, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();
    if (!body || body.length > 2000) {
      throw new HttpError(400, '留言内容为 1～2000 个字符');
    }

    const info = db
      .prepare(
        `INSERT INTO comments (post_id, author_name, author_email, body, status)
         VALUES (?, ?, ?, ?, 'pending')`
      )
      .run(post.id, authorName, authorEmail || null, body);

    res.status(201).json({
      id: info.lastInsertRowid,
      message: '提交成功，审核通过后将显示',
    });
  })
);

/** POST /posts/:slug/like — 需请求头 X-Blog-Visitor-Id（UUID v4） */
router.post(
  '/posts/:slug/like',
  likePostLimiter,
  asyncHandler(async (req, res) => {
    const visitorId = getVisitorIdFromReq(req);
    if (!visitorId) {
      throw new HttpError(400, '请提供有效的 X-Blog-Visitor-Id 请求头（UUID）');
    }

    const slug = paramSlug(req);
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

    res.json({ liked, likeCount });
  })
);

export default router;
