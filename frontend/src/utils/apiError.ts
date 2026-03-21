/**
 * 将 API 错误格式化为展示给用户的文案（后端 `{ ec, em, body }`，不包含状态码前缀）。
 */
export function formatApiError(err: unknown, fallback = '请求失败'): string {
  const res =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: unknown } }).response
      : null;
  if (!res) {
    if (err && typeof err === 'object') {
      const e = err as { code?: string; message?: string };
      if (e.code === 'ERR_CANCELED') return fallback;
      if (e.message === 'Network Error') return `网络异常，${fallback}`;
    }
    return fallback;
  }
  const data = res.data;
  if (data && typeof data === 'object') {
    const d = data as { em?: unknown; error?: unknown };
    if (typeof d.em === 'string' && d.em.trim()) {
      return d.em.trim();
    }
    if (typeof d.error === 'string' && d.error.trim()) {
      return d.error.trim();
    }
  }
  return fallback;
}
