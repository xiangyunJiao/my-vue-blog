import { Router } from 'express';
import { getDb } from '../db';
import type { SqlRow } from '../db/types';
import { HttpError } from '../lib/errors';
import { markdownToSafeHtml } from '../lib/markdown';
import { getVisitorIdFromReq } from '../lib/visitor';
import { getHintForPostOnly } from '../lib/getMethodHint';
import { DEFAULT_SITE_NAME, resolveSiteTitle } from '../config/site';
import { readVisitStats } from '../lib/visitStats';
import { registerJsonRoute } from '../lib/apiRoute';

const router = Router();

function paramSlug(req: { params: { slug?: string | string[] } }): string {
  const s = req.params.slug;
  return Array.isArray(s) ? String(s[0] ?? '') : String(s ?? '');
}

function parsePageLimit(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(query.limit || '10'), 10) || 10));
  return { page, limit, offset: (page - 1) * limit };
}

function mapPostRow(r: SqlRow) {
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

registerJsonRoute(router, 'get', '/posts', async (ctx) => {
  const { page, limit, offset } = parsePageLimit(ctx.query);
  const category = typeof ctx.query.category === 'string' ? ctx.query.category.trim() : '';
  const tag = typeof ctx.query.tag === 'string' ? ctx.query.tag.trim() : '';
  const db = await getDb();

  let whereClause = "WHERE p.status = 'published'";
  let joinClause = 'LEFT JOIN categories c ON c.id = p.category_id';
  const params: unknown[] = [];

  if (tag) {
    joinClause +=
      ' INNER JOIN post_tags pt ON pt.post_id = p.id INNER JOIN tags t ON t.id = pt.tag_id AND t.slug = ?';
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
  const totalRow = db.prepare(countSql).get(...countParams) as { c: number } | null;
  const total = totalRow?.c ?? 0;

  const orderBy = 'ORDER BY p.is_pinned DESC, datetime(COALESCE(p.published_at, p.created_at)) DESC';
  const listSql = `SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image, p.view_count, p.is_pinned, p.published_at, p.created_at, p.updated_at,
      c.id AS category_id, c.name AS category_name, c.slug AS category_slug
     FROM posts p ${joinClause} ${whereClause} ${orderBy} LIMIT ? OFFSET ?`;
  const listParams = [...params, limit, offset];
  const rows = db.prepare(listSql).all(...listParams);

  return {
    data: rows.map((row) => mapPostRow(row as SqlRow)),
    page,
    limit,
    total,
  };
});

registerJsonRoute(router, 'get', '/archive', async () => {
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

  const byYearMonth: Record<string, Record<string, { id: unknown; title: unknown; slug: unknown; publishedAt: unknown }[]>> = {};
  for (const row of rows) {
    const r = row as SqlRow;
    const y = String(r.year || '0000');
    const m = String(r.month || '01');
    if (!byYearMonth[y]) byYearMonth[y] = {};
    if (!byYearMonth[y][m]) byYearMonth[y][m] = [];
    byYearMonth[y][m].push({
      id: r.id,
      title: r.title,
      slug: r.slug,
      publishedAt: r.published_at,
    });
  }

  return { data: byYearMonth };
});

registerJsonRoute(router, 'get', '/posts/:slug', async (ctx) => {
  const slug = paramSlug(ctx.req);
  const db = await getDb();
  const row = db
    .prepare(
      `SELECT p.*, c.id AS category_id, c.name AS category_name, c.slug AS category_slug
         FROM posts p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.slug = ? AND p.status = 'published'`
    )
    .get(slug) as SqlRow | null;

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
    .get(ts) as { slug: string; title: string } | null;
  const nextRow = db
    .prepare(
      `SELECT slug, title FROM posts WHERE status = 'published' AND datetime(COALESCE(published_at, created_at)) > datetime(?)
         ORDER BY datetime(COALESCE(published_at, created_at)) ASC LIMIT 1`
    )
    .get(ts) as { slug: string; title: string } | null;

  let likeCount = 0;
  let liked = false;
  let commentCount = 0;
  try {
    likeCount =
      (db.prepare('SELECT COUNT(*) AS c FROM post_likes WHERE post_id = ?').get(row.id) as { c: number } | null)?.c ?? 0;
    commentCount =
      (
        db
          .prepare(`SELECT COUNT(*) AS c FROM comments WHERE post_id = ? AND status = 'approved'`)
          .get(row.id) as { c: number } | null
      )?.c ?? 0;
    const vid = getVisitorIdFromReq(ctx.req);
    if (vid) {
      liked = !!db
        .prepare('SELECT 1 FROM post_likes WHERE post_id = ? AND visitor_id = ?')
        .get(row.id, vid);
    }
  } catch {
    // 旧库无表时忽略
  }

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    bodyMd: row.body_md,
    bodyHtml: markdownToSafeHtml(row.body_md),
    status: row.status,
    coverImage: row.cover_image,
    viewCount: (Number(row.view_count ?? 0) || 0) + 1,
    likeCount,
    liked,
    commentCount,
    isPinned: !!row.is_pinned,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    category: row.category_id
      ? { id: row.category_id, name: row.category_name, slug: row.category_slug }
      : null,
    tags: tags.map((t) => {
      const tr = t as SqlRow;
      return { id: tr.id, name: tr.name, slug: tr.slug };
    }),
    prev: prevRow ? { slug: prevRow.slug, title: prevRow.title } : null,
    next: nextRow ? { slug: nextRow.slug, title: nextRow.title } : null,
  };
});

registerJsonRoute(router, 'get', '/search', async (ctx) => {
  const q = typeof ctx.query.q === 'string' ? ctx.query.q.trim() : '';
  const { page, limit, offset } = parsePageLimit(ctx.query);
  const db = await getDb();

  if (!q) {
    return { data: [], page: 1, limit: 10, total: 0 };
  }

  const term = `%${q}%`;
  const countRow = db
    .prepare(
      `SELECT COUNT(*) AS c FROM posts p
         WHERE p.status = 'published' AND (p.title LIKE ? OR p.excerpt LIKE ? OR p.body_md LIKE ?)`
    )
    .get(term, term, term) as { c: number } | null;
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

  return {
    data: rows.map((row) => mapPostRow(row as SqlRow)),
    page,
    limit,
    total,
  };
});

registerJsonRoute(router, 'get', '/categories', async () => {
  const db = await getDb();
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.slug, c.created_at,
        (SELECT COUNT(*) FROM posts p WHERE p.category_id = c.id AND p.status = 'published') AS post_count
       FROM categories c
       ORDER BY c.name`
    )
    .all();
  return { data: rows };
});

registerJsonRoute(router, 'get', '/tags', async () => {
  const db = await getDb();
  const rows = db
    .prepare(
      `SELECT t.id, t.name, t.slug, t.created_at,
        (SELECT COUNT(*) FROM posts p
           INNER JOIN post_tags pt ON pt.post_id = p.id AND pt.tag_id = t.id
           WHERE p.status = 'published') AS post_count
       FROM tags t
       ORDER BY t.name`
    )
    .all();
  return { data: rows };
});

registerJsonRoute(router, 'get', '/site', async () => {
  const db = await getDb();
  try {
    const rows = db.prepare('SELECT key, value FROM site_settings').all();
    const settings: Record<string, unknown> = {};
    for (const r of rows) {
      const row = r as SqlRow;
      settings[String(row.key)] = row.value;
    }
    settings.site_title = resolveSiteTitle(settings.site_title);
    return settings;
  } catch {
    return {
      site_title: DEFAULT_SITE_NAME,
      site_description: '',
      about_content: '',
    };
  }
});

router.get(
  '/visit',
  getHintForPostOnly(
    '全站访问统计请使用 POST，并设置请求头 X-Blog-Visitor-Id（UUID v4）；从地址栏打开为 GET，不会写入统计。'
  )
);

/** POST /visit — 全站访问计数（每访客每 UTC 日最多 1 次），需 X-Blog-Visitor-Id */
registerJsonRoute(router, 'post', '/visit', async (ctx) => {
  const visitorId = getVisitorIdFromReq(ctx.req);
  if (!visitorId) {
    throw new HttpError(400, '请提供有效的 X-Blog-Visitor-Id 请求头（UUID）');
  }
  const db = await getDb();
  const day = new Date().toISOString().slice(0, 10);
  const ins = db.prepare('INSERT OR IGNORE INTO visit_daily_visitor (day, visitor_id) VALUES (?, ?)').run(day, visitorId);
  const counted = ins.changes > 0;
  if (counted) {
    db.prepare(
      `INSERT INTO visit_by_day (day, visits) VALUES (?, 1)
         ON CONFLICT(day) DO UPDATE SET visits = visits + 1`
    ).run(day);
    db.prepare('UPDATE visit_aggregates SET total_visits = total_visits + 1 WHERE id = 1').run();
  }
  const stats = readVisitStats(db);
  return { counted, totalVisits: stats.totalVisits, todayVisits: stats.todayVisits };
});

registerJsonRoute(router, 'get', '/links', async () => {
  const db = await getDb();
  try {
    const rows = db.prepare('SELECT id, title, url, sort FROM links ORDER BY sort ASC, id ASC').all();
    return { data: rows };
  } catch {
    return { data: [] };
  }
});

export default router;
