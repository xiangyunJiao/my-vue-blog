-- 全站访问量：每位访客每个自然日（UTC）最多计 1 次

CREATE TABLE IF NOT EXISTS visit_aggregates (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  total_visits INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO visit_aggregates (id, total_visits) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS visit_by_day (
  day TEXT NOT NULL PRIMARY KEY,
  visits INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS visit_daily_visitor (
  day TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  PRIMARY KEY (day, visitor_id)
);
