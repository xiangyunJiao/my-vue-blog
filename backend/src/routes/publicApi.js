const { Router } = require('express');
const { getDb } = require('../db');
const { asyncHandler } = require('../middleware/asyncHandler');
const { HttpError } = require('../lib/errors');
const { markdownToSafeHtml } = require('../lib/markdown');

const router = Router();

function parsePageLimit(query) {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(query.limit || '10'), 10) || 10));
  return { page, limit, offset: (page - 1) * limit };
}

router.get(
  '/posts',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePageLimit(req.query);
    const db = await getDb();

    const totalRow = db
      .prepare(`SELECT COUNT(*) AS c FROM posts WHERE status = 'published'`)
      .get();
    const total = totalRow.c;

    const rows = db
      .prepare(
        `SELECT p.id, p.title, p.slug, p.excerpt, p.published_at, p.created_at, p.updated_at,
            c.id AS category_id, c.name AS category_name, c.slug AS category_slug
         FROM posts p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.status = 'published'
         ORDER BY datetime(COALESCE(p.published_at, p.created_at)) DESC
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset);

    res.json({
      data: rows.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        excerpt: r.excerpt,
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
  '/posts/:slug',
  asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const db = await getDb();
    const row = db
      .prepare(
        `SELECT p.*, c.id AS category_id, c.name AS category_name, c.slug AS category_slug
         FROM posts p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.slug = ? AND p.status = 'published'`
      )
      .get(slug);

    if (!row) {
      throw new HttpError(404, '文章不存在');
    }

    const tags = db
      .prepare(
        `SELECT t.id, t.name, t.slug FROM tags t
         INNER JOIN post_tags pt ON pt.tag_id = t.id
         WHERE pt.post_id = ?
         ORDER BY t.name`
      )
      .all(row.id);

    res.json({
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      bodyMd: row.body_md,
      bodyHtml: markdownToSafeHtml(row.body_md),
      status: row.status,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      category: row.category_id
        ? { id: row.category_id, name: row.category_name, slug: row.category_slug }
        : null,
      tags: tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
    });
  })
);

router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = db.prepare('SELECT id, name, slug, created_at FROM categories ORDER BY name').all();
    res.json({ data: rows });
  })
);

router.get(
  '/tags',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = db.prepare('SELECT id, name, slug, created_at FROM tags ORDER BY name').all();
    res.json({ data: rows });
  })
);

module.exports = router;
