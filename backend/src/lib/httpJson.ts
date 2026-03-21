import type { Response } from 'express';
import type { ApiEnvelope } from '../types/apiEnvelope';

/** 标记为本博客 API 统一包络，便于与端口上其它进程返回的 `{ error: ... }` 区分 */
const ENVELOPE_HEADER = { 'X-Blog-Api': '1' } as const;

function applyEnvelopeHeaders(res: Response): void {
  for (const [k, v] of Object.entries(ENVELOPE_HEADER)) {
    res.setHeader(k, v);
  }
}

/**
 * 成功响应：`ec` 与 HTTP 状态码一致，`data` 为业务载荷。
 */
export function resSuccess<T>(res: Response, body: T, em = 'ok', httpStatus = 200): void {
  const payload: ApiEnvelope<T> = {
    ec: httpStatus,
    em,
    data: body === undefined || body === null ? ({} as T) : body,
  };
  applyEnvelopeHeaders(res);
  res.status(httpStatus).json(payload);
}

/**
 * 统一错误响应：ec=HTTP 状态码，em=纯文案（不含状态码），data 固定空对象。
 */
export function resError(res: Response, httpStatus: number, message?: string | null): void {
  const em =
    message === undefined || message === null || message === ''
      ? '请求失败'
      : String(message);
  applyEnvelopeHeaders(res);
  res.status(httpStatus).json({
    ec: httpStatus,
    em,
    data: {},
  });
}
