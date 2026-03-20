require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const session = require('express-session');

const { initDb } = require('./db');
const { errorHandler } = require('./middleware/errorHandler');
const { requireAuth } = require('./middleware/requireAuth');

const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const publicApiRouter = require('./routes/publicApi');
const adminRouter = require('./routes/admin');

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

if (isProd && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16)) {
  console.error('生产环境必须设置足够长的 SESSION_SECRET');
  process.exit(1);
}

const sessionSecret =
  process.env.SESSION_SECRET || 'dev-only-change-me-not-for-production';

if (!isProd && sessionSecret.includes('dev-only')) {
  console.warn('[警告] 使用开发环境默认 SESSION_SECRET，切勿用于生产');
}

const app = express();
app.set('trust proxy', 1);

const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
app.use(
  cors({
    origin: frontendOrigin,
    credentials: true,
  })
);

app.use(morgan(isProd ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));

app.use(
  session({
    name: 'blog.sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api', publicApiRouter);
app.use('/api/admin', requireAuth, adminRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use(errorHandler);

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.info(`Blog API 监听 http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('数据库初始化失败:', err);
    process.exit(1);
  });
