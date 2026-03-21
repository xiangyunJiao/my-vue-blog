import type { RequestHandler } from 'express';
import { HttpError } from '../lib/errors';

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.session || !req.session.userId) {
    next(new HttpError(401, '需要登录'));
    return;
  }
  next();
};
