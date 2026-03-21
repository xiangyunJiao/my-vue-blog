import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import bcrypt from 'bcrypt';
import type { SqlRow, WrappedDatabase } from './types';

let dbInstance: WrappedDatabase | null = null;
/** 并发首次 getDb 时必须共用同一 Promise，否则会创建多个 SQL.Database，列表与更新落在不同内存库上（表现为「分类不存在」） */
let dbLoadPromise: Promise<WrappedDatabase> | null = null;
/** sql.js 原生实例，用于 export / PRAGMA */
let rawDb: import('sql.js').Database | null = null;
let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;
/** sql.js：db.export() 会结束当前事务；事务进行中的 run 不得 persist，否则 COMMIT 失败 */
let sqlJsTxDepth = 0;

function getDbPath(): string {
  const raw = process.env.SQLITE_PATH || path.join(__dirname, '../../data/blog.sqlite');
  return path.isAbsolute(raw) ? raw : path.resolve(__dirname, '../..', raw);
}

function ensureDataDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function persist(): void {
  if (!rawDb) return;
  const dbPath = getDbPath();
  ensureDataDir(dbPath);
  const data = rawDb.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  // sql.js：export() 会把当前连接的 foreign_keys 关掉，必须在每次落盘后重新打开，否则外键永不校验
  rawDb.run('PRAGMA foreign_keys = ON');
}

/** sql.js：单参数且为普通对象时使用命名绑定；否则用数组按位置绑定 */
function normalizeBindParams(params: unknown[]): unknown[] | Record<string, unknown> | undefined {
  if (params.length === 0) return undefined;
  if (
    params.length === 1 &&
    params[0] !== null &&
    typeof params[0] === 'object' &&
    !Array.isArray(params[0])
  ) {
    return params[0] as Record<string, unknown>;
  }
  return params;
}

/**
 * sql.js 的命名占位符要求 bind 对象的键与 SQL 一致（如 @title），
 * 不能像 better-sqlite3 那样用 { title } 绑定 @title，否则列会为 NULL 并触发约束错误。
 */
function sqlJsNamedParamKeys(obj: Record<string, unknown>): Record<string, unknown> {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('@') || k.startsWith(':') || k.startsWith('$')) {
      out[k] = v;
    } else {
      out[`@${k}`] = v;
    }
  }
  return out;
}

function createStmt(db: import('sql.js').Database, sql: string) {
  return {
    get(...params: unknown[]): SqlRow | null {
      const stmt = db.prepare(sql);
      const bind = normalizeBindParams(params);
      stmt.bind(
        bind !== undefined && bind !== null && typeof bind === 'object' && !Array.isArray(bind)
          ? sqlJsNamedParamKeys(bind as Record<string, unknown>)
          : bind
      );
      const row = stmt.step() ? (stmt.getAsObject() as SqlRow) : null;
      stmt.free();
      return row;
    },
    all(...params: unknown[]): SqlRow[] {
      const stmt = db.prepare(sql);
      const bind = normalizeBindParams(params);
      stmt.bind(
        bind !== undefined && bind !== null && typeof bind === 'object' && !Array.isArray(bind)
          ? sqlJsNamedParamKeys(bind as Record<string, unknown>)
          : bind
      );
      const rows: SqlRow[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as SqlRow);
      stmt.free();
      return rows;
    },
    run(...params: unknown[]) {
      const bind = normalizeBindParams(params);
      db.run(
        sql,
        bind !== undefined && bind !== null && typeof bind === 'object' && !Array.isArray(bind)
          ? sqlJsNamedParamKeys(bind as Record<string, unknown>)
          : bind
      );
      // persist() 内部会 db.export()，export 后 last_insert_rowid / getRowsModified 会被清零，必须先读再落盘
      const changes = db.getRowsModified();
      const lastInsertRowid = db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] as number | undefined;
      if (sqlJsTxDepth === 0) persist();
      return {
        changes,
        lastInsertRowid,
      };
    },
  };
}

function wrapDb(db: import('sql.js').Database): WrappedDatabase {
  rawDb = db;
  return {
    prepare(sql: string) {
      return createStmt(db, sql);
    },
    exec(sql: string) {
      const s = String(sql).trim();
      if (!s) return;
      // 迁移文件多为多条 DDL；sql.js 的 exec 对多语句批处理比 run 更稳妥
      db.exec(s);
      if (sqlJsTxDepth === 0) persist();
    },
    transaction<T>(fn: (...args: unknown[]) => T) {
      return (...args: unknown[]) => {
        sqlJsTxDepth += 1;
        db.run('BEGIN TRANSACTION');
        try {
          const result = fn(...args);
          db.run('COMMIT');
          sqlJsTxDepth -= 1;
          persist();
          return result;
        } catch (e) {
          try {
            db.run('ROLLBACK');
          } catch {
            /* ignore */
          }
          sqlJsTxDepth -= 1;
          throw e;
        }
      };
    },
  };
}

export async function getDb(): Promise<WrappedDatabase> {
  if (dbInstance) return dbInstance;
  if (!dbLoadPromise) {
    dbLoadPromise = (async () => {
      if (!SQL) {
        SQL = await initSqlJs();
      }
      const dbPath = getDbPath();
      ensureDataDir(dbPath);
      let db: import('sql.js').Database;
      if (fs.existsSync(dbPath)) {
        const buf = fs.readFileSync(dbPath);
        db = new SQL.Database(buf);
      } else {
        db = new SQL.Database();
      }
      db.run('PRAGMA foreign_keys = ON');
      dbInstance = wrapDb(db);
      return dbInstance;
    })();
  }
  try {
    return await dbLoadPromise;
  } catch (e) {
    dbLoadPromise = null;
    throw e;
  }
}

export function migrate(db: WrappedDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const migrationsDir = path.join(__dirname, '../../db/migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const row = db.prepare('SELECT 1 FROM schema_migrations WHERE name = ?').get(file);
    if (row) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
  }
}

export function seedAdminIfEmpty(db: WrappedDatabase): void {
  const row = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number } | null;
  if (!row || row.c > 0) return;

  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    console.warn(
      '[db] users 表为空但未设置 ADMIN_PASSWORD（至少 8 位），跳过创建管理员。请在 .env 设置后删除数据库文件或手动插入用户。'
    );
    return;
  }

  const email = (process.env.ADMIN_EMAIL || 'admin@localhost').trim().toLowerCase();
  const passwordHash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, passwordHash);
  console.info(`[db] 已创建管理员: ${email}`);
}

export async function initDb(): Promise<void> {
  const db = await getDb();
  console.info('[db] SQLite 文件:', getDbPath());
  migrate(db);
  seedAdminIfEmpty(db);
}
