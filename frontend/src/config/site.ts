import { SITE_NAME_DEFAULT } from '../../../config/site';

/**
 * 站点默认显示名。优先级：VITE_SITE_NAME → config/site.ts →（不应到达）字面兜底。
 */
export const SITE_NAME =
  (import.meta.env.VITE_SITE_NAME as string | undefined)?.trim() || SITE_NAME_DEFAULT;
