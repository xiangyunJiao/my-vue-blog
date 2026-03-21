import type { AxiosRequestConfig } from 'axios';
import { api, postJson, postMultipart } from './httpClient';

/**
 * 与后端约定一致的 HTTP 方法（大写便于与 axios 对齐）。
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions<
  TParams extends Record<string, unknown> = Record<string, unknown>,
  TBody extends Record<string, unknown> = Record<string, unknown>,
> {
  /** 相对路径，须来自 `paths.ts` */
  url: string;
  method?: HttpMethod;
  /** GET 查询参数；其它方法需要带 query 时也可使用 */
  params?: TParams;
  /** JSON 请求体（POST/PUT/PATCH） */
  data?: TBody;
  config?: AxiosRequestConfig;
}

/**
 * 统一发请求：返回 **已解包后的业务数据**（与 axios 拦截器配合，成功时即为包络里的 `data`）。
 * - GET：无 JSON Content-Type
 * - POST JSON：`postJson`，默认 body `{}`
 * - multipart：请直接用 `postMultipart`，不走本方法
 */
export async function request<T = unknown>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', params, data, config } = options;
  const m = method.toUpperCase();

  if (m === 'GET') {
    const res = await api.get<T>(url, { ...config, params });
    return res.data as T;
  }

  if (m === 'POST') {
    const res = await postJson<T>(url, (data ?? {}) as Record<string, unknown>, {
      ...config,
      params: params as Record<string, unknown> | undefined,
    });
    return res.data as T;
  }

  if (m === 'PUT' || m === 'PATCH') {
    const res = await api.request<T>({
      url,
      method: m,
      data: data ?? {},
      ...config,
      params,
      headers: {
        'Content-Type': 'application/json',
        ...(config?.headers && typeof config.headers === 'object' && !Array.isArray(config.headers)
          ? (config.headers as Record<string, string>)
          : {}),
      },
    });
    return res.data as T;
  }

  if (m === 'DELETE') {
    const res = await api.delete<T>(url, { ...config, params });
    return res.data as T;
  }

  throw new Error(`不支持的 method: ${method}`);
}

export { postMultipart };
