import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../createApp';
import { initDb, resetDbModuleState } from '../db';
import type { Express } from 'express';

const VISITOR = '550e8400-e29b-41d4-a716-446655440000';
const ADMIN_EMAIL = 'test-admin@example.com';
const ADMIN_PASSWORD = 'testpass123456';

let app: Express;
let agent: request.Agent;
let dbPath: string;

function ok<T>(res: request.Response, httpStatus = 200): T {
  expect(res.status).toBe(httpStatus);
  const b = res.body as { ec: number; data: T };
  expect(b.ec).toBe(httpStatus);
  return b.data;
}

beforeAll(async () => {
  dbPath = path.join(os.tmpdir(), `blog-api-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
  try {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  } catch {
    /* ignore */
  }
  process.env.SQLITE_PATH = dbPath;
  process.env.ADMIN_EMAIL = ADMIN_EMAIL;
  process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  process.env.SESSION_SECRET = 'test-session-secret-min-16-chars';
  process.env.NODE_ENV = 'test';
  process.env.FRONTEND_ORIGIN = 'http://127.0.0.1';
  resetDbModuleState();
  await initDb();
  app = createApp();
  agent = request.agent(app);
});

afterAll(() => {
  resetDbModuleState();
  try {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  } catch {
    /* ignore */
  }
});

describe('health & syndication', () => {
  it('GET /api/admin probe (no auth)', async () => {
    const res = await request(app).get('/api/admin');
    const body = ok<{ ok: boolean; message?: string }>(res);
    expect(body.ok).toBe(true);
  });

  it('GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-blog-api']).toBe('1');
    const body = ok<{ ok: boolean }>(res);
    expect(body.ok).toBe(true);
  });

  it('GET unknown path returns ec/em/data envelope (not ad-hoc error JSON)', async () => {
    const res = await request(app).get('/api/no-such-route-xyz');
    expect(res.status).toBe(404);
    expect(res.headers['x-blog-api']).toBe('1');
    const b = res.body as { ec: number; em: string; data: Record<string, unknown> };
    expect(b.ec).toBe(404);
    expect(typeof b.em).toBe('string');
    expect(b.data).toEqual({});
  });

  it('GET /api/rss', async () => {
    const res = await request(app).get('/api/rss').buffer(true);
    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'])).toMatch(/xml/);
    expect(res.text).toContain('<rss');
  });

  it('GET /api/sitemap', async () => {
    const res = await request(app).get('/api/sitemap').buffer(true);
    expect(res.status).toBe(200);
    expect(res.text).toContain('urlset');
  });
});

describe('visit stats', () => {
  it('GET /api/visit documents POST usage (browser address bar is GET)', async () => {
    const res = await request(app).get('/api/visit');
    const body = ok<{ exists: boolean; needMethod?: string; message?: string }>(res);
    expect(body.exists).toBe(true);
    expect(body.needMethod).toBe('POST');
  });

  it('POST /api/visit without visitor header', async () => {
    const res = await request(app).post('/api/visit').send({});
    expect(res.status).toBe(400);
    expect((res.body as { ec: number }).ec).toBe(400);
  });

  it('POST /api/visit counts once per visitor per day', async () => {
    const r1 = await request(app).post('/api/visit').set('X-Blog-Visitor-Id', VISITOR).send({});
    const b1 = ok<{ counted: boolean; totalVisits: number; todayVisits: number }>(r1);
    expect(b1.counted).toBe(true);
    expect(b1.totalVisits).toBeGreaterThanOrEqual(1);
    expect(b1.todayVisits).toBeGreaterThanOrEqual(1);

    const r2 = await request(app).post('/api/visit').set('X-Blog-Visitor-Id', VISITOR).send({});
    const b2 = ok<{ counted: boolean }>(r2);
    expect(b2.counted).toBe(false);
  });

  it('GET /api/site does not expose visit counts (admin only)', async () => {
    const res = await request(app).get('/api/site');
    const body = ok<Record<string, unknown>>(res);
    expect(body.totalVisits).toBeUndefined();
    expect(body.todayVisits).toBeUndefined();
  });
});

describe('auth', () => {
  it('GET /api/auth/login hints POST', async () => {
    const res = await request(app).get('/api/auth/login');
    const body = ok<{ exists: boolean; needMethod?: string }>(res);
    expect(body.exists).toBe(true);
    expect(body.needMethod).toBe('POST');
  });

  it('GET /api/auth/logout hints POST', async () => {
    const res = await request(app).get('/api/auth/logout');
    const body = ok<{ exists: boolean }>(res);
    expect(body.exists).toBe(true);
  });

  it('POST /api/auth/login wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'wrong-password-xxxxx' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login success', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const body = ok<{ user: { id: number; email: string } }>(res);
    expect(body.user.email).toBe(ADMIN_EMAIL);
  });

  it('GET /api/auth/me without session', async () => {
    const res = await request(app).get('/api/auth/me');
    const body = ok<{ user: null | { id: number } }>(res);
    expect(body.user).toBeNull();
  });
});

describe('admin CRUD with session', () => {
  it('login agent', async () => {
    const res = await agent.post('/api/auth/login').send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    ok(res);
  });

  it('GET /api/admin/posts/list with session returns POST hint (not 404)', async () => {
    const res = await agent.get('/api/admin/posts/list');
    const body = ok<{ exists: boolean; needMethod?: string }>(res);
    expect(body.exists).toBe(true);
    expect(body.needMethod).toBe('POST');
  });

  it('GET /api/auth/me with session', async () => {
    const res = await agent.get('/api/auth/me');
    const body = ok<{ user: { email: string } | null }>(res);
    expect(body.user?.email).toBe(ADMIN_EMAIL);
  });

  it('POST /api/admin/posts/list', async () => {
    const res = await agent.post('/api/admin/posts/list').send({ page: 1, limit: 10 });
    const body = ok<{ data: unknown[]; total: number }>(res);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST /api/admin/categories/create', async () => {
    const res = await agent.post('/api/admin/categories/create').send({ name: 'E2E分类', slug: 'e2e-cat' });
    ok(res, 201);
  });

  it('POST /api/admin/tags/create', async () => {
    const res = await agent.post('/api/admin/tags/create').send({ name: 'E2E标签', slug: 'e2e-tag' });
    ok(res, 201);
  });

  it('POST /api/admin/posts/create published', async () => {
    const res = await agent.post('/api/admin/posts/create').send({
      title: 'E2E 文章',
      slug: 'e2e-hello',
      body_md: '# Hi',
      status: 'published',
    });
    const body = ok<{ id: number; slug: string }>(res, 201);
    expect(body.slug).toBe('e2e-hello');
  });

  it('POST /api/admin/posts/detail', async () => {
    const listRes = await agent.post('/api/admin/posts/list').send({ limit: 20 });
    const list = ok<{ data: { id: number }[] }>(listRes);
    const id = list.data.find((p) => p.id)?.id ?? list.data[0]?.id;
    expect(id).toBeDefined();
    const res = await agent.post('/api/admin/posts/detail').send({ id });
    ok(res);
  });

  it('POST /api/admin/site/get includes visits', async () => {
    const res = await agent.post('/api/admin/site/get').send({});
    const body = ok<Record<string, unknown>>(res);
    expect(typeof body.totalVisits).toBe('number');
  });

  it('POST /api/admin/links/create', async () => {
    const res = await agent.post('/api/admin/links/create').send({ title: 'E2E', url: 'https://example.com', sort: 0 });
    ok(res, 201);
  });

  it('POST /api/admin/comments/list', async () => {
    const res = await agent.post('/api/admin/comments/list').send({});
    ok(res);
  });

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );

  it('POST /api/admin/upload', async () => {
    const res = await agent
      .post('/api/admin/upload')
      .attach('file', png, { filename: 't.png', contentType: 'image/png' });
    ok(res);
    const b = res.body as { data: { url: string } };
    expect(b.data.url).toMatch(/^\/uploads\//);
  });

  it('POST /api/auth/logout', async () => {
    const res = await agent.post('/api/auth/logout');
    ok(res);
  });
});

describe('public API with data', () => {
  beforeAll(async () => {
    const pub = request.agent(app);
    await pub.post('/api/auth/login').send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    await pub.post('/api/admin/posts/create').send({
      title: 'Public Read',
      slug: 'public-read',
      body_md: 'x',
      status: 'published',
    });
  });

  it('GET /api/posts', async () => {
    const res = await request(app).get('/api/posts');
    ok(res);
  });

  it('GET /api/posts/public-read', async () => {
    const res = await request(app).get('/api/posts/public-read');
    ok(res);
  });

  it('GET /api/archive', async () => {
    const res = await request(app).get('/api/archive');
    ok(res);
  });

  it('GET /api/search', async () => {
    const res = await request(app).get('/api/search').query({ q: 'Public' });
    ok(res);
  });

  it('GET /api/categories', async () => {
    const res = await request(app).get('/api/categories');
    ok(res);
  });

  it('GET /api/tags', async () => {
    const res = await request(app).get('/api/tags');
    ok(res);
  });

  it('GET /api/links', async () => {
    const res = await request(app).get('/api/links');
    ok(res);
  });

  it('GET /api/posts/public-read/comments', async () => {
    const res = await request(app).get('/api/posts/public-read/comments');
    ok(res);
  });

  it('POST /api/posts/public-read/comments', async () => {
    const res = await request(app).post('/api/posts/public-read/comments').send({
      authorName: 't',
      body: 'hello comment e2e',
    });
    const body = ok<{ id: unknown; message: string }>(res, 201);
    expect(body.message).toBeTruthy();
  });

  it('POST /api/posts/public-read/comments with parentId', async () => {
    const listRes = await request(app).get('/api/posts/public-read/comments');
    const listBody = ok<{ data: { id: number }[] }>(listRes);
    const parentId = listBody.data[0]?.id;
    expect(parentId).toBeDefined();
    const res = await request(app)
      .post('/api/posts/public-read/comments')
      .send({
        authorName: 'replier',
        body: 'reply to parent',
        parentId,
      });
    ok(res, 201);
  });

  it('POST /api/posts/public-read/comments as logged-in admin reply without authorName', async () => {
    const logged = request.agent(app);
    await logged.post('/api/auth/login').send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const listRes = await request(app).get('/api/posts/public-read/comments');
    const listBody = ok<{ data: { id: number }[] }>(listRes);
    const parentId = listBody.data[0]?.id;
    expect(parentId).toBeDefined();
    const res = await logged.post('/api/posts/public-read/comments').send({
      body: 'owner reply without client nickname',
      parentId,
    });
    ok(res, 201);
  });

  it('POST like', async () => {
    const res = await request(app)
      .post('/api/posts/public-read/like')
      .set('X-Blog-Visitor-Id', VISITOR)
      .send({});
    ok(res);
  });

  it('GET /api/posts/public-read/like hints POST', async () => {
    const res = await request(app).get('/api/posts/public-read/like');
    const body = ok<{ exists: boolean; needMethod?: string }>(res);
    expect(body.exists).toBe(true);
    expect(body.needMethod).toBe('POST');
  });
});

describe('admin without auth', () => {
  it('POST /api/admin/posts/list -> 401', async () => {
    const res = await request(app).post('/api/admin/posts/list').send({});
    expect(res.status).toBe(401);
  });
});

/** 依赖 public API 已产生已发布文章与公开留言 */
describe('admin extended mutations', () => {
  let a: request.Agent;

  beforeAll(async () => {
    a = request.agent(app);
    await a.post('/api/auth/login').send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  });

  it('POST /api/admin/comments/list approved', async () => {
    const res = await a.post('/api/admin/comments/list').send({ status: 'approved' });
    const body = ok<{ data: { id: number }[] }>(res);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('POST /api/admin/comments/edit rejected then approved', async () => {
    const listRes = await a.post('/api/admin/comments/list').send({ status: 'approved' });
    const list = ok<{ data: { id: number }[] }>(listRes);
    const id = list.data[0].id;
    const res1 = await a.post('/api/admin/comments/edit').send({ id, status: 'rejected' });
    ok(res1);
    const res2 = await a.post('/api/admin/comments/edit').send({ id, status: 'approved' });
    ok(res2);
  });

  it('POST /api/admin/posts/update', async () => {
    const listRes = await a.post('/api/admin/posts/list').send({ limit: 20 });
    const list = ok<{ data: { id: number; title: string }[] }>(listRes);
    const post = list.data.find((p) => String(p.title).includes('E2E'));
    expect(post).toBeDefined();
    const res = await a.post('/api/admin/posts/update').send({
      id: post!.id,
      title: 'E2E 文章已更新',
      body_md: '# Hi',
      status: 'published',
    });
    ok(res);
  });

  it('POST /api/admin/site/update', async () => {
    const res = await a.post('/api/admin/site/update').send({
      site_title: 'E2E 博客标题',
      site_description: 'e2e desc',
    });
    ok(res);
  });

  it('POST /api/admin/categories/edit', async () => {
    const listRes = await a.post('/api/admin/categories/list').send({});
    const list = ok<{ data: { id: number; slug: string }[] }>(listRes);
    const cat = list.data.find((c) => c.slug === 'e2e-cat');
    expect(cat).toBeDefined();
    const res = await a.post('/api/admin/categories/edit').send({
      id: cat!.id,
      name: 'E2E分类改名',
      slug: 'e2e-cat',
    });
    ok(res);
  });

  it('POST /api/admin/tags/edit', async () => {
    const listRes = await a.post('/api/admin/tags/list').send({});
    const list = ok<{ data: { id: number; slug: string }[] }>(listRes);
    const tag = list.data.find((t) => t.slug === 'e2e-tag');
    expect(tag).toBeDefined();
    const res = await a.post('/api/admin/tags/edit').send({
      id: tag!.id,
      name: 'E2E标签改名',
      slug: 'e2e-tag',
    });
    ok(res);
  });

  it('POST /api/admin/links/list & edit', async () => {
    const listRes = await a.post('/api/admin/links/list').send({});
    const list = ok<{ data: { id: number }[] }>(listRes);
    expect(list.data.length).toBeGreaterThan(0);
    const id = list.data[0].id;
    const res = await a.post('/api/admin/links/edit').send({
      id,
      title: 'E2E改',
      url: 'https://example.org',
      sort: 1,
    });
    ok(res);
  });

  it('POST /api/admin/posts/delete draft', async () => {
    const slug = `del-${Date.now()}`;
    const c = await a.post('/api/admin/posts/create').send({
      title: '待删草稿',
      slug,
      body_md: 'x',
      status: 'draft',
    });
    const id = ok<{ id: number }>(c, 201).id;
    const res = await a.post('/api/admin/posts/delete').send({ id });
    ok(res);
  });

  it('POST /api/admin/comments/delete', async () => {
    const listRes = await a.post('/api/admin/comments/list').send({});
    const list = ok<{ data: { id: number }[] }>(listRes);
    expect(list.data.length).toBeGreaterThan(0);
    const id = list.data[0].id;
    const res = await a.post('/api/admin/comments/delete').send({ id });
    ok(res);
  });

  it('POST /api/admin/links/delete', async () => {
    const listRes = await a.post('/api/admin/links/list').send({});
    const list = ok<{ data: { id: number }[] }>(listRes);
    expect(list.data.length).toBeGreaterThan(0);
    const id = list.data[list.data.length - 1].id;
    const res = await a.post('/api/admin/links/delete').send({ id });
    ok(res);
  });
});
