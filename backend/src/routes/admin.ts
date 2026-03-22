/**
 * 管理端业务路由（相对路径均不带 /api/admin 前缀）。
 * 实际 URL = `registerRoutes` 中的挂载前缀 `/api/admin` + 此处路径，例如 POST `/categories/list` → `POST /api/admin/categories/list`。
 * 鉴权在 `registerRoutes.ts` 通过 `requireAuth` 挂在 `/api/admin` 上，不在本文件重复。
 */
import { Router } from 'express';
import { getDb } from '../db';
import type { SqlRow, WrappedDatabase, RunResult } from '../db/types';
import { HttpError } from '../lib/errors';
import { slugify } from '../lib/slug';
import { markdownToSafeHtml } from '../lib/markdown';
import { adminRouterGetFallback } from '../lib/getMethodHint';
import { readVisitStats } from '../lib/visitStats';
import { DEFAULT_SITE_NAME } from '../config/site';
import { payload, registerJsonRoute } from '../lib/apiRoute';

const router = Router();

function parsePageLimit(input: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(input.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(input.limit ?? '20'), 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

function parseIdParam(raw: unknown): number | null {
  const id = parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

/** 从 body 取 id */
function parseBodyId(body: unknown): number | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const raw = o.id;
  if (typeof raw === 'bigint') return parseIdParam(Number(raw));
  return parseIdParam(raw);
}

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

// --- Posts（固定路径 + POST + body）---

registerJsonRoute(router, 'post', '/posts/list', async (ctx) => {
    const q = (ctx.body || {}) as Record<string, unknown>;
    const { page, limit, offset } = parsePageLimit(q);
    const status = q.status;
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

    return payload({
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
      }, 'ok');
});

registerJsonRoute(router, 'post', '/posts/detail', async (ctx) => {
    const id = parseBodyId(ctx.body);
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

    return {
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
    };
});

registerJsonRoute(router, 'post', '/posts/create', async (ctx) => {
    const body = ctx.body as Record<string, unknown>;
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
    return payload({ id: postId, slug }, '创建成功', 201);
});

registerJsonRoute(router, 'post', '/posts/update', async (ctx) => {
    const body = ctx.body as Record<string, unknown>;
    const id = parseBodyId(body);
    if (!id) throw new HttpError(400, '无效的文章 id');

    const db = await getDb();
    const existing = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as SqlRow | null;
    if (!existing) throw new HttpError(404, '文章不存在');

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
    return payload({ id, slug }, '更新成功');
});

registerJsonRoute(router, 'post', '/posts/delete', async (ctx) => {
    const id = parseBodyId(ctx.body);
    if (id == null) throw new HttpError(400, '无效的文章 id');
    const db = await getDb();
    const info = db.prepare('DELETE FROM posts WHERE id = ?').run(id);
    if (info.changes === 0) throw new HttpError(404, '文章不存在');
    return payload({ ok: true }, '删除成功');
});

// --- Categories / Tags 列表（管理端统一 POST）---

registerJsonRoute(router, 'post', '/categories/list', async () => {
    const db = await getDb();
    const rows = db.prepare('SELECT id, name, slug, created_at FROM categories ORDER BY name').all();
    return { data: rows };
});

registerJsonRoute(router, 'post', '/tags/list', async () => {
    const db = await getDb();
    const rows = db.prepare('SELECT id, name, slug, created_at FROM tags ORDER BY name').all();
    return { data: rows };
});

// --- Categories ---

registerJsonRoute(router, 'post', '/categories/create', async (ctx) => {
    const body = ctx.body as Record<string, unknown>;
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
    return payload({ id: info.lastInsertRowid, name, slug }, '创建成功', 201);
});

registerJsonRoute(router, 'post', '/categories/edit', async (ctx) => {
    const body = ctx.body as Record<string, unknown>;
    const id = parseBodyId(body);
    if (id == null) throw new HttpError(400, '无效的 id');
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
    return payload({ id, name, slug }, '保存成功');
});

registerJsonRoute(router, 'post', '/categories/delete', async (ctx) => {
    const id = parseBodyId(ctx.body);
    if (id == null) throw new HttpError(400, '无效的 id');
    const db = await getDb();
    const rows = db.prepare('SELECT id FROM categories WHERE id = ?').all(id);
    if (!rows.length) throw new HttpError(404, '分类不存在');
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return payload({ ok: true }, '删除成功');
});

// --- Tags ---

registerJsonRoute(router, 'post', '/tags/create', async (ctx) => {
    const body = ctx.body as Record<string, unknown>;
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
    return payload({ id: info.lastInsertRowid, name, slug }, '创建成功', 201);
});

registerJsonRoute(router, 'post', '/tags/edit', async (ctx) => {
    const body = ctx.body as Record<string, unknown>;
    const id = parseBodyId(body);
    if (id == null) throw new HttpError(400, '无效的 id');
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
    return payload({ id, name, slug }, '保存成功');
});

registerJsonRoute(router, 'post', '/tags/delete', async (ctx) => {
    const id = parseBodyId(ctx.body);
    if (id == null) throw new HttpError(400, '无效的 id');
    const db = await getDb();
    const rows = db.prepare('SELECT id FROM tags WHERE id = ?').all(id);
    if (!rows.length) throw new HttpError(404, '标签不存在');
    db.prepare('DELETE FROM tags WHERE id = ?').run(id);
    return payload({ ok: true }, '删除成功');
});

// --- Site settings ---

registerJsonRoute(router, 'post', '/site/get', async () => {
    const db = await getDb();
    try {
      const rows = db.prepare('SELECT key, value FROM site_settings').all();
      const settings: Record<string, unknown> = {};
      for (const r of rows) {
        const row = r as SqlRow;
        settings[String(row.key)] = row.value;
      }
      const stats = readVisitStats(db);
      Object.assign(settings, {
        totalVisits: stats.totalVisits,
        todayVisits: stats.todayVisits,
      });
      return settings;
    } catch {
      const stats = readVisitStats(db);
      return {
        site_title: DEFAULT_SITE_NAME,
        site_description: '',
        about_content: '',
        totalVisits: stats.totalVisits,
        todayVisits: stats.todayVisits,
      };
    }
});

registerJsonRoute(router, 'post', '/site/update', async (ctx) => {
    const db = await getDb();
    const body = ctx.body as Record<string, unknown>;
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
    return payload(settings, '保存成功');
});

// --- Links ---

registerJsonRoute(router, 'post', '/links/list', async () => {
    const db = await getDb();
    try {
      const rows = db.prepare('SELECT id, title, url, sort FROM links ORDER BY sort ASC, id ASC').all();
      return { data: rows };
    } catch {
      return { data: [] };
    }
});

registerJsonRoute(router, 'post', '/links/create', async (ctx) => {
    const body = ctx.body as Record<string, unknown>;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!title || !url) throw new HttpError(400, 'title 和 url 必填');
    const sort = parseInt(String(body.sort || '0'), 10) || 0;
    const db = await getDb();
    const info = db.prepare('INSERT INTO links (title, url, sort) VALUES (?, ?, ?)').run(title, url, sort);
    return payload({ id: info.lastInsertRowid, title, url, sort }, '创建成功', 201);
});

registerJsonRoute(router, 'post', '/links/edit', async (ctx) => {
    const body = ctx.body as Record<string, unknown>;
    const id = parseBodyId(body);
    if (id == null) throw new HttpError(400, '无效的 id');
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!title || !url) throw new HttpError(400, 'title 和 url 必填');
    const sort = parseInt(String(body.sort || '0'), 10) || 0;
    const db = await getDb();
    const info = db.prepare('UPDATE links SET title = ?, url = ?, sort = ? WHERE id = ?').run(title, url, sort, id);
    if (info.changes === 0) throw new HttpError(404, '友链不存在');
    return payload({ id, title, url, sort }, '保存成功');
});

registerJsonRoute(router, 'post', '/links/delete', async (ctx) => {
    const id = parseBodyId(ctx.body);
    if (id == null) throw new HttpError(400, '无效的 id');
    const db = await getDb();
    const info = db.prepare('DELETE FROM links WHERE id = ?').run(id);
    if (info.changes === 0) throw new HttpError(404, '友链不存在');
    return payload({ ok: true }, '删除成功');
});

// --- 留言审核 ---

registerJsonRoute(router, 'post', '/comments/list', async (ctx) => {
    const body = (ctx.body || {}) as Record<string, unknown>;
    const status = body.status;
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
          c.parent_id, par.author_name AS parent_author_name,
          p.title AS post_title, p.slug AS post_slug
         FROM comments c
         INNER JOIN posts p ON p.id = c.post_id
         LEFT JOIN comments par ON par.id = c.parent_id
         WHERE ${where}
         ORDER BY datetime(c.created_at) DESC
         LIMIT 500`
      )
      .all(...params);
    return {
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
          parentId: row.parent_id != null ? row.parent_id : null,
          parentAuthorName: row.parent_author_name != null ? String(row.parent_author_name) : null,
        };
      }),
    };
});

registerJsonRoute(router, 'post', '/comments/edit', async (ctx) => {
    const body = ctx.body as Record<string, unknown>;
    const id = parseBodyId(body);
    if (id == null) throw new HttpError(400, '无效的 id');
    const status =
      typeof body.status === 'string'
        ? body.status
        : null;
    if (status !== 'approved' && status !== 'rejected' && status !== 'pending') {
      throw new HttpError(400, 'status 须为 pending、approved 或 rejected');
    }
    const db = await getDb();
    const info = db.prepare('UPDATE comments SET status = ? WHERE id = ?').run(status, id);
    if (info.changes === 0) throw new HttpError(404, '留言不存在');
    return payload({ id, status }, '更新成功');
});

registerJsonRoute(router, 'post', '/comments/delete', async (ctx) => {
    const id = parseBodyId(ctx.body);
    if (id == null) throw new HttpError(400, '无效的 id');
    const db = await getDb();
    db.prepare('UPDATE comments SET parent_id = NULL WHERE parent_id = ?').run(id);
    const info = db.prepare('DELETE FROM comments WHERE id = ?').run(id);
    if (info.changes === 0) throw new HttpError(404, '留言不存在');
    return payload({ ok: true }, '删除成功');
});

router.use(adminRouterGetFallback);

export default router;
