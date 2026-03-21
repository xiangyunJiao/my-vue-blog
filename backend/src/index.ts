import 'dotenv/config';

import { createApp } from './createApp';
import { initDb } from './db';

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

if (isProd && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16)) {
  console.error('生产环境必须设置足够长的 SESSION_SECRET');
  process.exit(1);
}

const sessionSecret = process.env.SESSION_SECRET || 'dev-only-change-me-not-for-production';

if (!isProd && sessionSecret.includes('dev-only')) {
  console.warn('[警告] 使用开发环境默认 SESSION_SECRET，切勿用于生产');
}

const app = createApp();

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.info(`Blog API 监听 http://localhost:${PORT}`);
    });
  })
  .catch((err: unknown) => {
    console.error('数据库初始化失败:', err);
    process.exit(1);
  });
