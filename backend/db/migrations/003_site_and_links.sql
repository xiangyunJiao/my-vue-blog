CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO site_settings (key, value) VALUES ('site_title', '我的博客');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('site_description', '');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('about_content', '');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('author_name', '');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('author_avatar', '');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('author_bio', '');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('author_links', '[]');
