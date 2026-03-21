import { Router } from 'express';
import type { Request } from 'express';
import { getDb } from '../db';
import type { SqlRow, WrappedDatabase, RunResult } from '../db/types';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../lib/errors';
import { slugify } from '../lib/slug';
import { markdownToSafeHtml } from '../lib/markdown';

const router = Router();

function parsePageLimit(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || '20'), 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

function parseIdParam(raw: unknown): number | null {
  const id = parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function parseQueryId(query: Request['query']): number | null {
  if (query == null || query.id == null) return null;
  const v = Array.isArray(query.id) ? query.id[0] : query.id;
  return parseIdParam(v);
}

/** 分类 id：body → query → 路径参数 */
function resolveCategoryId(req: Request): number | null {
  return parseBodyId(req.body) ?? parseQueryId(req.query) ?? parseIdParam(req.params?.id);
}

/** 前端可能传 boolean / 字符串，避免 "false" 被当成 truthy */
function parsePinned01(body: Record<string, unknown>): 0 | 1 {
  const v = body && Object.prototype.hasOwnProperty.call(body, 'is_pinned') ? body.is_pinned : undefined;
  if (v === true || v === 1 || v === '1') return 1;
  return 0;
}

function resolveNewPostId(db: WrappedDatabase, info: RunResult, slug: string): number {
  let postId = Number(info.lastInsertRowid);
  if (Number.isFinite(postId) && postId > 0) return postId;
  try {
    const lid = db.prepare('SELECT last_insert_rowid() AS id').get() as { id: unknown } | null;
    if (lid && lid.id != null) {
      postId = Number(lid.id);
      if (Number.isFinite(postId) && postId > 0) return postId;
    }
  } catch {
    /* ignore */
  }
  const row = db.prepare('SELECT id FROM posts WHERE slug = ? COLLATE NOCASE').get(slug) as { id: unknown } | null;
  postId = row ? Number(row.id) : 0;
  if (Number.isFinite(postId) && postId > 0) return postId;
  return 0;
}

/** 从 body 取 id（兼容 number / string / bigint 序列化后的情况） */
function parseBodyId(body: unknown): number | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const raw = o.id;
  if (typeof raw === 'bigint') return parseIdParam(Number(raw));
  return parseIdParam(raw);
}

function replacePostTags(tx: WrappedDatabase, postId: number, tagIds: unknown) {
  tx.prepare('DELETE FROM post_tags WHERE post_id = ?').run(postId);
  const insert = tx.prepare('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)');
  const existsStmt = tx.prepare('SELECT 1 FROM tags WHERE id = ?');
  const unique = [...new Set((Array.isArray(tagIds) ? tagIds : []).map((id) => parseInt(String(id), 10)).filter(Boolean))];
  for (const tagId of unique) {
    if (!existsStmt.get(tagId)) continue;
    insert.run(postId, tagId);
  }
}

// --- Posts ---

router.get(
  '/posts',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePageLimit(req.query as Record<string, unknown>);
    const status = req.query.status;
    const db = await getDb();

    let where = '1=1';
    const params: unknown[] = [];
    if (status === 'draft' || status === 'published') {
      where = 'p.status = ?';
      params.push(status);
    }

    const totalRow = db.prepare(`SELECT COUNT(*) AS c FROM posts p WHERE ${where}`).get(...params) as { c: number };
    const total = totalRow.c;

    const rows = db
      .prepare(
        `SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image, p.view_count, p.is_pinned, p.status, p.published_at, p.created_at, p.updated_at,
            c.id AS category_id, c.name AS category_name, c.slug AS category_slug
         FROM posts p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE ${where}
         ORDER BY datetime(p.updated_at) DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    res.json({
      data: rows.map((r) => {
        const row = r as SqlRow;
        return {
          id: row.id,
          title: row.title,
          slug: row.slug,
          excerpt: row.excerpt,
          coverImage: row.cover_image,
          viewCount: row.view_count ?? 0,
          isPinned: !!row.is_pinned,
          status: row.status,
          publishedAt: row.published_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          category: row.category_id
            ? { id: row.category_id, name: row.category_name, slug: row.category_slug }
            : null,
        };
      }),
      page,
      limit,
      total,
    });
  })
);

router.get(
  '/posts/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!id) throw new HttpError(400, '无效的文章 id');

    const db = await getDb();
    const row = db
      .prepare(
        `SELECT p.*, c.id AS category_id, c.name AS category_name, c.slug AS category_slug
         FROM posts p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.id = ?`
      )
      .get(id) as SqlRow | null;

    if (!row) throw new HttpError(404, '文章不存在');

    const tags = db
      .prepare(
        `SELECT t.id, t.name, t.slug FROM tags t
         INNER JOIN post_tags pt ON pt.tag_id = t.id
         WHERE pt.post_id = ?
         ORDER BY t.name`
      )
      .all(id);

    res.json({
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      bodyMd: row.body_md,
      bodyHtml: markdownToSafeHtml(row.body_md),
      status: row.status,
      coverImage: row.cover_image,
      viewCount: row.view_count ?? 0,
      isPinned: !!row.is_pinned,
      categoryId: row.category_id,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      tags: tags.map((t) => {
        const tr = t as SqlRow;
        return { id: tr.id, name: tr.name, slug: tr.slug };
      }),
    });
  })
);

router.post(
  '/posts',
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) throw new HttpError(400, 'title 必填');

    let slug =
      typeof body.slug === 'string' && body.slug.trim()
        ? slugify(body.slug)
        : slugify(title);
    if (!slug) throw new HttpError(400, '无法生成有效 slug，请手动指定');

    const excerpt = typeof body.excerpt === 'string' ? body.excerpt.trim() || null : null;
    const bodyMd = typeof body.body_md === 'string' ? body.body_md : '';
    const status = body.status === 'published' ? 'published' : 'draft';
    const coverImage = typeof body.cover_image === 'string' ? body.cover_image.trim() || null : null;
    const isPinned = parsePinned01(body);
    let categoryId =
      body.category_id === null || body.category_id === ''
        ? null
        : parseInt(String(body.category_id), 10) || null;
    const tagIds = Array.isArray(body.tag_ids) ? body.tag_ids : [];

    let publishedAt: string | null = null;
    if (typeof body.published_at === 'string' && body.published_at.trim()) {
      publishedAt = body.published_at.trim();
    } else if (status === 'published') {
      publishedAt = new Date().toISOString();
    }

    const db = await getDb();
    if (categoryId != null && !db.prepare('SELECT 1 FROM categories WHERE id = ?').get(categoryId)) {
      categoryId = null;
    }

    const dup = db.prepare('SELECT id FROM posts WHERE slug = ?').get(slug);
    if (dup) throw new HttpError(409, 'slug 已存在');

    const tx = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO posts (title, slug, excerpt, body_md, status, cover_image, is_pinned, category_id, published_at, updated_at)
           VALUES (@title, @slug, @excerpt, @body_md, @status, @cover_image, @is_pinned, @category_id, @published_at, datetime('now'))`
        )
        .run({
          title,
          slug,
          excerpt,
          body_md: bodyMd,
          status,
          cover_image: coverImage,
          is_pinned: isPinned,
          category_id: categoryId,
          published_at: publishedAt,
        });
      /** sql.js 在事务内有时 changes 为 0 但行已插入，不以 changes 为准 */
      const postId = resolveNewPostId(db, info, slug);
      if (!postId) {
        throw new HttpError(
          500,
          '插入文章失败：无法解析新文章 id（请查看服务端终端日志中的数据库错误）'
        );
      }
      replacePostTags(db, postId, tagIds);
      return postId;
    });

    const postId = tx();
    res.status(201).json({ id: postId, slug });
  })
);

router.put(
  '/posts/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!id) throw new HttpError(400, '无效的文章 id');

    const db = await getDb();
    const existing = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as SqlRow | null;
    if (!existing) throw new HttpError(404, '文章不存在');

    const body = req.body as Record<string, unknown>;
    const title = typeof body.title === 'string' ? body.title.trim() : String(existing.title);
    if (!title) throw new HttpError(400, 'title 不能为空');

    let slug =
      typeof body.slug === 'string' && body.slug.trim()
        ? slugify(body.slug)
        : slugify(title);
    if (!slug) slug = String(existing.slug);

    const dup = db.prepare('SELECT id FROM posts WHERE slug = ? AND id != ?').get(slug, id);
    if (dup) throw new HttpError(409, 'slug 已存在');

    const excerpt =
      body.excerpt !== undefined
        ? typeof body.excerpt === 'string'
          ? body.excerpt.trim() || null
          : null
        : existing.excerpt;
    const bodyMd = typeof body.body_md === 'string' ? body.body_md : String(existing.body_md);
    const status = body.status === 'published' ? 'published' : 'draft';
    let categoryId =
      body.category_id === undefined
        ? (existing.category_id as number | null)
        : body.category_id === null || body.category_id === ''
          ? null
          : parseInt(String(body.category_id), 10) || null;

    if (categoryId != null && !db.prepare('SELECT 1 FROM categories WHERE id = ?').get(categoryId)) {
      categoryId = null;
    }

    let publishedAt = existing.published_at as string | null;
    if (typeof body.published_at === 'string' && body.published_at.trim()) {
      publishedAt = body.published_at.trim();
    } else if (status === 'published' && !publishedAt) {
      publishedAt = new Date().toISOString();
    } else if (status === 'draft') {
      publishedAt = null;
    }

    const tagIds = Array.isArray(body.tag_ids) ? body.tag_ids : undefined;

    const coverImage =
      body.cover_image !== undefined
        ? typeof body.cover_image === 'string'
          ? body.cover_image.trim() || null
          : null
        : existing.cover_image;
    const isPinned =
      body.is_pinned !== undefined ? parsePinned01(body) : existing.is_pinned ? 1 : 0;

    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE posts SET
          title = @title,
          slug = @slug,
          excerpt = @excerpt,
          body_md = @body_md,
          status = @status,
          cover_image = @cover_image,
          is_pinned = @is_pinned,
          category_id = @category_id,
          published_at = @published_at,
          updated_at = datetime('now')
         WHERE id = @id`
      ).run({
        title,
        slug,
        excerpt,
        body_md: bodyMd,
        status,
        cover_image: coverImage,
        is_pinned: isPinned,
        category_id: categoryId,
        published_at: publishedAt,
        id,
      });
      if (tagIds !== undefined) {
        replacePostTags(db, id, tagIds);
      }
    });

    tx();
    res.json({ id, slug });
  })
);

/** 删除文章：路径 id；另提供 POST + body/query id，避免代理对 DELETE 处理异常 */
const postDelete = asyncHandler(async (req, res) => {
  const id = parseBodyId(req.body) ?? parseIdParam(req.query.id) ?? parseIdParam(req.params.id);
  if (id == null) throw new HttpError(400, '无效的文章 id');
  const db = await getDb();
  const info = db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  if (info.changes === 0) throw new HttpError(404, '文章不存在');
  res.json({ ok: true });
});

router.post('/posts/delete', postDelete);
router.delete('/posts/:id', postDelete);

// --- Categories ---

router.post(
  '/categories',
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new HttpError(400, 'name 必填');
    const slug =
      typeof body.slug === 'string' && body.slug.trim()
        ? slugify(body.slug)
        : slugify(name);
    if (!slug) throw new HttpError(400, '无效 slug');

    const db = await getDb();
    const dup = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug);
    if (dup) throw new HttpError(409, '分类 slug 已存在');

    const info = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run(name, slug);
    res.status(201).json({ id: info.lastInsertRowid, name, slug });
  })
);

const categoryEdit = asyncHandler(async (req, res) => {
  /** id 优先路径 /categories/:id/edit，避免代理丢 body/query */
  const id = resolveCategoryId(req);
  if (id == null) throw new HttpError(400, '无效的 id');
  const body = req.body as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw new HttpError(400, 'name 必填');
  let slug =
    typeof body.slug === 'string' && body.slug.trim()
      ? slugify(body.slug)
      : slugify(name);
  if (!slug) throw new HttpError(400, '无效 slug');

  const db = await getDb();
  const existRows = db.prepare('SELECT id FROM categories WHERE id = ?').all(id);
  if (!existRows.length) throw new HttpError(404, '分类不存在');

  const dup = db.prepare('SELECT id FROM categories WHERE slug = ? AND id != ?').get(slug, id);
  if (dup) throw new HttpError(409, '分类 slug 已存在');

  db.prepare('UPDATE categories SET name = ?, slug = ? WHERE id = ?').run(name, slug, id);
  // SQLite 在值未变化时 changes 可能为 0，不能据此判「不存在」
  res.json({ id, name, slug });
});

router.post('/categories/edit', categoryEdit);
router.post('/categories/:id/edit', categoryEdit);

/** 删除分类：支持 POST/DELETE + 路径 /categories/:id/delete */
const categoryDelete = asyncHandler(async (req, res) => {
  const id = resolveCategoryId(req);
  if (id == null) throw new HttpError(400, '无效的 id');
  const db = await getDb();
  const rows = db.prepare('SELECT id FROM categories WHERE id = ?').all(id);
  if (!rows.length) throw new HttpError(404, '分类不存在');
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ ok: true });
});

router.post('/categories/delete', categoryDelete);
router.post('/categories/:id/delete', categoryDelete);
router.delete('/categories/delete', categoryDelete);
router.delete('/categories/:id/delete', categoryDelete);

// --- Tags ---

router.post(
  '/tags',
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new HttpError(400, 'name 必填');
    const slug =
      typeof body.slug === 'string' && body.slug.trim()
        ? slugify(body.slug)
        : slugify(name);
    if (!slug) throw new HttpError(400, '无效 slug');

    const db = await getDb();
    const dup = db.prepare('SELECT id FROM tags WHERE slug = ?').get(slug);
    if (dup) throw new HttpError(409, '标签 slug 已存在');

    const info = db.prepare('INSERT INTO tags (name, slug) VALUES (?, ?)').run(name, slug);
    res.status(201).json({ id: info.lastInsertRowid, name, slug });
  })
);

const tagEdit = asyncHandler(async (req, res) => {
  const id = parseBodyId(req.body) ?? parseIdParam(req.query.id) ?? parseIdParam(req.params.id);
  if (id == null) throw new HttpError(400, '无效的 id');
  const body = req.body as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw new HttpError(400, 'name 必填');
  let slug =
    typeof body.slug === 'string' && body.slug.trim()
      ? slugify(body.slug)
      : slugify(name);
  if (!slug) throw new HttpError(400, '无效 slug');

  const db = await getDb();
  const existRows = db.prepare('SELECT id FROM tags WHERE id = ?').all(id);
  if (!existRows.length) throw new HttpError(404, '标签不存在');

  const dup = db.prepare('SELECT id FROM tags WHERE slug = ? AND id != ?').get(slug, id);
  if (dup) throw new HttpError(409, '标签 slug 已存在');

  db.prepare('UPDATE tags SET name = ?, slug = ? WHERE id = ?').run(name, slug, id);
  res.json({ id, name, slug });
});

router.post('/tags/edit', tagEdit);
router.put('/tags/:id', tagEdit);

const tagDelete = asyncHandler(async (req, res) => {
  const id = parseBodyId(req.body) ?? parseIdParam(req.query.id) ?? parseIdParam(req.params.id);
  if (id == null) throw new HttpError(400, '无效的 id');
  const db = await getDb();
  const rows = db.prepare('SELECT id FROM tags WHERE id = ?').all(id);
  if (!rows.length) throw new HttpError(404, '标签不存在');
  db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  res.json({ ok: true });
});

router.post('/tags/delete', tagDelete);
router.delete('/tags/:id', tagDelete);

// --- Site settings ---

router.get(
  '/site',
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    try {
      const rows = db.prepare('SELECT key, value FROM site_settings').all();
      const settings: Record<string, unknown> = {};
      for (const r of rows) {
        const row = r as SqlRow;
        settings[String(row.key)] = row.value;
      }
      res.json(settings);
    } catch {
      res.json({ site_title: '我的博客', site_description: '', about_content: '' });
    }
  })
);

router.put(
  '/site',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const body = req.body as Record<string, unknown>;
    const keys = [
      'site_title',
      'site_description',
      'about_content',
      'author_name',
      'author_avatar',
      'author_bio',
      'author_links',
    ];
    const upsert = db.prepare(
      'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );
    for (const k of keys) {
      if (body[k] !== undefined) {
        const v =
          k === 'author_links' && Array.isArray(body[k]) ? JSON.stringify(body[k]) : String(body[k] ?? '');
        upsert.run(k, v);
      }
    }
    const rows = db.prepare('SELECT key, value FROM site_settings').all();
    const settings: Record<string, unknown> = {};
    for (const r of rows) {
      const row = r as SqlRow;
      settings[String(row.key)] = row.value;
    }
    res.json(settings);
  })
);

// --- Links ---

router.get(
  '/links',
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    try {
      const rows = db.prepare('SELECT id, title, url, sort FROM links ORDER BY sort ASC, id ASC').all();
      res.json({ data: rows });
    } catch {
      res.json({ data: [] });
    }
  })
);

router.post(
  '/links',
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!title || !url) throw new HttpError(400, 'title 和 url 必填');
    const sort = parseInt(String(body.sort || '0'), 10) || 0;
    const db = await getDb();
    const info = db.prepare('INSERT INTO links (title, url, sort) VALUES (?, ?, ?)').run(title, url, sort);
    res.status(201).json({ id: info.lastInsertRowid, title, url, sort });
  })
);

const linkEdit = asyncHandler(async (req, res) => {
  const id = parseBodyId(req.body) ?? parseIdParam(req.query.id) ?? parseIdParam(req.params.id);
  if (id == null) throw new HttpError(400, '无效的 id');
  const body = req.body as Record<string, unknown>;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!title || !url) throw new HttpError(400, 'title 和 url 必填');
  const sort = parseInt(String(body.sort || '0'), 10) || 0;
  const db = await getDb();
  const info = db.prepare('UPDATE links SET title = ?, url = ?, sort = ? WHERE id = ?').run(title, url, sort, id);
  if (info.changes === 0) throw new HttpError(404, '友链不存在');
  res.json({ id, title, url, sort });
});

router.post('/links/edit', linkEdit);
router.put('/links/:id', linkEdit);

const linkDelete = asyncHandler(async (req, res) => {
  const id = parseBodyId(req.body) ?? parseIdParam(req.query.id) ?? parseIdParam(req.params.id);
  if (id == null) throw new HttpError(400, '无效的 id');
  const db = await getDb();
  const info = db.prepare('DELETE FROM links WHERE id = ?').run(id);
  if (info.changes === 0) throw new HttpError(404, '友链不存在');
  res.json({ ok: true });
});

router.post('/links/delete', linkDelete);
router.delete('/links/:id', linkDelete);

// --- 留言审核 ---

router.get(
  '/comments',
  asyncHandler(async (req, res) => {
    const status = req.query.status;
    const db = await getDb();
    let where = '1=1';
    const params: unknown[] = [];
    if (status === 'pending' || status === 'approved' || status === 'rejected') {
      where = 'c.status = ?';
      params.push(status);
    }
    const rows = db
      .prepare(
        `SELECT c.id, c.post_id, c.author_name, c.author_email, c.body, c.status, c.created_at,
          p.title AS post_title, p.slug AS post_slug
         FROM comments c
         INNER JOIN posts p ON p.id = c.post_id
         WHERE ${where}
         ORDER BY datetime(c.created_at) DESC
         LIMIT 500`
      )
      .all(...params);
    res.json({
      data: rows.map((r) => {
        const row = r as SqlRow;
        return {
          id: row.id,
          postId: row.post_id,
          postTitle: row.post_title,
          postSlug: row.post_slug,
          authorName: row.author_name,
          authorEmail: row.author_email,
          body: row.body,
          status: row.status,
          createdAt: row.created_at,
        };
      }),
    });
  })
);

const commentStatusUpdate = asyncHandler(async (req, res) => {
  const id = parseBodyId(req.body) ?? parseIdParam(req.query.id) ?? parseIdParam(req.params.id);
  if (id == null) throw new HttpError(400, '无效的 id');
  const body = req.body as Record<string, unknown>;
  const status =
    typeof body.status === 'string'
      ? body.status
      : typeof req.query.status === 'string'
        ? req.query.status
        : null;
  if (status !== 'approved' && status !== 'rejected' && status !== 'pending') {
    throw new HttpError(400, 'status 须为 pending、approved 或 rejected');
  }
  const db = await getDb();
  const info = db.prepare('UPDATE comments SET status = ? WHERE id = ?').run(status, id);
  if (info.changes === 0) throw new HttpError(404, '留言不存在');
  res.json({ id, status });
});

router.post('/comments/edit', commentStatusUpdate);
router.put('/comments/:id', commentStatusUpdate);

const commentDelete = asyncHandler(async (req, res) => {
  const id = parseBodyId(req.body) ?? parseIdParam(req.query.id) ?? parseIdParam(req.params.id);
  if (id == null) throw new HttpError(400, '无效的 id');
  const db = await getDb();
  const info = db.prepare('DELETE FROM comments WHERE id = ?').run(id);
  if (info.changes === 0) throw new HttpError(404, '留言不存在');
  res.json({ ok: true });
});

router.post('/comments/delete', commentDelete);
router.delete('/comments/:id', commentDelete);

export default router;
