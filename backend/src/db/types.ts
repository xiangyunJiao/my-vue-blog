/** sql.js 包装层：行数据为键值对象 */
export type SqlRow = Record<string, unknown>;

export interface RunResult {
  changes: number;
  lastInsertRowid?: number;
}

export interface PreparedStatement {
  get(...params: unknown[]): SqlRow | null;
  all(...params: unknown[]): SqlRow[];
  run(...params: unknown[]): RunResult;
}

export interface WrappedDatabase {
  prepare(sql: string): PreparedStatement;
  exec(sql: string): void;
  transaction<T>(fn: (...args: unknown[]) => T): (...args: unknown[]) => T;
}
