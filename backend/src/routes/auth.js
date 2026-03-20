const { Router } = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../db');
const { asyncHandler } = require('../middleware/asyncHandler');
const { HttpError } = require('../lib/errors');

const router = Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      throw new HttpError(400, '请提供 email 与 password');
    }

    const db = await getDb();
    const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email);
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
      res.status(500).json({ error: '退出登录失败' });
      return;
    }
    res.clearCookie('connect.sid', { path: '/' });
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
      .get(req.session.userId);
    res.json({ user: user || null });
  })
);

module.exports = router;
