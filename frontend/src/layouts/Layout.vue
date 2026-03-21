<script setup>
import { ref, onMounted, computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { categories, tags, site, links } from '../api'

const route = useRoute()
const siteTitle = ref('我的博客')
const siteDesc = ref('')
const authorName = ref('')
const authorAvatar = ref('')
const authorBio = ref('')
const authorLinks = ref([])
const categoriesList = ref([])
const tagsList = ref([])
const linksList = ref([])
const darkMode = ref(false)
const totalVisits = ref(0)
const todayVisits = ref(0)

const isHome = computed(() => route.path === '/')

onMounted(async () => {
  try {
    const [siteRes, catRes, tagRes, linkRes] = await Promise.all([
      site.get(),
      categories.list(),
      tags.list(),
      links.list(),
    ])
    siteTitle.value = siteRes.site_title || '我的博客'
    siteDesc.value = siteRes.site_description || ''
    authorName.value = siteRes.author_name || ''
    authorAvatar.value = siteRes.author_avatar || ''
    authorBio.value = siteRes.author_bio || ''
    try {
      authorLinks.value = typeof siteRes.author_links === 'string'
        ? JSON.parse(siteRes.author_links || '[]')
        : siteRes.author_links || []
    } catch {
      authorLinks.value = []
    }
    totalVisits.value = Number(siteRes.totalVisits ?? 0) || 0
    todayVisits.value = Number(siteRes.todayVisits ?? 0) || 0
    categoriesList.value = catRes.data || []
    tagsList.value = tagRes.data || []
    linksList.value = linkRes.data || []
  } catch {
    // use defaults
  }
  const saved = localStorage.getItem('darkMode')
  darkMode.value = saved === 'true' || (saved === null && window.matchMedia('(prefers-color-scheme: dark)').matches)
})

function toggleDark() {
  darkMode.value = !darkMode.value
  localStorage.setItem('darkMode', String(darkMode.value))
}
</script>

<template>
  <div class="layout" :class="{ dark: darkMode }">
    <header class="header">
      <div class="header-inner">
        <router-link to="/" class="logo">{{ siteTitle }}</router-link>
        <nav class="nav">
          <router-link to="/">首页</router-link>
          <router-link to="/search">搜索</router-link>
          <router-link to="/archive">归档</router-link>
          <router-link to="/about">关于</router-link>
          <router-link to="/admin" class="admin-link">管理</router-link>
        </nav>
        <button class="dark-toggle" :title="darkMode ? '浅色' : '深色'" @click="toggleDark">
          {{ darkMode ? '☀' : '☽' }}
        </button>
      </div>
    </header>

    <div class="body">
      <main class="main">
        <RouterView />
      </main>
      <aside class="sidebar">
        <section v-if="authorName || authorAvatar || authorBio" class="sidebar-section about-me">
          <router-link to="/about" class="about-me-link">
            <img v-if="authorAvatar" :src="authorAvatar" class="author-avatar" alt="" />
            <div v-else class="author-avatar-placeholder">{{ (authorName || '我')[0] }}</div>
            <h3 class="author-name">{{ authorName || '博主' }}</h3>
            <p v-if="authorBio" class="author-bio">{{ authorBio }}</p>
            <div v-if="authorLinks.length" class="author-links">
              <a v-for="(link, i) in authorLinks" :key="i" :href="link.url" target="_blank" rel="noopener" :title="link.name">{{ link.name }}</a>
            </div>
          </router-link>
        </section>
        <section class="sidebar-section">
          <h3>分类</h3>
          <ul>
            <li v-for="c in categoriesList" :key="c.id">
              <router-link :to="`/category/${c.slug}`">{{ c.name }}</router-link>
            </li>
            <li v-if="!categoriesList.length"><span class="muted">暂无</span></li>
          </ul>
        </section>
        <section class="sidebar-section">
          <h3>标签</h3>
          <div class="tag-cloud">
            <router-link v-for="t in tagsList" :key="t.id" :to="`/tag/${t.slug}`" class="tag">{{ t.name }}</router-link>
            <span v-if="!tagsList.length" class="muted">暂无</span>
          </div>
        </section>
        <section class="sidebar-section">
          <h3>访问统计</h3>
          <p class="visit-stats">
            <span>累计 <strong>{{ totalVisits }}</strong></span>
            <span>今日 <strong>{{ todayVisits }}</strong></span>
          </p>
        </section>
        <section class="sidebar-section">
          <h3>订阅与索引</h3>
          <div class="subscribe-links">
            <a href="/api/rss" target="_blank" rel="noopener noreferrer">RSS 订阅</a>
            <a href="/api/sitemap" target="_blank" rel="noopener noreferrer">站点地图</a>
          </div>
        </section>
      </aside>
    </div>

    <footer class="footer">
      <div class="footer-links" v-if="linksList.length">
        <a v-for="l in linksList" :key="l.id" :href="l.url" target="_blank" rel="noopener">{{ l.title }}</a>
      </div>
      <p class="copyright">© {{ new Date().getFullYear() }} {{ siteTitle }}</p>
    </footer>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text);
}

.layout.dark {
  --text: #9ca3af;
  --text-h: #f3f4f6;
  --bg: #111827;
  --border: #374151;
  --code-bg: #1f2937;
  --accent: #60a5fa;
  --accent-bg: rgba(96, 165, 250, 0.15);
}

.header {
  border-bottom: 1px solid var(--border);
  padding: 12px 24px;
}

.header-inner {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 24px;
}

.logo {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-h);
  text-decoration: none;
}

.logo:hover {
  color: var(--accent);
}

.nav {
  display: flex;
  gap: 20px;
}

.nav a {
  color: var(--text);
  text-decoration: none;
}

.nav a.router-link-active,
.nav a:hover,
.admin-link:hover {
  color: var(--accent);
}

.admin-link {
  color: var(--text);
  text-decoration: none;
  font-size: 14px;
  opacity: 0.8;
}

.dark-toggle {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  color: var(--text);
}

.body {
  flex: 1;
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 32px;
  padding: 24px;
  box-sizing: border-box;
}

.main {
  min-width: 0;
}

.sidebar {
  border-left: 1px solid var(--border);
  padding-left: 24px;
}

.sidebar-section {
  margin-bottom: 24px;
}

.about-me {
  padding-bottom: 20px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--border);
}

.about-me-link {
  display: block;
  text-decoration: none;
  color: inherit;
}

.author-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  margin: 0 auto 12px;
}

.author-avatar-placeholder {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--accent-bg);
  color: var(--accent);
  font-size: 28px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}

.author-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-h);
  margin: 0 0 8px;
  text-align: center;
}

.author-bio {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text);
  margin: 0 0 12px;
  text-align: center;
}

.author-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.author-links a {
  font-size: 12px;
  color: var(--accent);
}

.sidebar-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h);
  margin: 0 0 12px;
}

.sidebar-section ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.sidebar-section li {
  margin-bottom: 6px;
}

.sidebar-section a {
  color: var(--text);
  text-decoration: none;
}

.sidebar-section a:hover {
  color: var(--accent);
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-cloud .tag {
  padding: 2px 8px;
  background: var(--accent-bg);
  border-radius: 4px;
  font-size: 13px;
}

.subscribe-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.subscribe-links a {
  color: var(--accent);
  text-decoration: none;
}

.subscribe-links a:hover {
  text-decoration: underline;
}

.visit-stats {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.visit-stats strong {
  color: var(--text-h);
  font-weight: 600;
}

.muted {
  color: var(--text);
  opacity: 0.6;
}

.footer {
  border-top: 1px solid var(--border);
  padding: 24px;
  text-align: center;
}

.footer-links {
  margin-bottom: 12px;
}

.footer-links a {
  margin: 0 12px;
  color: var(--text);
  text-decoration: none;
}

.footer-links a:hover {
  color: var(--accent);
}

.copyright {
  margin: 0;
  font-size: 14px;
  opacity: 0.8;
}

@media (max-width: 768px) {
  .body {
    grid-template-columns: 1fr;
  }

  .sidebar {
    border-left: none;
    border-top: 1px solid var(--border);
    padding-left: 0;
    padding-top: 24px;
  }
}
</style>
