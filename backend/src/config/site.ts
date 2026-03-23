import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 解析仓库根目录 `config/site.ts` 中的 `SITE_NAME_DEFAULT = '...'`（与 Node 共用源码，避免重复字面量）。
 */
function readSiteNameFromRepoConfig(): string | null {
  const p = join(__dirname, '../../../config/site.ts');
  if (!existsSync(p)) return null;
  try {
    const src = readFileSync(p, 'utf8');
    const m = src.match(/export const SITE_NAME_DEFAULT\s*=\s*['"]([^'"]+)['"]/);
    const n = m?.[1]?.trim();
    return n || null;
  } catch {
    return null;
  }
}

/**
 * 站点默认名称（对外展示时优先于数据库中的 `site_title`）。
 * 优先级：SITE_NAME 环境变量 → config/site.ts → 兜底字面量。
 */
export const DEFAULT_SITE_NAME =
  (process.env.SITE_NAME || '').trim() || readSiteNameFromRepoConfig() || '爱编程的小云';

/**
 * 对外展示的站点标题：`DEFAULT_SITE_NAME` 优先，库内 `site_title` 仅在其为空时作为回退。
 */
export function resolveSiteTitle(dbStoredTitle: unknown): string {
  const primary = DEFAULT_SITE_NAME.trim();
  if (primary) return primary;
  return String(dbStoredTitle ?? '').trim();
}
