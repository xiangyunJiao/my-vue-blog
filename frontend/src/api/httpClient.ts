import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { isApiEnvelope } from '../types/api';

/**
 * 规范化 API 根地址：
 * - 去掉首尾空白、去掉末尾 `/`
 * - 若误写成 `.../api`（而业务路径里已含 `/api/...`），axios 会拼出 `/api/api/...` 导致后端 404
 */
function normalizeApiBase(raw: string | undefined): string {
  if (raw == null) return '';
  let s = String(raw).trim();
  if (s === '') return '';
  s = s.replace(/\/+$/, '');
  if (s.endsWith('/api')) {
    s = s.slice(0, -4).replace(/\/+$/, '');
  }
  return s;
}

const baseURL = normalizeApiBase(import.meta.env.VITE_API_BASE);

/**
 * 不在实例上写默认 `Content-Type`：
 * - GET 不应带 `application/json`（少数代理/网关对带 body 相关头的 GET 处理异常）
 * - JSON POST 由 `postJson` 显式设置
 * - multipart 由浏览器自动带 boundary
 */
export const api: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.response.use((response: AxiosResponse) => {
  const d = response.data;
  if (isApiEnvelope(d)) {
    if (d.ec >= 400) {
      return Promise.reject(
        Object.assign(new Error(d.em || '请求失败'), {
          response: { ...response, data: d },
          config: response.config,
          isAxiosError: true,
        })
      );
    }
    response.data = d.data;
  }
  return response;
});

function genUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function ensureBlogVisitorId(): string | null {
  if (typeof window === 'undefined') return null;
  let id = localStorage.getItem('blog_visitor_id');
  if (!id) {
    id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : genUuidV4();
    localStorage.setItem('blog_visitor_id', id);
  }
  return id;
}

api.interceptors.request.use((config) => {
  const vid = ensureBlogVisitorId();
  if (vid) {
    config.headers['X-Blog-Visitor-Id'] = vid;
  }
  return config;
});

/**
 * 统一 JSON POST（管理端、登录、点赞、留言等）。
 * - `body` 默认为 `{}`，避免 `post(url)` 无 body 时部分环境下序列化/代理异常
 * - 显式 `Content-Type: application/json` + `data` 为对象，由 axios 负责序列化
 */
export function postJson<T = unknown>(
  url: string,
  body: Record<string, unknown> = {},
  config?: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  return api.post<T>(url, body, {
    ...config,
    headers: {
      'Content-Type': 'application/json',
      ...(config?.headers && typeof config.headers === 'object' && !Array.isArray(config.headers)
        ? (config.headers as Record<string, string>)
        : {}),
    },
  });
}

/** 文件上传：不要手动设 Content-Type，以便带上 multipart boundary */
export function postMultipart<T = unknown>(
  url: string,
  formData: FormData,
  config?: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  return api.post<T>(url, formData, config);
}
