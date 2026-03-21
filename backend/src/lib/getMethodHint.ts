import type { NextFunction, Request, Response } from 'express';
import { resSuccess } from './httpJson';

/** 浏览器地址栏只会发 GET；对仅支持 POST 的接口返回说明，避免被误认为「路由不存在」。 */
export function getHintForPostOnly(message: string) {
  return (req: Request, res: Response): void => {
    resSuccess(res, {
      exists: true,
      needMethod: 'POST',
      path: req.originalUrl.split('?')[0],
      message,
    });
  };
}

/**
 * 挂在 admin Router 最后：凡未被具体路由处理的 GET，返回统一说明（OPTIONS/HEAD 交给后续）。
 */
export function adminRouterGetFallback(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'OPTIONS' || req.method === 'HEAD') {
    next();
    return;
  }
  if (req.method === 'GET') {
    resSuccess(res, {
      exists: true,
      needMethod: 'POST',
      path: req.originalUrl.split('?')[0],
      message:
        '管理端接口须先登录（Session Cookie），并统一使用 POST + JSON 请求体（图片上传为 multipart/form-data，字段名 file）。浏览器地址栏只会发 GET；示例：POST /api/admin/categories/list，body: {}。',
    });
    return;
  }
  next();
}
