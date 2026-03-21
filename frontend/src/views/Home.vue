<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { posts } from '../api'
import { formatApiError } from '../utils/apiError'

const router = useRouter()
const list = ref([])
const loading = ref(true)
const error = ref(null)
const page = ref(1)
const total = ref(0)
const limit = 10

async function fetchPosts() {
  loading.value = true
  error.value = null
  try {
    const res = await posts.list({ page: page.value, limit })
    list.value = res.data
    total.value = res.total
  } catch (e) {
    error.value = formatApiError(e, '加载失败')
  } finally {
    loading.value = false
  }
}

function goToPost(slug) {
  router.push({ name: 'post', params: { slug } })
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

onMounted(fetchPosts)
</script>

<template>
  <main class="home">
    <h1>文章</h1>
    <p v-if="loading" class="loading">加载中…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <ul v-else-if="list.length" class="post-list">
      <li v-for="item in list" :key="item.id" class="post-card" @click="goToPost(item.slug)">
        <img v-if="item.coverImage" :src="item.coverImage" class="cover" alt="" />
        <span v-if="item.isPinned" class="pin-badge">置顶</span>
        <h2 class="post-title">{{ item.title }}</h2>
        <p v-if="item.excerpt" class="post-excerpt">{{ item.excerpt }}</p>
        <div class="post-meta">
          <router-link v-if="item.category" :to="`/category/${item.category.slug}`" class="category" @click.stop>{{ item.category.name }}</router-link>
          <time>{{ formatDate(item.publishedAt) }}</time>
          <span v-if="item.viewCount" class="views">{{ item.viewCount }} 阅读</span>
        </div>
      </li>
    </ul>
    <p v-else class="empty">暂无文章</p>
    <div v-if="total > limit" class="pagination">
      <button :disabled="page <= 1" @click="page--; fetchPosts()">上一页</button>
      <span>{{ page }} / {{ Math.ceil(total / limit) }}</span>
      <button :disabled="page >= Math.ceil(total / limit)" @click="page++; fetchPosts()">下一页</button>
    </div>
  </main>
</template>

<style scoped>
.home {
  padding: 0;
  text-align: left;
}

.home h1 {
  font-size: 28px;
  margin-bottom: 24px;
}

.loading,
.error,
.empty {
  color: var(--text);
  margin: 24px 0;
}

.error {
  color: #dc2626;
}

.post-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.post-card {
  padding: 20px 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: opacity 0.2s;
}

.post-card:hover {
  opacity: 0.85;
}

.post-card .cover {
  width: 100%;
  height: 160px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 12px;
}

.pin-badge {
  display: inline-block;
  padding: 2px 8px;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  border-radius: 4px;
  margin-bottom: 8px;
}

.post-meta .views {
  margin-left: 12px;
  opacity: 0.8;
}

.post-title {
  font-size: 20px;
  margin: 0 0 8px;
}

.post-excerpt {
  font-size: 15px;
  color: var(--text);
  margin: 0 0 12px;
  line-height: 1.5;
}

.post-meta {
  font-size: 13px;
  color: var(--text);
  opacity: 0.8;
}

.post-meta .category {
  margin-right: 12px;
  color: var(--accent);
}

.pagination {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 32px;
  justify-content: center;
}

.pagination button {
  padding: 6px 12px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-h);
  border-radius: 6px;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
