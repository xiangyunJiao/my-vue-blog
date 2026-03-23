import { Router } from 'express';
import { resolveSiteTitle } from '../config/site';
import { getDb } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import type { SqlRow } from '../db/types';

const router = Router();

function escapeXml(s: unknown): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const sendFeedXml = asyncHandler(async (_req, res) => {
  const db = await getDb();
  const baseUrl = (process.env.PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/$/, '');
  let dbSiteTitle: string | undefined;
  let siteDesc = '';
  try {
    const rows = db.prepare('SELECT key, value FROM site_settings').all();
    for (const r of rows) {
      const row = r as SqlRow;
      if (row.key === 'site_title') dbSiteTitle = String(row.value ?? '');
      if (row.key === 'site_description') siteDesc = String(row.value || '');
    }
  } catch {
    // use defaults
  }
  const siteTitle = resolveSiteTitle(dbSiteTitle);
  const posts = db
    .prepare(
      `SELECT title, slug, excerpt, published_at, created_at FROM posts
       WHERE status = 'published'
       ORDER BY datetime(COALESCE(published_at, created_at)) DESC
       LIMIT 20`
    )
    .all();
  const items = posts
    .map(
      (p) => `
    <item>
      <title>${escapeXml((p as SqlRow).title)}</title>
      <link>${escapeXml(baseUrl + '/post/' + String((p as SqlRow).slug))}</link>
      <description>${escapeXml((p as SqlRow).excerpt || '')}</description>
      <pubDate>${new Date(String((p as SqlRow).published_at || (p as SqlRow).created_at)).toUTCString()}</pubDate>
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
});

const sendSitemapXml = asyncHandler(async (_req, res) => {
  const baseUrl = (process.env.PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/$/, '');
  const db = await getDb();
  const postRows = db
    .prepare(
      `SELECT slug,
        strftime('%Y-%m-%d', datetime(COALESCE(updated_at, published_at, created_at))) AS lastmod
       FROM posts
       WHERE status = 'published'
       ORDER BY datetime(COALESCE(published_at, created_at)) DESC`
    )
    .all();

  type SitemapUrl = { loc: string; changefreq: string; priority: string; lastmod?: string };

  const staticUrls: SitemapUrl[] = [
    { loc: `${baseUrl}/`, changefreq: 'weekly', priority: '1.0' },
    { loc: `${baseUrl}/archive`, changefreq: 'weekly', priority: '0.8' },
    { loc: `${baseUrl}/about`, changefreq: 'monthly', priority: '0.7' },
    { loc: `${baseUrl}/search`, changefreq: 'monthly', priority: '0.5' },
  ];

  const postUrls: SitemapUrl[] = postRows.map((p) => {
    const row = p as SqlRow;
    return {
      loc: `${baseUrl}/post/${String(row.slug)}`,
      lastmod: row.lastmod ? String(row.lastmod) : undefined,
      changefreq: 'monthly',
      priority: '0.8',
    };
  });

  const urls: SitemapUrl[] = [...staticUrls, ...postUrls];
  const body = urls
    .map((u) => {
      const lastmodLine = u.lastmod ? `\n    <lastmod>${escapeXml(u.lastmod)}</lastmod>` : '';
      return `  <url>
    <loc>${escapeXml(u.loc)}</loc>${lastmodLine}
    <changefreq>${escapeXml(u.changefreq)}</changefreq>
    <priority>${escapeXml(u.priority)}</priority>
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
  res.type('application/xml').send(xml);
});

router.get('/rss', sendFeedXml);
router.get('/rss.xml', sendFeedXml);
router.get('/feed', sendFeedXml);
router.get('/feed.xml', sendFeedXml);
router.get('/sitemap', sendSitemapXml);
router.get('/sitemap.xml', sendSitemapXml);

export default router;
