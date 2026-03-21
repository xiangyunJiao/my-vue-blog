/** sql.js 最小类型声明（官方包未带完整 .d.ts） */
declare module 'sql.js' {
  export interface Statement {
    bind(values?: unknown): void;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): void;
  }

  export interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null);
    run(sql: string, params?: unknown): void;
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    getRowsModified(): number;
  }

  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export default function initSqlJs(): Promise<SqlJsStatic>;
}
