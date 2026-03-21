-- 主键 posts(id) 在 SQLite 中已有隐式 rowid 索引；此处补充按更新时间查询后台列表的索引
CREATE INDEX IF NOT EXISTS idx_posts_updated_at ON posts (updated_at);
