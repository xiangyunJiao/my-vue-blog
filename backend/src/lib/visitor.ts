import type { Request } from 'express';

/**
 * 前端在 localStorage 存 UUID v4，通过请求头 X-Blog-Visitor-Id 传递，用于点赞去重。
 */
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidVisitorId(s: unknown): boolean {
  return typeof s === 'string' && s.length <= 64 && UUID_V4.test(s.trim());
}

export function getVisitorIdFromReq(req: Request): string | null {
  const raw = req.get('x-blog-visitor-id');
  if (!raw || typeof raw !== 'string') return null;
  const id = raw.trim();
  return isValidVisitorId(id) ? id : null;
}
