const { Router } = require('express');
const { getDb } = require('../db');
const { asyncHandler } = require('../middleware/asyncHandler');
const { HttpError } = require('../lib/errors');
const { slugify } = require('../lib/slug');
const { markdownToSafeHtml } = require('../lib/markdown');

const router = Router();

function parsePageLimit(query) {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || '20'), 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

function replacePostTags(tx, postId, tagIds) {
  tx.prepare('DELETE FROM post_tags WHERE post_id = ?').run(postId);
  const insert = tx.prepare('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)');
  const unique = [...new Set((tagIds || []).map((id) => parseInt(String(id), 10)).filter(Boolean))];
  for (const tagId of unique) {
    insert.run(postId, tagId);
  }
}

// --- Posts ---

router.get(
  '/posts',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePageLimit(req.query);
    const status = req.query.status;
    const db = await getDb();

    let where = '1=1';
    const params = [];
    if (status === 'draft' || status === 'published') {
      where = 'p.status = ?';
      params.push(status);
    }

    const totalRow = db
      .prepare(`SELECT COUNT(*) AS c FROM posts p WHERE ${where}`)
      .get(...params);
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
      data: rows.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        excerpt: r.excerpt,
        coverImage: r.cover_image,
        viewCount: r.view_count ?? 0,
        isPinned: !!r.is_pinned,
        status: r.status,
        publishedAt: r.published_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        category: r.category_id
          ? { id: r.category_id, name: r.category_name, slug: r.category_slug }
          : null,
      })),
      page,
      limit,
      total,
    });
  })
);

router.get(
  '/posts/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) throw new HttpError(400, '无效的文章 id');

    const db = await getDb();
    const row = db
      .prepare(
        `SELECT p.*, c.id AS category_id, c.name AS category_name, c.slug AS category_slug
         FROM posts p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.id = ?`
      )
      .get(id);

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
      tags: tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
    });
  })
);

router.post(
  '/posts',
  asyncHandler(async (req, res) => {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    if (!title) throw new HttpError(400, 'title 必填');

    let slug =
      typeof req.body.slug === 'string' && req.body.slug.trim()
        ? slugify(req.body.slug)
        : slugify(title);
    if (!slug) throw new HttpError(400, '无法生成有效 slug，请手动指定');

    const excerpt =
      typeof req.body.excerpt === 'string' ? req.body.excerpt.trim() || null : null;
    const bodyMd = typeof req.body.body_md === 'string' ? req.body.body_md : '';
    const status = req.body.status === 'published' ? 'published' : 'draft';
    const coverImage =
      typeof req.body.cover_image === 'string' ? req.body.cover_image.trim() || null : null;
    const isPinned = req.body.is_pinned ? 1 : 0;
    const categoryId =
      req.body.category_id === null || req.body.category_id === ''
        ? null
        : parseInt(String(req.body.category_id), 10) || null;
    const tagIds = Array.isArray(req.body.tag_ids) ? req.body.tag_ids : [];

    let publishedAt = null;
    if (typeof req.body.published_at === 'string' && req.body.published_at.trim()) {
      publishedAt = req.body.published_at.trim();
    } else if (status === 'published') {
      publishedAt = new Date().toISOString();
    }

    const db = await getDb();
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
      const postId = info.lastInsertRowid;
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
    const id = parseInt(req.params.id, 10);
    if (!id) throw new HttpError(400, '无效的文章 id');

    const db = await getDb();
    const existing = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
    if (!existing) throw new HttpError(404, '文章不存在');

    const title =
      typeof req.body.title === 'string' ? req.body.title.trim() : existing.title;
    if (!title) throw new HttpError(400, 'title 不能为空');

    let slug =
      typeof req.body.slug === 'string' && req.body.slug.trim()
        ? slugify(req.body.slug)
        : slugify(title);
    if (!slug) slug = existing.slug;

    const dup = db.prepare('SELECT id FROM posts WHERE slug = ? AND id != ?').get(slug, id);
    if (dup) throw new HttpError(409, 'slug 已存在');

    const excerpt =
      req.body.excerpt !== undefined
        ? typeof req.body.excerpt === 'string'
          ? req.body.excerpt.trim() || null
          : null
        : existing.excerpt;
    const bodyMd =
      typeof req.body.body_md === 'string' ? req.body.body_md : existing.body_md;
    const status = req.body.status === 'published' ? 'published' : 'draft';
    const categoryId =
      req.body.category_id === undefined
        ? existing.category_id
        : req.body.category_id === null || req.body.category_id === ''
          ? null
          : parseInt(String(req.body.category_id), 10) || null;

    let publishedAt = existing.published_at;
    if (typeof req.body.published_at === 'string' && req.body.published_at.trim()) {
      publishedAt = req.body.published_at.trim();
    } else if (status === 'published' && !publishedAt) {
      publishedAt = new Date().toISOString();
    } else if (status === 'draft') {
      publishedAt = null;
    }

    const tagIds = Array.isArray(req.body.tag_ids) ? req.body.tag_ids : undefined;

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

router.delete(
  '/posts/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) throw new HttpError(400, '无效的文章 id');
    const db = await getDb();
    const info = db.prepare('DELETE FROM posts WHERE id = ?').run(id);
    if (info.changes === 0) throw new HttpError(404, '文章不存在');
    res.json({ ok: true });
  })
);

// --- Categories ---

router.post(
  '/categories',
  asyncHandler(async (req, res) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name) throw new HttpError(400, 'name 必填');
    const slug =
      typeof req.body.slug === 'string' && req.body.slug.trim()
        ? slugify(req.body.slug)
        : slugify(name);
    if (!slug) throw new HttpError(400, '无效 slug');

    const db = await getDb();
    const dup = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug);
    if (dup) throw new HttpError(409, '分类 slug 已存在');

    const info = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run(name, slug);
    res.status(201).json({ id: info.lastInsertRowid, name, slug });
  })
);

router.put(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) throw new HttpError(400, '无效的 id');
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name) throw new HttpError(400, 'name 必填');
    let slug =
      typeof req.body.slug === 'string' && req.body.slug.trim()
        ? slugify(req.body.slug)
        : slugify(name);
    if (!slug) throw new HttpError(400, '无效 slug');

    const db = await getDb();
    const dup = db.prepare('SELECT id FROM categories WHERE slug = ? AND id != ?').get(slug, id);
    if (dup) throw new HttpError(409, '分类 slug 已存在');

    const info = db.prepare('UPDATE categories SET name = ?, slug = ? WHERE id = ?').run(name, slug, id);
    if (info.changes === 0) throw new HttpError(404, '分类不存在');
    res.json({ id, name, slug });
  })
);

router.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) throw new HttpError(400, '无效的 id');
    const db = await getDb();
    const info = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    if (info.changes === 0) throw new HttpError(404, '分类不存在');
    res.json({ ok: true });
  })
);

// --- Tags ---

router.post(
  '/tags',
  asyncHandler(async (req, res) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name) throw new HttpError(400, 'name 必填');
    const slug =
      typeof req.body.slug === 'string' && req.body.slug.trim()
        ? slugify(req.body.slug)
        : slugify(name);
    if (!slug) throw new HttpError(400, '无效 slug');

    const db = await getDb();
    const dup = db.prepare('SELECT id FROM tags WHERE slug = ?').get(slug);
    if (dup) throw new HttpError(409, '标签 slug 已存在');

    const info = db.prepare('INSERT INTO tags (name, slug) VALUES (?, ?)').run(name, slug);
    res.status(201).json({ id: info.lastInsertRowid, name, slug });
  })
);

router.put(
  '/tags/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) throw new HttpError(400, '无效的 id');
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name) throw new HttpError(400, 'name 必填');
    let slug =
      typeof req.body.slug === 'string' && req.body.slug.trim()
        ? slugify(req.body.slug)
        : slugify(name);
    if (!slug) throw new HttpError(400, '无效 slug');

    const db = await getDb();
    const dup = db.prepare('SELECT id FROM tags WHERE slug = ? AND id != ?').get(slug, id);
    if (dup) throw new HttpError(409, '标签 slug 已存在');

    const info = db.prepare('UPDATE tags SET name = ?, slug = ? WHERE id = ?').run(name, slug, id);
    if (info.changes === 0) throw new HttpError(404, '标签不存在');
    res.json({ id, name, slug });
  })
);

router.delete(
  '/tags/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) throw new HttpError(400, '无效的 id');
    const db = await getDb();
    const info = db.prepare('DELETE FROM tags WHERE id = ?').run(id);
    if (info.changes === 0) throw new HttpError(404, '标签不存在');
    res.json({ ok: true });
  })
);

// --- Site settings ---

router.get(
  '/site',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    try {
      const rows = db.prepare('SELECT key, value FROM site_settings').all();
      const settings = {};
      for (const r of rows) settings[r.key] = r.value;
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
    const keys = ['site_title', 'site_description', 'about_content', 'author_name', 'author_avatar', 'author_bio', 'author_links'];
    const upsert = db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const k of keys) {
      if (req.body[k] !== undefined) {
        const v = k === 'author_links' && Array.isArray(req.body[k])
          ? JSON.stringify(req.body[k])
          : String(req.body[k] ?? '');
        upsert.run(k, v);
      }
    }
    const rows = db.prepare('SELECT key, value FROM site_settings').all();
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json(settings);
  })
);

// --- Links ---

router.get('/links', asyncHandler(async (req, res) => {
  const db = await getDb();
  try {
    const rows = db.prepare('SELECT id, title, url, sort FROM links ORDER BY sort ASC, id ASC').all();
    res.json({ data: rows });
  } catch {
    res.json({ data: [] });
  }
}));

router.post(
  '/links',
  asyncHandler(async (req, res) => {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const url = typeof req.body.url === 'string' ? req.body.url.trim() : '';
    if (!title || !url) throw new HttpError(400, 'title 和 url 必填');
    const sort = parseInt(String(req.body.sort || '0'), 10) || 0;
    const db = await getDb();
    const info = db.prepare('INSERT INTO links (title, url, sort) VALUES (?, ?, ?)').run(title, url, sort);
    res.status(201).json({ id: info.lastInsertRowid, title, url, sort });
  })
);

router.put(
  '/links/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) throw new HttpError(400, '无效的 id');
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const url = typeof req.body.url === 'string' ? req.body.url.trim() : '';
    if (!title || !url) throw new HttpError(400, 'title 和 url 必填');
    const sort = parseInt(String(req.body.sort || '0'), 10) || 0;
    const db = await getDb();
    const info = db.prepare('UPDATE links SET title = ?, url = ?, sort = ? WHERE id = ?').run(title, url, sort, id);
    if (info.changes === 0) throw new HttpError(404, '友链不存在');
    res.json({ id, title, url, sort });
  })
);

router.delete(
  '/links/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) throw new HttpError(400, '无效的 id');
    const db = await getDb();
    const info = db.prepare('DELETE FROM links WHERE id = ?').run(id);
    if (info.changes === 0) throw new HttpError(404, '友链不存在');
    res.json({ ok: true });
  })
);

module.exports = router;
