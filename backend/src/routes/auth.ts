import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { getDb } from '../db';
import type { SqlRow } from '../db/types';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../lib/errors';
import { resError } from '../lib/httpJson';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    resError(res, 429, '登录尝试过于频繁，请稍后再试');
  },
});

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
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

    req.session.userId = user.id;
    req.session.email = user.email;
    res.json({ user: { id: user.id, email: user.email } });
  })
);

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      resError(res, 500, '退出登录失败');
      return;
    }
    res.clearCookie('blog.sid', { path: '/' });
    res.json({ ok: true });
  });
});

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.session.userId) {
      res.json({ user: null });
      return;
    }
    const db = await getDb();
    const user = db
      .prepare('SELECT id, email, created_at FROM users WHERE id = ?')
      .get(req.session.userId) as SqlRow | null;
    res.json({ user: user || null });
  })
);

export default router;
