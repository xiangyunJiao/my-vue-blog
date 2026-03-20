<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { posts } from '../api'

const router = useRouter()
const data = ref({})
const loading = ref(true)

const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

const sortedYears = computed(() =>
  Object.keys(data.value).sort((a, b) => Number(b) - Number(a))
)

onMounted(async () => {
  try {
    const res = await posts.archive()
    data.value = res.data.data || {}
  } catch {
    data.value = {}
  } finally {
    loading.value = false
  }
})

function goToPost(slug) {
  router.push({ name: 'post', params: { slug } })
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}
</script>

<template>
  <div class="archive">
    <h1>归档</h1>
    <p v-if="loading" class="loading">加载中…</p>
    <template v-else>
      <section v-for="year in sortedYears" :key="year" class="year-section">
        <h2>{{ year }} 年</h2>
        <div v-for="(items, month) in data[year]" :key="month" class="month-block">
          <h3>{{ monthNames[parseInt(month, 10) - 1] || month }}</h3>
          <ul>
            <li v-for="p in items" :key="p.id" @click="goToPost(p.slug)">
              <time>{{ formatDate(p.publishedAt) }}</time>
              <span class="title">{{ p.title }}</span>
            </li>
          </ul>
        </div>
      </section>
      <p v-if="!Object.keys(data).length" class="empty">暂无归档</p>
    </template>
  </div>
</template>

<style scoped>
.archive { padding: 0; }

.year-section {
  margin-bottom: 32px;
}

.year-section h2 {
  font-size: 20px;
  margin: 0 0 16px;
  color: var(--accent);
}

.month-block {
  margin-bottom: 20px;
}

.month-block h3 {
  font-size: 16px;
  margin: 0 0 8px;
  color: var(--text-h);
}

.month-block ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.month-block li {
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  display: flex;
  gap: 16px;
  align-items: center;
}

.month-block li:hover {
  color: var(--accent);
}

.month-block time {
  font-size: 14px;
  opacity: 0.8;
  min-width: 80px;
}

.month-block .title {
  flex: 1;
}
</style>
