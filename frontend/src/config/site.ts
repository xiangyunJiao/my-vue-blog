/** 默认站点名；可被管理后台站点设置覆盖；改名字请配 VITE_SITE_NAME（与后端 SITE_NAME 一致） */
export const SITE_NAME = (import.meta.env.VITE_SITE_NAME as string | undefined)?.trim() || '我的博客';
