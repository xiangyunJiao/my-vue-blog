/** 与后端一致的统一 JSON 包络 */
export interface ApiEnvelope<T = unknown> {
  ec: number;
  em: string;
  data: T;
}

export function isApiEnvelope(d: unknown): d is ApiEnvelope {
  return (
    typeof d === 'object' &&
    d !== null &&
    'ec' in d &&
    'em' in d &&
    'data' in d &&
    typeof (d as ApiEnvelope).ec === 'number' &&
    typeof (d as ApiEnvelope).em === 'string'
  );
}
