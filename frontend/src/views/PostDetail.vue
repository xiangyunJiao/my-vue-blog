<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { marked, Renderer } from 'marked'
import Prism from 'prismjs'
import 'prismjs/themes/prism-tomorrow.css'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-bash'
import { posts, interactions } from '../api'
import { formatApiError } from '../utils/apiError'

const route = useRoute()
const post = ref(null)
const loading = ref(true)
const error = ref(null)
const bodyRef = ref(null)
const comments = ref([])
const commentsLoading = ref(false)
const commentForm = ref({ authorName: '', authorEmail: '', body: '' })
const commentHint = ref('')
const likeSubmitting = ref(false)

const slug = computed(() => route.params.slug)

function slugify(text) {
  const s = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
  return (
    s
      .replace(/[^\w\u4e00-\u9fff-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section'
  )
}

function uniqueSlug(base, used) {
  let id = base
  let n = 1
  while (used.has(id)) {
    n += 1
    id = `${base}-${n}`
  }
  used.set(id, true)
  return id
}

/** 从 Markdown 提取 ## / ### 目录（忽略代码块内行） */
function extractToc(md) {
  if (!md) return []
  const lines = md.split('\n')
  const items = []
  let inFence = false
  const used = new Map()
  for (const line of lines) {
    const t = line.trim()
    if (/^(`{3,}|~{3,})/.test(t)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = /^(#{2,3})\s+(.+)$/.exec(t)
    if (!m) continue
    const depth = m[1].length
    const text = m[2].replace(/\s+#+\s*$/, '').trim()
    const base = slugify(text)
    const id = uniqueSlug(base || 'section', used)
    items.push({ depth, text, id })
  }
  return items
}

function escapeHeadingId(id) {
  return String(id).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

class TocRenderer extends Renderer {
  constructor(ids) {
    super()
    this._ids = [...ids]
  }

  heading({ tokens, depth }) {
    const inner = this.parser.parseInline(tokens)
    if (depth >= 2 && depth <= 3 && this._ids.length) {
      const id = this._ids.shift()
      return `<h${depth} id="${escapeHeadingId(id)}">${inner}</h${depth}>\n`
    }
    return `<h${depth}>${inner}</h${depth}>\n`
  }
}

const markdownRender = computed(() => {
  const md = post.value?.bodyMd
  if (!md) return { html: '', toc: [] }
  const toc = extractToc(md)
  const renderer = new TocRenderer(toc.map((t) => t.id))
  return { html: marked.parse(md, { renderer }), toc }
})

async function fetchPost() {
  if (!slug.value) return
  loading.value = true
  error.value = null
  commentHint.value = ''
  try {
    post.value = await posts.getBySlug(slug.value)
  } catch (e) {
    error.value = formatApiError(e, e.response?.status === 404 ? '文章不存在' : '加载失败')
    post.value = null
  } finally {
    loading.value = false
  }
}

async function loadComments() {
  if (!slug.value) return
  commentsLoading.value = true
  try {
    const cRes = await interactions.getComments(slug.value)
    comments.value = cRes.data || []
  } catch {
    comments.value = []
  } finally {
    commentsLoading.value = false
  }
}

async function toggleLike() {
  if (!post.value || likeSubmitting.value) return
  likeSubmitting.value = true
  try {
    const likeRes = await interactions.like(slug.value)
    post.value.liked = likeRes.liked
    post.value.likeCount = likeRes.likeCount
  } catch (e) {
    alert(formatApiError(e, '点赞失败'))
  } finally {
    likeSubmitting.value = false
  }
}

async function submitComment() {
  const authorName = commentForm.value.authorName.trim()
  const body = commentForm.value.body.trim()
  if (!authorName) {
    alert('请填写昵称')
    return
  }
  if (!body) {
    alert('请填写留言内容')
    return
  }
  try {
    await interactions.postComment(slug.value, {
      authorName,
      authorEmail: commentForm.value.authorEmail.trim() || undefined,
      body,
    })
    commentHint.value = '提交成功，审核通过后将显示在下方。'
    commentForm.value = { authorName: '', authorEmail: '', body: '' }
  } catch (e) {
    alert(formatApiError(e, '提交失败'))
  }
}

watch(
  () => post.value?.slug,
  (s) => {
    if (s) loadComments()
  }
)

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

watch(slug, fetchPost)
watch(
  () => markdownRender.value.html,
  async () => {
    await nextTick()
    if (bodyRef.value) Prism.highlightAllUnder(bodyRef.value)
  }
)
onMounted(fetchPost)
</script>

<template>
  <main class="post-detail">
    <p v-if="loading" class="loading">加载中…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <div v-else-if="post" class="post-with-toc">
      <article class="article">
        <header class="article-header">
          <img v-if="post.coverImage" :src="post.coverImage" class="cover" alt="" />
          <h1 class="article-title">{{ post.title }}</h1>
          <div class="meta">
            <router-link v-if="post.category" :to="`/category/${post.category.slug}`" class="category">{{ post.category.name }}</router-link>
            <time>{{ formatDate(post.publishedAt) }}</time>
            <span v-if="post.viewCount" class="views">{{ post.viewCount }} 阅读</span>
            <span v-if="post.tags?.length" class="tags">
              <router-link v-for="t in post.tags" :key="t.id" :to="`/tag/${t.slug}`" class="tag">{{ t.name }}</router-link>
            </span>
          </div>
        </header>
        <div ref="bodyRef" class="body markdown-body" v-html="markdownRender.html"></div>

        <div class="article-actions">
          <button
            type="button"
            class="like-btn"
            :class="{ liked: post.liked }"
            :disabled="likeSubmitting"
            @click="toggleLike"
          >
            {{ post.liked ? '已赞' : '点赞' }} · {{ post.likeCount ?? 0 }}
          </button>
          <span class="comment-stat">{{ post.commentCount ?? 0 }} 条留言</span>
        </div>

        <section class="comments-section" aria-label="留言">
          <h2 class="comments-title">留言</h2>
          <p v-if="commentsLoading" class="muted">加载留言中…</p>
          <ul v-else class="comment-list">
            <li v-for="c in comments" :key="c.id" class="comment-item">
              <div class="comment-meta">
                <strong>{{ c.authorName }}</strong>
                <time>{{ formatDate(c.createdAt) }}</time>
              </div>
              <p class="comment-body">{{ c.body }}</p>
            </li>
            <li v-if="!comments.length" class="muted">暂无留言，欢迎第一个发言。</li>
          </ul>

          <p v-if="commentHint" class="comment-hint">{{ commentHint }}</p>
          <form class="comment-form" @submit.prevent="submitComment">
            <label class="sr-only" for="c-name">昵称</label>
            <input
              id="c-name"
              v-model="commentForm.authorName"
              type="text"
              placeholder="昵称（必填）"
              maxlength="64"
              class="input"
            />
            <label class="sr-only" for="c-email">邮箱</label>
            <input
              id="c-email"
              v-model="commentForm.authorEmail"
              type="email"
              placeholder="邮箱（选填）"
              maxlength="254"
              class="input"
            />
            <label class="sr-only" for="c-body">内容</label>
            <textarea
              id="c-body"
              v-model="commentForm.body"
              placeholder="留言内容（1～2000 字）"
              maxlength="2000"
              rows="4"
              class="textarea"
            />
            <button type="submit" class="submit-btn">提交留言</button>
          </form>
        </section>

        <nav v-if="post.prev || post.next" class="prev-next">
          <router-link v-if="post.prev" :to="`/post/${post.prev.slug}`" class="prev">← {{ post.prev.title }}</router-link>
          <span v-else></span>
          <router-link v-if="post.next" :to="`/post/${post.next.slug}`" class="next">{{ post.next.title }} →</router-link>
        </nav>
      </article>
      <nav v-if="markdownRender.toc.length" class="toc" aria-label="文章目录">
        <div class="toc-title">目录</div>
        <a
          v-for="item in markdownRender.toc"
          :key="item.id"
          :href="'#' + item.id"
          :class="['toc-link', 'toc-depth-' + item.depth]"
        >{{ item.text }}</a>
      </nav>
    </div>
  </main>
</template>

<style scoped>
.post-detail {
  padding: 0;
  text-align: left;
}

.loading,
.error {
  color: var(--text);
  margin: 24px 0;
}

.error {
  color: #dc2626;
}

.post-with-toc {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.post-with-toc .article {
  order: 2;
}

.post-with-toc .toc {
  order: 1;
}

@media (min-width: 900px) {
  .post-with-toc {
    flex-direction: row;
    align-items: flex-start;
    gap: 44px;
  }

  .post-with-toc .article {
    order: 1;
    flex: 1;
    min-width: 0;
  }

  .post-with-toc .toc {
    order: 2;
    flex: 0 0 200px;
    margin-left: 8px;
    position: sticky;
    top: 16px;
    max-height: calc(100vh - 32px);
    overflow-y: auto;
  }
}

.toc {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
}

.toc-title {
  font-weight: 600;
  color: var(--text-h);
  margin-bottom: 12px;
  font-size: 13px;
}

.toc-link {
  display: block;
  color: var(--text);
  text-decoration: none;
  line-height: 1.5;
  margin-bottom: 8px;
  word-break: break-word;
}

.toc-link:hover {
  color: var(--accent);
}

.toc-depth-3 {
  padding-left: 12px;
  font-size: 13px;
  opacity: 0.95;
}

.article-header {
  margin-bottom: 32px;
}

.cover {
  width: 100%;
  max-height: 320px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 20px;
}

/* 覆盖全局 style.css 中大号 h1 / 负字距，避免中文长标题折行时行距塌缩重叠 */
.article-title {
  font-size: clamp(1.5rem, 4.2vw, 2.25rem);
  font-weight: 700;
  line-height: 1.38;
  letter-spacing: -0.025em;
  margin: 0 0 14px;
  color: var(--text-h);
  text-shadow: 0 1px 5px rgba(0, 0, 0, 0.4);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
  row-gap: 8px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text);
  opacity: 0.92;
}

.meta .category {
  color: var(--accent);
  text-decoration: none;
}

.meta .category:hover {
  text-decoration: underline;
}

.meta time {
  white-space: nowrap;
}

.meta .views {
  white-space: nowrap;
}

.meta .tags {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
}

.tag {
  display: inline-block;
  margin-right: 6px;
  padding: 2px 8px;
  background: var(--accent-bg);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text);
  text-decoration: none;
}

.tag:hover {
  color: var(--accent);
}

.body {
  line-height: 1.7;
}

.body :deep(h2),
.body :deep(h3) {
  scroll-margin-top: 72px;
}

.body :deep(h2) {
  font-size: 22px;
  margin: 28px 0 12px;
}

.body :deep(h3) {
  font-size: 18px;
  margin: 24px 0 10px;
}

.body :deep(p) {
  margin: 0 0 16px;
}

.body :deep(pre) {
  background: var(--code-bg);
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 16px 0;
}

.body :deep(code) {
  font-family: var(--mono);
  font-size: 14px;
}

.body :deep(pre code) {
  padding: 0;
  background: none;
}

.body :deep(ul),
.body :deep(ol) {
  margin: 0 0 16px;
  padding-left: 24px;
}

.body :deep(blockquote) {
  margin: 16px 0;
  padding-left: 16px;
  border-left: 4px solid var(--accent);
  color: var(--text);
}

.prev-next {
  display: flex;
  justify-content: space-between;
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
  gap: 16px;
}

.prev-next a {
  max-width: 45%;
  color: var(--accent);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prev-next a:hover {
  text-decoration: underline;
}

.article-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 24px 0;
  flex-wrap: wrap;
}

.like-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  font-size: 14px;
}

.like-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.like-btn.liked {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

.like-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.comment-stat {
  font-size: 14px;
  color: var(--text);
  opacity: 0.85;
}

.comments-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}

.comments-title {
  font-size: 20px;
  margin: 0 0 16px;
  color: var(--text-h);
}

.comment-list {
  list-style: none;
  padding: 0;
  margin: 0 0 24px;
}

.comment-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.comment-item:last-child {
  border-bottom: none;
}

.comment-meta {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-size: 14px;
  margin-bottom: 8px;
}

.comment-meta time {
  font-size: 13px;
  opacity: 0.75;
}

.comment-body {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}

.muted {
  color: var(--text);
  opacity: 0.65;
  font-size: 14px;
}

.comment-hint {
  color: #059669;
  font-size: 14px;
  margin-bottom: 16px;
}

.comment-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 560px;
}

.comment-form .input,
.comment-form .textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 15px;
  font-family: inherit;
}

.comment-form .textarea {
  resize: vertical;
  min-height: 100px;
}

.submit-btn {
  align-self: flex-start;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-size: 15px;
}

.submit-btn:hover {
  opacity: 0.92;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
