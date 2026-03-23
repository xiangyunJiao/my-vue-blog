import { SITE_NAME_DEFAULT } from '../../../config/site';

/**
 * 站点默认显示名。优先级：VITE_SITE_NAME → config/site.ts → 数据库 site_title（由 Layout 在运行时回退）。
 */
export const SITE_NAME =
  (import.meta.env.VITE_SITE_NAME as string | undefined)?.trim() || SITE_NAME_DEFAULT;
