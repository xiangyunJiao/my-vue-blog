import type { Response } from 'express';

/**
 * 统一错误响应：ec=HTTP 状态码，em=纯文案（不含状态码），body 固定对象（成功场景由业务自行填充）。
 */
export function resError(res: Response, httpStatus: number, message?: string | null): void {
  const em =
    message === undefined || message === null || message === ''
      ? '请求失败'
      : String(message);
  res.status(httpStatus).json({
    ec: httpStatus,
    em,
    body: {},
  });
}
