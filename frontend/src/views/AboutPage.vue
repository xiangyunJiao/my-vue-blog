<script setup>
import { ref, computed, onMounted } from 'vue'
import { marked } from 'marked'
import { site } from '../api'

const content = ref('')
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await site.get()
    content.value = res.about_content || ''
  } catch {
    content.value = ''
  } finally {
    loading.value = false
  }
})

const html = computed(() => {
  if (!content.value) return ''
  return marked.parse(content.value)
})
</script>

<template>
  <div class="about">
    <h1>关于</h1>
    <p v-if="loading" class="loading">加载中…</p>
    <div v-else-if="content" class="content markdown-body" v-html="html"></div>
    <p v-else class="empty">暂无介绍</p>
  </div>
</template>

<style scoped>
.about { padding: 0; }

.content {
  line-height: 1.8;
}

.content :deep(h2) {
  font-size: 20px;
  margin: 24px 0 12px;
}

.content :deep(p) {
  margin: 0 0 16px;
}

.content :deep(a) {
  color: var(--accent);
}
</style>
