import type { WrappedDatabase } from '../db/types';

/** 使用 UTC 日期，与 POST /api/visit 统计口径一致 */
export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function readVisitStats(db: WrappedDatabase): { totalVisits: number; todayVisits: number } {
  const day = utcToday();
  let totalVisits = 0;
  let todayVisits = 0;
  try {
    const totalRow = db.prepare('SELECT total_visits FROM visit_aggregates WHERE id = 1').get() as
      | { total_visits: number }
      | null;
    totalVisits = totalRow?.total_visits ?? 0;
  } catch {
    /* 表未迁移时忽略 */
  }
  try {
    const dayRow = db.prepare('SELECT visits FROM visit_by_day WHERE day = ?').get(day) as { visits: number } | null;
    todayVisits = dayRow?.visits ?? 0;
  } catch {
    /* 表未迁移时忽略 */
  }
  return { totalVisits, todayVisits };
}
