const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const bcrypt = require('bcrypt');

let dbInstance = null;
let rawDb = null;
let SQL = null;

function getDbPath() {
  const raw = process.env.SQLITE_PATH || path.join(__dirname, '../../data/blog.sqlite');
  return path.isAbsolute(raw) ? raw : path.resolve(__dirname, '../..', raw);
}

function ensureDataDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function persist() {
  if (!rawDb) return;
  const dbPath = getDbPath();
  ensureDataDir(dbPath);
  const data = rawDb.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function createStmt(db, sql) {
  return {
    get(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const row = stmt.step() ? stmt.getAsObject() : null;
      stmt.free();
      return row;
    },
    all(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },
    run(...params) {
      db.run(sql, params);
      persist();
      return {
        changes: db.getRowsModified(),
        lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0],
      };
    },
  };
}

function wrapDb(db) {
  rawDb = db;
  return {
    prepare(sql) {
      return createStmt(db, sql);
    },
    exec(sql) {
      db.run(sql);
      persist();
    },
    transaction(fn) {
      db.run('BEGIN TRANSACTION');
      try {
        const result = fn();
        db.run('COMMIT');
        persist();
        return result;
      } catch (e) {
        db.run('ROLLBACK');
        throw e;
      }
    },
  };
}

async function getDb() {
  if (dbInstance) return dbInstance;
  if (!SQL) {
    SQL = await initSqlJs();
  }
  const dbPath = getDbPath();
  ensureDataDir(dbPath);
  let db;
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA foreign_keys = ON');
  dbInstance = wrapDb(db);
  return dbInstance;
}

function migrate(db) {
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

function seedAdminIfEmpty(db) {
  const row = db.prepare('SELECT COUNT(*) AS c FROM users').get();
  if (row.c > 0) return;

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

async function initDb() {
  const db = await getDb();
  migrate(db);
  seedAdminIfEmpty(db);
}

module.exports = { getDb, initDb, migrate, seedAdminIfEmpty };
