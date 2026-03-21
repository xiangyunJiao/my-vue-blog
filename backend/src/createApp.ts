import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import session from 'express-session';

import { errorHandler } from './middleware/errorHandler';
import { resError } from './lib/httpJson';
import { registerRoutes } from './routes/registerRoutes';

/**
 * 组装 Express 应用：全局中间件 → 注册路由 → 404 → 错误处理。
 * 路由挂载顺序见 `routes/registerRoutes.ts`。
 */
export function createApp(): express.Application {
  const isProd = process.env.NODE_ENV === 'production';
  const sessionSecret = process.env.SESSION_SECRET || 'dev-only-change-me-not-for-production';

  const app = express();
  app.set('trust proxy', 1);

  const corsOriginsRaw = process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173';
  const corsOriginList = corsOriginsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const corsOrigin: string | string[] | boolean =
    corsOriginList.length === 0
      ? true
      : corsOriginList.length === 1
        ? corsOriginList[0]
        : corsOriginList;

  app.use(
    cors({
      origin: corsOrigin,
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

  registerRoutes(app);

  app.use((req, res) => {
    const msg = isProd ? 'Not Found' : `Not Found: ${req.method} ${req.originalUrl}`;
    resError(res, 404, msg);
  });

  app.use(errorHandler);

  return app;
}
