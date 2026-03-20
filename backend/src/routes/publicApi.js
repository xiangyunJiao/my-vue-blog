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

function mapPostRow(r) {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    excerpt: r.excerpt,
    coverImage: r.cover_image,
    viewCount: r.view_count ?? 0,
    isPinned: !!r.is_pinned,
    publishedAt: r.published_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    category: r.category_id
      ? { id: r.category_id, name: r.category_name, slug: r.category_slug }
      : null,
  };
}

router.get(
  '/posts',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePageLimit(req.query);
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const tag = typeof req.query.tag === 'string' ? req.query.tag.trim() : '';
    const db = await getDb();

    let whereClause = "WHERE p.status = 'published'";
    let joinClause = 'LEFT JOIN categories c ON c.id = p.category_id';
    const params = [];

    if (tag) {
      joinClause += ' INNER JOIN post_tags pt ON pt.post_id = p.id INNER JOIN tags t ON t.id = pt.tag_id AND t.slug = ?';
      params.push(tag);
    }
    if (category) {
      whereClause += ' AND c.slug = ?';
      params.push(category);
    }

    const countSql = tag
      ? `SELECT COUNT(DISTINCT p.id) AS c FROM posts p INNER JOIN post_tags pt ON pt.post_id = p.id INNER JOIN tags t ON t.id = pt.tag_id WHERE t.slug = ? AND p.status = 'published'`
      : category
        ? `SELECT COUNT(*) AS c FROM posts p LEFT JOIN categories c ON c.id = p.category_id WHERE p.status = 'published' AND c.slug = ?`
        : `SELECT COUNT(*) AS c FROM posts WHERE status = 'published'`;
    const countParams = tag ? [tag] : category ? [category] : [];
    const total = db.prepare(countSql).get(...countParams)?.c ?? 0;

    const orderBy = 'ORDER BY p.is_pinned DESC, datetime(COALESCE(p.published_at, p.created_at)) DESC';
    const listSql = `SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image, p.view_count, p.is_pinned, p.published_at, p.created_at, p.updated_at,
      c.id AS category_id, c.name AS category_name, c.slug AS category_slug
     FROM posts p ${joinClause} ${whereClause} ${orderBy} LIMIT ? OFFSET ?`;
    const listParams = [...params, limit, offset];
    const rows = db.prepare(listSql).all(...listParams);

    res.json({
      data: rows.map(mapPostRow),
      page,
      limit,
      total,
    });
  })
);

router.get(
  '/archive',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = db
      .prepare(
        `SELECT p.id, p.title, p.slug, p.published_at,
          strftime('%Y', COALESCE(p.published_at, p.created_at)) AS year,
          strftime('%m', COALESCE(p.published_at, p.created_at)) AS month
         FROM posts p
         WHERE p.status = 'published'
         ORDER BY year DESC, month DESC`
      )
      .all();

    const byYearMonth = {};
    for (const r of rows) {
      const y = r.year || '0000';
      const m = r.month || '01';
      if (!byYearMonth[y]) byYearMonth[y] = {};
      if (!byYearMonth[y][m]) byYearMonth[y][m] = [];
      byYearMonth[y][m].push({ id: r.id, title: r.title, slug: r.slug, publishedAt: r.published_at });
    }

    res.json({ data: byYearMonth });
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

    if (!row) throw new HttpError(404, '文章不存在');

    db.prepare('UPDATE posts SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ?').run(row.id);

    const tags = db
      .prepare(
        `SELECT t.id, t.name, t.slug FROM tags t
         INNER JOIN post_tags pt ON pt.tag_id = t.id
         WHERE pt.post_id = ? ORDER BY t.name`
      )
      .all(row.id);

    const ts = row.published_at || row.created_at;
    const prevRow = db
      .prepare(
        `SELECT slug, title FROM posts WHERE status = 'published' AND datetime(COALESCE(published_at, created_at)) < datetime(?)
         ORDER BY datetime(COALESCE(published_at, created_at)) DESC LIMIT 1`
      )
      .get(ts);
    const nextRow = db
      .prepare(
        `SELECT slug, title FROM posts WHERE status = 'published' AND datetime(COALESCE(published_at, created_at)) > datetime(?)
         ORDER BY datetime(COALESCE(published_at, created_at)) ASC LIMIT 1`
      )
      .get(ts);

    res.json({
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      bodyMd: row.body_md,
      bodyHtml: markdownToSafeHtml(row.body_md),
      status: row.status,
      coverImage: row.cover_image,
      viewCount: (row.view_count ?? 0) + 1,
      isPinned: !!row.is_pinned,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      category: row.category_id
        ? { id: row.category_id, name: row.category_name, slug: row.category_slug }
        : null,
      tags: tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
      prev: prevRow ? { slug: prevRow.slug, title: prevRow.title } : null,
      next: nextRow ? { slug: nextRow.slug, title: nextRow.title } : null,
    });
  })
);

function escapeXml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

router.get(
  '/feed.xml',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const baseUrl = (process.env.PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/$/, '');
    let siteTitle = '我的博客';
    let siteDesc = '';
    try {
      const rows = db.prepare('SELECT key, value FROM site_settings').all();
      for (const r of rows) {
        if (r.key === 'site_title') siteTitle = r.value || siteTitle;
        if (r.key === 'site_description') siteDesc = r.value || '';
      }
    } catch {
      // use defaults
    }
    const posts = db
      .prepare(
        `SELECT title, slug, excerpt, published_at FROM posts
         WHERE status = 'published'
         ORDER BY datetime(COALESCE(published_at, created_at)) DESC
         LIMIT 20`
      )
      .all();
    const items = posts
      .map(
        (p) => `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(baseUrl + '/post/' + p.slug)}</link>
      <description>${escapeXml(p.excerpt || '')}</description>
      <pubDate>${new Date(p.published_at || p.created_at).toUTCString()}</pubDate>
    </item>`
      )
      .join('');
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(siteTitle)}</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>${escapeXml(siteDesc)}</description>
    <language>zh-CN</language>${items}
  </channel>
</rss>`;
    res.type('application/rss+xml').send(rss);
  })
);

router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const { page, limit, offset } = parsePageLimit(req.query);
    const db = await getDb();

    if (!q) {
      res.json({ data: [], page: 1, limit: 10, total: 0 });
      return;
    }

    const term = `%${q}%`;
    const countRow = db
      .prepare(
        `SELECT COUNT(*) AS c FROM posts p
         WHERE p.status = 'published' AND (p.title LIKE ? OR p.excerpt LIKE ? OR p.body_md LIKE ?)`
      )
      .get(term, term, term);
    const total = countRow?.c ?? 0;

    const rows = db
      .prepare(
        `SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image, p.view_count, p.is_pinned, p.published_at, p.created_at, p.updated_at,
          c.id AS category_id, c.name AS category_name, c.slug AS category_slug
         FROM posts p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.status = 'published' AND (p.title LIKE ? OR p.excerpt LIKE ? OR p.body_md LIKE ?)
         ORDER BY p.is_pinned DESC, datetime(COALESCE(p.published_at, p.created_at)) DESC
         LIMIT ? OFFSET ?`
      )
      .all(term, term, term, limit, offset);

    res.json({
      data: rows.map(mapPostRow),
      page,
      limit,
      total,
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

router.get(
  '/links',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    try {
      const rows = db.prepare('SELECT id, title, url, sort FROM links ORDER BY sort ASC, id ASC').all();
      res.json({ data: rows });
    } catch {
      res.json({ data: [] });
    }
  })
);

module.exports = router;
