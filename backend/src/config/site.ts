/**
 * 站点默认名称：数据库无 `site_title` 或读库异常时的回退。
 * 部署时可在 backend/.env 设置 SITE_NAME，与前端 VITE_SITE_NAME 保持一致。
 */
export const DEFAULT_SITE_NAME = (process.env.SITE_NAME || '').trim() || '我的博客';
