/**
 * 认证路由：挂载在 `/api/auth`（见 registerRoutes），本文件内路径勿再写 `/api/auth` 前缀。
 */
import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { getDb } from '../db';
import type { SqlRow } from '../db/types';
import { HttpError } from '../lib/errors';
import { getHintForPostOnly } from '../lib/getMethodHint';
import { resError } from '../lib/httpJson';
import { payload, registerJsonRoute, wrapJsonHandler } from '../lib/apiRoute';

const router = Router();

router.get('/login', getHintForPostOnly('登录请使用 POST，JSON body: { "email", "password" }。'));
router.get('/logout', getHintForPostOnly('退出登录请使用 POST /api/auth/logout。'));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    resError(res, 429, '登录尝试过于频繁，请稍后再试');
  },
});

registerJsonRoute(
  router,
  'post',
  '/login',
  async (ctx) => {
    const body = ctx.body;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) {
      throw new HttpError(400, '请提供 email 与 password');
    }

    const db = await getDb();
    const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email) as
      | (SqlRow & { id: number; email: string; password_hash: string })
      | null;
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      throw new HttpError(401, '邮箱或密码错误');
    }

    ctx.req.session.userId = user.id;
    ctx.req.session.email = user.email;
    return payload({ user: { id: user.id, email: user.email } }, '登录成功');
  },
  [loginLimiter]
);

router.post(
  '/logout',
  wrapJsonHandler(async (ctx) => {
    await new Promise<void>((resolve, reject) => {
      ctx.req.session.destroy((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    ctx.res.clearCookie('blog.sid', { path: '/' });
    return payload({ ok: true }, '已退出');
  })
);

registerJsonRoute(router, 'get', '/me', async (ctx) => {
  if (!ctx.req.session.userId) {
    return { user: null };
  }
  const db = await getDb();
  const user = db
    .prepare('SELECT id, email, created_at FROM users WHERE id = ?')
    .get(ctx.req.session.userId) as SqlRow | null;
  return { user: user || null };
});

export default router;
