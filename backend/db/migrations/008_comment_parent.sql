-- 留言回复：指向同文章下另一条留言（应用层校验；删除父留言时子项 parent_id 置空依赖 ON DELETE，见应用删除逻辑）
ALTER TABLE comments ADD COLUMN parent_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
