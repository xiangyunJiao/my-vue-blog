#!/usr/bin/env npx tsx
/**
 * 验证：空库迁移 + 模拟管理员创建文章（不启 HTTP，直接调路由逻辑等价操作）
 * 用法：cd backend && npm run verify:create-post
 */
import fs from 'fs';
import path from 'path';
import { initDb, getDb } from '../src/db';
import type { WrappedDatabase, RunResult } from '../src/db/types';

const tmp = path.join(__dirname, '../data/.verify-create-post.sqlite');
process.env.SQLITE_PATH = tmp;
try {
  fs.unlinkSync(tmp);
} catch {
  /* ignore */
}

function replacePostTags(tx: WrappedDatabase, postId: number, tagIds: unknown[]) {
  tx.prepare('DELETE FROM post_tags WHERE post_id = ?').run(postId);
  const insert = tx.prepare('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)');
  const existsStmt = tx.prepare('SELECT 1 FROM tags WHERE id = ?');
  const unique = [...new Set((tagIds || []).map((id) => parseInt(String(id), 10)).filter(Boolean))];
  for (const tagId of unique) {
    if (!existsStmt.get(tagId)) continue;
    insert.run(postId, tagId);
  }
}

function resolveNewPostId(db: WrappedDatabase, info: RunResult, slug: string): number {
  let postId = Number(info.lastInsertRowid);
  if (Number.isFinite(postId) && postId > 0) return postId;
  const row = db.prepare('SELECT id FROM posts WHERE slug = ? COLLATE NOCASE').get(slug) as { id: unknown } | null;
  postId = row ? Number(row.id) : 0;
  if (Number.isFinite(postId) && postId > 0) return postId;
  return 0;
}

async function main() {
  process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'verifyPass123456';
  await initDb();
  const db = await getDb();

  const title = `验证文章 ${Date.now()}`;
  const slug = `verify-${Date.now()}`;
  const bodyMd = '';
  const payload = {
    title,
    slug,
    excerpt: '',
    body_md: bodyMd,
    status: 'draft' as const,
    cover_image: null as string | null,
    is_pinned: 0,
    category_id: null as number | null,
    published_at: null as string | null,
  };

  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO posts (title, slug, excerpt, body_md, status, cover_image, is_pinned, category_id, published_at, updated_at)
         VALUES (@title, @slug, @excerpt, @body_md, @status, @cover_image, @is_pinned, @category_id, @published_at, datetime('now'))`
      )
      .run({
        title: payload.title,
        slug,
        excerpt: null,
        body_md: bodyMd,
        status: 'draft',
        cover_image: null,
        is_pinned: 0,
        category_id: null,
        published_at: null,
      });
    if (!info.changes) {
      throw new Error('插入失败 changes=0');
    }
    const postId = resolveNewPostId(db, info, slug);
    if (!postId) throw new Error('无法解析 postId');
    replacePostTags(db, postId, []);
    return postId;
  });

  const id = tx() as number;
  const row = db.prepare('SELECT id, title, slug FROM posts WHERE id = ?').get(id) as { slug: string } | null;
  if (!row || row.slug !== slug) {
    throw new Error('插入后查询不一致');
  }
  console.log('OK verify-create-post: new id =', id, 'slug =', slug);
  fs.unlinkSync(tmp);
}

main().catch((e: unknown) => {
  console.error('FAIL', e);
  process.exit(1);
});
