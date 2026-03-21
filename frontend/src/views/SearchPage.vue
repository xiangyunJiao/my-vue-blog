<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { search } from '../api'

const route = useRoute()
const router = useRouter()
const q = ref(route.query.q || '')
const list = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const limit = 10

async function doSearch() {
  if (!q.value.trim()) {
    list.value = []
    total.value = 0
    return
  }
  loading.value = true
  try {
    const res = await search.posts({ q: q.value, page: page.value, limit })
    list.value = res.data
    total.value = res.total
  } catch {
    list.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function goToPost(slug) {
  router.push({ name: 'post', params: { slug } })
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

watch([q, page], () => {
  router.replace({ query: { q: q.value || undefined } })
  doSearch()
})

watch(() => route.query.q, (v) => {
  q.value = v || ''
  page.value = 1
  doSearch()
}, { immediate: true })
</script>

<template>
  <div class="search-page">
    <h1>搜索</h1>
    <el-input
      v-model="q"
      placeholder="搜索文章标题、摘要、正文..."
      clearable
      size="large"
      class="search-input"
      @keyup.enter="doSearch"
    >
      <template #append>
        <el-button :loading="loading" @click="doSearch">搜索</el-button>
      </template>
    </el-input>
    <p v-if="loading" class="loading">搜索中…</p>
    <p v-else-if="q && !list.length" class="empty">未找到相关文章</p>
    <ul v-else-if="list.length" class="post-list">
      <li v-for="item in list" :key="item.id" class="post-card" @click="goToPost(item.slug)">
        <h2 class="post-title">{{ item.title }}</h2>
        <p v-if="item.excerpt" class="post-excerpt">{{ item.excerpt }}</p>
        <div class="post-meta">
          <span v-if="item.category" class="category">{{ item.category.name }}</span>
          <time>{{ formatDate(item.publishedAt) }}</time>
        </div>
      </li>
    </ul>
    <el-pagination
      v-if="total > limit"
      v-model:current-page="page"
      :total="total"
      :page-size="limit"
      layout="prev, pager, next"
      style="margin-top: 24px"
    />
  </div>
</template>

<style scoped>
.search-page { padding: 0; }

.search-input {
  max-width: 480px;
  margin-bottom: 24px;
}

.post-list { list-style: none; padding: 0; margin: 0; }

.post-card {
  padding: 20px 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}

.post-card:hover { opacity: 0.85; }

.post-excerpt { font-size: 15px; color: var(--text); margin: 0 0 12px; line-height: 1.5; opacity: 0.95; }

.post-meta { font-size: 13px; color: var(--text); opacity: 0.8; }

.post-meta .category { margin-right: 12px; color: var(--accent); }
</style>
