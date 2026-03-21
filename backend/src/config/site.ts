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
 * 站点默认名称：数据库无 `site_title` 或读库异常时的回退。
 * 优先级：SITE_NAME → config/site.ts → 兜底（仅文件缺失/解析失败）。
 */
export const DEFAULT_SITE_NAME =
  (process.env.SITE_NAME || '').trim() || readSiteNameFromRepoConfig() || '小云的随笔集';
