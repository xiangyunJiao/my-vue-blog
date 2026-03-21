/**
 * 集成自测：临时 SQLite + 起服务 → 登录 → 分类创建 / 编辑 / 删除
 * 用法：在 backend 目录执行 node scripts/verify-category-admin.cjs
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const backendRoot = path.join(__dirname, '..');
const dbFile = path.join(os.tmpdir(), `blog-verify-cat-${Date.now()}.sqlite`);
const PORT = String(31000 + Math.floor(Math.random() * 900));

const tsxCli = path.join(backendRoot, 'node_modules/tsx/dist/cli.mjs');
const child = spawn(process.execPath, [tsxCli, 'src/index.ts'], {
  cwd: backendRoot,
  env: {
    ...process.env,
    PORT,
    NODE_ENV: 'development',
    SQLITE_PATH: dbFile,
    ADMIN_EMAIL: 'verify@local.test',
    ADMIN_PASSWORD: 'verifyPass12',
    SESSION_SECRET: 'verify-session-secret-32chars-min',
    FRONTEND_ORIGIN: 'http://localhost:5173',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderrBuf = '';
child.stderr.on('data', (d) => {
  stderrBuf += d.toString();
});
child.stdout.on('data', () => {});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 统一包络 `{ ec, em, body }` 与旧格式兼容 */
function unwrapApi(json) {
  if (json && typeof json === 'object' && 'body' in json && 'ec' in json) return json.body;
  return json;
}

function cookieFromResponse(res) {
  if (typeof res.headers.getSetCookie === 'function') {
    const parts = res.headers.getSetCookie();
    if (parts && parts.length) return parts.map((p) => p.split(';')[0]).join('; ');
  }
  const raw = res.headers.get('set-cookie');
  if (!raw) return '';
  return raw
    .split(/,(?=[^;]+?=)/)
    .map((p) => p.trim().split(';')[0])
    .join('; ');
}

async function waitForHealth(base) {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return;
    } catch (_) {
      /* retry */
    }
    await sleep(150);
  }
  throw new Error(`服务未就绪。stderr 末尾:\n${stderrBuf.slice(-800)}`);
}

async function main() {
  const base = `http://127.0.0.1:${PORT}`;
  await waitForHealth(base);

  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'verify@local.test', password: 'verifyPass12' }),
  });
  const loginBody = await loginRes.text();
  if (!loginRes.ok) {
    throw new Error(`登录失败 ${loginRes.status}: ${loginBody}`);
  }
  const cookies = cookieFromResponse(loginRes);
  if (!cookies.includes('blog.sid')) {
    throw new Error(`未拿到 session cookie: ${loginBody}`);
  }

  const authHeaders = { 'Content-Type': 'application/json', Cookie: cookies };

  const createRes = await fetch(`${base}/api/admin/categories/create`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: '验证分类', slug: 'verify-cat-slug' }),
  });
  const createJson = unwrapApi(JSON.parse(await createRes.text()));
  if (!createRes.ok) throw new Error(`创建分类失败: ${JSON.stringify(createJson)}`);
  const id = Number(createJson.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error(`无效 id: ${createJson.id}`);

  const editRes = await fetch(`${base}/api/admin/categories/edit`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ id, name: '验证已改', slug: 'verify-cat-edited' }),
  });
  const editJson = unwrapApi(JSON.parse(await editRes.text()));
  if (!editRes.ok) throw new Error(`编辑分类失败: ${JSON.stringify(editJson)}`);

  const listRes = await fetch(`${base}/api/categories`);
  const listJson = unwrapApi(JSON.parse(await listRes.text()));
  const row = (listJson.data || []).find((c) => Number(c.id) === id);
  if (!row || row.name !== '验证已改') {
    throw new Error(`列表与编辑结果不一致: ${JSON.stringify(row)}`);
  }

  const delRes = await fetch(`${base}/api/admin/categories/delete`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ id }),
  });
  const delJson = unwrapApi(JSON.parse(await delRes.text()));
  if (!delRes.ok) throw new Error(`删除分类失败: ${JSON.stringify(delJson)}`);

  const list2 = unwrapApi(JSON.parse(await (await fetch(`${base}/api/categories`)).text()));
  if ((list2.data || []).some((c) => Number(c.id) === id)) {
    throw new Error('删除后列表仍含该分类');
  }

  const tagCreateRes = await fetch(`${base}/api/admin/tags/create`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: '验证标签', slug: 'verify-tag-slug' }),
  });
  const tagCreateJson = unwrapApi(JSON.parse(await tagCreateRes.text()));
  if (!tagCreateRes.ok) throw new Error(`创建标签失败: ${JSON.stringify(tagCreateJson)}`);
  const tid = Number(tagCreateJson.id);
  const tagEditRes = await fetch(
    `${base}/api/admin/tags/edit?id=${encodeURIComponent(tid)}`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ id: tid, name: '验证标签已改', slug: 'verify-tag-edited' }),
    }
  );
  const tagEditJson = JSON.parse(await tagEditRes.text());
  if (!tagEditRes.ok) throw new Error(`编辑标签失败: ${JSON.stringify(tagEditJson)}`);
  const tagDelRes = await fetch(`${base}/api/admin/tags/delete`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ id: tid }),
  });
  const tagDelJson = JSON.parse(await tagDelRes.text());
  if (!tagDelRes.ok) throw new Error(`删除标签失败: ${JSON.stringify(tagDelJson)}`);

  const postCreateRes = await fetch(`${base}/api/admin/posts/create`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: '验证删除文章',
      slug: 'verify-post-del',
      body_md: 'x',
      status: 'draft',
    }),
  });
  const postCreateJson = unwrapApi(JSON.parse(await postCreateRes.text()));
  if (!postCreateRes.ok) throw new Error(`创建文章失败: ${JSON.stringify(postCreateJson)}`);
  const pid = Number(postCreateJson.id);
  const postDelRes = await fetch(`${base}/api/admin/posts/delete`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ id: pid }),
  });
  const postDelJson = unwrapApi(JSON.parse(await postDelRes.text()));
  if (!postDelRes.ok) throw new Error(`删除文章失败: ${JSON.stringify(postDelJson)}`);

  // eslint-disable-next-line no-console
  console.log('[verify-category-admin] 通过：分类、标签、文章删除（POST 删）');
}

main()
  .then(() => {
    child.kill('SIGTERM');
    setTimeout(() => {
      try {
        fs.unlinkSync(dbFile);
      } catch (_) {}
      process.exit(0);
    }, 400);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[verify-category-admin] 失败:', err.message);
    child.kill('SIGTERM');
    setTimeout(() => {
      try {
        fs.unlinkSync(dbFile);
      } catch (_) {}
      process.exit(1);
    }, 400);
  });
