import type { ErrorRequestHandler } from 'express';
import { resError } from '../lib/httpJson';

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const status = (err as { status?: number; statusCode?: number }).status ||
    (err as { statusCode?: number }).statusCode ||
    500;
  const isProd = process.env.NODE_ENV === 'production';
  const message =
    status === 500 && isProd
      ? '服务器内部错误'
      : (err as Error).message || '服务器内部错误';

  if (status >= 500) {
    console.error(err);
  }

  resError(res, status, message);
};
