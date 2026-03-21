import type { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { resSuccess } from './httpJson';

/** 标记为「显式 em / HTTP 状态码」的成功载荷，避免与普通业务对象混淆 */
const kPayload = Symbol('blog.api.payload');

export type ApiPayload<T> = {
  [kPayload]: true;
  data: T;
  em: string;
  httpStatus: number;
};

/**
 * 显式指定写入包络的 `em` 与 HTTP 状态码（如 201）。
 * 普通 `return { foo: 1 }` 等价于 `em: 'ok'`、`status: 200`。
 */
export function payload<T>(data: T, em = 'ok', httpStatus = 200): ApiPayload<T> {
  return { [kPayload]: true, data, em, httpStatus };
}

function isPayload(x: unknown): x is ApiPayload<unknown> {
  return typeof x === 'object' && x !== null && kPayload in x && (x as ApiPayload<unknown>)[kPayload] === true;
}

/**
 * 统一请求上下文（大厂常见：handler 只依赖入参，不直接操作 `res.write`）。
 * - `body`：已解析的 JSON（非 JSON 请求体可能为空对象）
 * - `query`：查询串
 * - `params`：路径参数
 */
export interface ApiContext {
  req: Request;
  res: Response;
  query: Record<string, unknown>;
  body: Record<string, unknown>;
  params: Record<string, string>;
}

function toContext(req: Request, res: Response): ApiContext {
  const rawBody = req.body;
  const body =
    rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
      ? (rawBody as Record<string, unknown>)
      : {};
  return {
    req,
    res,
    query: req.query as Record<string, unknown>,
    body,
    params: req.params as Record<string, string>,
  };
}

export type JsonRouteHandler = (ctx: ApiContext) => Promise<unknown>;

/**
 * 将「返回 Promise&lt;业务数据&gt;」的处理器包装为 Express RequestHandler：
 * - 成功：统一 `resSuccess` 写入 `{ ec, em, data }`
 * - 异常：`asyncHandler` 交给全局 `errorHandler`
 */
export function wrapJsonHandler(handler: JsonRouteHandler): RequestHandler {
  return asyncHandler(async (req, res) => {
    const out = await handler(toContext(req, res));
    if (isPayload(out)) {
      resSuccess(res, out.data, out.em, out.httpStatus);
    } else {
      resSuccess(res, out);
    }
  });
}

export type HttpMethodLower = 'get' | 'post' | 'put' | 'patch' | 'delete';

/**
 * 注册 JSON 路由：`handler` 返回 Promise，由包装器统一写 `{ ec, em, data }`。
 * `before` 为前置中间件（如 rateLimit、multer），在业务 handler 之前执行。
 */
export function registerJsonRoute(
  router: Router,
  method: HttpMethodLower,
  path: string,
  handler: JsonRouteHandler,
  before: RequestHandler[] = []
): void {
  const core = wrapJsonHandler(handler);
  (router[method] as (p: string, ...h: RequestHandler[]) => void)(path, ...before, core);
}
