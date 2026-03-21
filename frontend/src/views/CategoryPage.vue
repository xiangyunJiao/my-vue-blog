<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { posts, categories } from '../api'
import { formatApiError } from '../utils/apiError'

const route = useRoute()
const router = useRouter()
const list = ref([])
const loading = ref(true)
const error = ref(null)
const page = ref(1)
const total = ref(0)
const categoryName = ref('')
const limit = 10

const slug = computed(() => route.params.slug)

async function fetch() {
  if (!slug.value) return
  loading.value = true
  error.value = null
  try {
    const [postsRes, catRes] = await Promise.all([
      posts.list({ page: page.value, limit, category: slug.value }),
      categories.list(),
    ])
    list.value = postsRes.data
    total.value = postsRes.total
    const cat = (catRes.data || []).find((c) => c.slug === slug.value)
    categoryName.value = cat?.name || slug.value
  } catch (e) {
    error.value = formatApiError(e, '加载失败')
  } finally {
    loading.value = false
  }
}

function goToPost(s) {
  router.push({ name: 'post', params: { slug: s } })
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

watch(slug, () => { page.value = 1; fetch() })
onMounted(fetch)
</script>

<template>
  <div class="page">
    <h1>分类：{{ categoryName }}</h1>
    <p v-if="loading" class="loading">加载中…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <ul v-else-if="list.length" class="post-list">
      <li v-for="item in list" :key="item.id" class="post-card" @click="goToPost(item.slug)">
        <img v-if="item.coverImage" :src="item.coverImage" class="cover" alt="" />
        <h2 class="post-title">{{ item.title }}</h2>
        <p v-if="item.excerpt" class="post-excerpt">{{ item.excerpt }}</p>
        <div class="post-meta">
          <time>{{ formatDate(item.publishedAt) }}</time>
          <span v-if="item.viewCount" class="views">{{ item.viewCount }} 阅读</span>
        </div>
      </li>
    </ul>
    <p v-else class="empty">该分类下暂无文章</p>
    <div v-if="total > limit" class="pagination">
      <button :disabled="page <= 1" @click="page--; fetch()">上一页</button>
      <span>{{ page }} / {{ Math.ceil(total / limit) }}</span>
      <button :disabled="page >= Math.ceil(total / limit)" @click="page++; fetch()">下一页</button>
    </div>
  </div>
</template>

<style scoped>
.page { padding: 0; }
.post-list { list-style: none; padding: 0; margin: 0; }
.post-card { padding: 20px 0; border-bottom: 1px solid var(--border); cursor: pointer; transition: opacity 0.2s; }
.post-card:hover { opacity: 0.85; }
.cover { width: 100%; height: 160px; object-fit: cover; border-radius: 8px; margin-bottom: 12px; }
.post-title { font-size: 20px; margin: 0 0 8px; }
.post-excerpt { font-size: 15px; color: var(--text); margin: 0 0 12px; line-height: 1.5; }
.post-meta { font-size: 13px; color: var(--text); opacity: 0.8; }
.views { margin-left: 12px; opacity: 0.8; }
.pagination { display: flex; align-items: center; gap: 16px; margin-top: 32px; justify-content: center; }
.pagination button { padding: 6px 12px; border: 1px solid var(--border); background: var(--bg); color: var(--text-h); border-radius: 6px; cursor: pointer; }
.pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
