import path from 'path';
import type { Express } from 'express';
import express from 'express';

import { resSuccess } from '../lib/httpJson';
import { requireAuth } from '../middleware/requireAuth';

import syndicationRouter from './syndication';
import healthRouter from './health';
import postInteractionsRouter from './postInteractions';
import authRouter from './auth';
import publicApiRouter from './publicApi';
import adminRouter from './admin';
import uploadRouter from './upload';

/**
 * 统一挂载 API 与静态资源（顺序敏感：更具体的前缀先于宽泛的 `/api`）。
 * 与前端 `frontend/src/api/paths.ts` 中的路径约定保持一致。
 */
export function registerRoutes(app: Express): void {
  app.use('/uploads', express.static(path.join(__dirname, '..', '..', 'uploads')));

  app.get('/api/admin', (_req, res) => {
    resSuccess(res, {
      ok: true,
      message: '管理 API 已挂载；请登录后 POST 子路径，例如 /api/admin/categories/list',
    });
  });

  /** 公开：登录 / 退出 / me，路径形如 /api/auth/login（无 requireAuth） */
  app.use('/api/auth', authRouter);
  /**
   * 管理端：在挂载点前统一 requireAuth（未登录 → 401 `{ ec:401, em:'需要登录' }`，不是 404）。
   * 与 auth 的差异仅在此：auth 路由不需要先登录；admin 下除根 GET /api/admin 探针外均需 Session。
   */
  app.use('/api/admin/upload', requireAuth, uploadRouter);
  app.use('/api/admin', requireAuth, adminRouter);

  app.use('/api', syndicationRouter);
  app.use('/api', healthRouter);
  app.use('/api', postInteractionsRouter);
  app.use('/api', publicApiRouter);
}
