/** 统一 JSON 响应：`ec` 与 HTTP 状态码一致，`data` 为业务数据 */
export interface ApiEnvelope<T = unknown> {
  ec: number;
  em: string;
  data: T;
}
