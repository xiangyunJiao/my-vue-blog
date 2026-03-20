<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import Prism from 'prismjs'
import 'prismjs/themes/prism-tomorrow.css'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-bash'
import { posts } from '../api'

const route = useRoute()
const router = useRouter()
const post = ref(null)
const loading = ref(true)
const error = ref(null)
const bodyRef = ref(null)

const slug = computed(() => route.params.slug)

async function fetchPost() {
  if (!slug.value) return
  loading.value = true
  error.value = null
  try {
    const { data } = await posts.getBySlug(slug.value)
    post.value = data
    await nextTick()
    if (bodyRef.value) Prism.highlightAllUnder(bodyRef.value)
  } catch (e) {
    error.value = e.response?.status === 404 ? '文章不存在' : e.response?.data?.error || '加载失败'
    post.value = null
  } finally {
    loading.value = false
  }
}

const bodyHtml = computed(() => {
  if (!post.value?.bodyMd) return ''
  return marked.parse(post.value.bodyMd)
})

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function goBack() {
  router.push('/')
}

watch(slug, fetchPost)
onMounted(fetchPost)
</script>

<template>
  <main class="post-detail">
    <button class="back" @click="goBack">← 返回</button>
    <p v-if="loading" class="loading">加载中…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <article v-else-if="post" class="article">
      <header>
        <img v-if="post.coverImage" :src="post.coverImage" class="cover" alt="" />
        <h1>{{ post.title }}</h1>
        <div class="meta">
          <router-link v-if="post.category" :to="`/category/${post.category.slug}`" class="category">{{ post.category.name }}</router-link>
          <time>{{ formatDate(post.publishedAt) }}</time>
          <span v-if="post.viewCount" class="views">{{ post.viewCount }} 阅读</span>
          <span v-if="post.tags?.length" class="tags">
            <router-link v-for="t in post.tags" :key="t.id" :to="`/tag/${t.slug}`" class="tag">{{ t.name }}</router-link>
          </span>
        </div>
      </header>
      <div ref="bodyRef" class="body markdown-body" v-html="bodyHtml"></div>
      <nav v-if="post.prev || post.next" class="prev-next">
        <router-link v-if="post.prev" :to="`/post/${post.prev.slug}`" class="prev">← {{ post.prev.title }}</router-link>
        <span v-else></span>
        <router-link v-if="post.next" :to="`/post/${post.next.slug}`" class="next">{{ post.next.title }} →</router-link>
      </nav>
    </article>
  </main>
</template>

<style scoped>
.post-detail {
  padding: 0;
  text-align: left;
}

.back {
  margin-bottom: 24px;
  padding: 6px 0;
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 15px;
}

.back:hover {
  text-decoration: underline;
}

.loading,
.error {
  color: var(--text);
  margin: 24px 0;
}

.error {
  color: #dc2626;
}

.article header {
  margin-bottom: 32px;
}

.cover {
  width: 100%;
  max-height: 320px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 20px;
}

.article h1 {
  font-size: 32px;
  margin: 0 0 12px;
}

.meta {
  font-size: 14px;
  color: var(--text);
  opacity: 0.9;
}

.meta .category {
  margin-right: 12px;
  color: var(--accent);
  text-decoration: none;
}

.meta .views {
  margin-right: 12px;
}

.meta .tags {
  margin-left: 12px;
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

.body :deep(h2) {
  font-size: 22px;
  margin: 28px 0 12px;
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
</style>
