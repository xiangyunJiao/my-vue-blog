<script setup>
import { ref, onMounted, computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { categories, tags, site, links } from '../api'
import { SITE_NAME } from '../config/site'
import { useAuthStore } from '../stores/auth'
import StarfieldBackground from '../components/StarfieldBackground.vue'

const route = useRoute()
const authStore = useAuthStore()
const siteTitle = ref(SITE_NAME)
const siteDesc = ref('')
const authorName = ref('')
const authorAvatar = ref('')
const authorBio = ref('')
const authorLinks = ref([])
const categoriesList = ref([])
const tagsList = ref([])
const linksList = ref([])
const darkMode = ref(false)

/** 后端字段 post_count；兼容旧缓存或异常结构 */
function categoryPostCount(c) {
  const n = c.post_count ?? c.postCount
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}

function tagPostCount(t) {
  const n = t.post_count ?? t.postCount
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}

/** 按 slug 稳定哈希配色，侧栏标签彼此区分 */
function tagPillStyle(slug) {
  const s = String(slug || '')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const hue = Math.abs(h) % 360
  return {
    background: `hsla(${hue}, 38%, 32%, 0.72)`,
    color: `hsla(${hue}, 62%, 90%, 0.98)`,
    border: `1px solid hsla(${hue}, 35%, 50%, 0.35)`,
  }
}

const isHome = computed(() => route.path === '/')

const categoriesWithPosts = computed(() =>
  categoriesList.value.filter((c) => categoryPostCount(c) > 0)
)

const tagsWithPosts = computed(() => tagsList.value.filter((t) => tagPostCount(t) > 0))

onMounted(async () => {
  try {
    const [siteRes, catRes, tagRes, linkRes] = await Promise.all([
      site.get(),
      categories.list(),
      tags.list(),
      links.list(),
    ])
    siteTitle.value = SITE_NAME || siteRes.site_title
    if (siteTitle.value) {
      document.title = siteTitle.value
    }
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
    <StarfieldBackground :dark="darkMode" />
    <div class="layout-chrome">
    <header class="header">
      <div class="header-inner">
        <router-link to="/" class="logo">{{ siteTitle }}</router-link>
        <nav class="nav">
          <router-link to="/">首页</router-link>
          <router-link to="/search">搜索</router-link>
          <router-link to="/archive">归档</router-link>
          <router-link to="/about">关于</router-link>
          <router-link v-if="authStore.user" to="/admin" class="admin-link">管理</router-link>
        </nav>
        
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
            <li v-for="c in categoriesWithPosts" :key="c.id">
              <router-link :to="`/category/${c.slug}`" class="sidebar-cat-link">
                {{ c.name }}（{{ categoryPostCount(c) }}）
              </router-link>
            </li>
            <li v-if="!categoriesWithPosts.length"><span class="muted">暂无</span></li>
          </ul>
        </section>
        <section class="sidebar-section">
          <h3>标签</h3>
          <div class="tag-cloud">
            <router-link
              v-for="t in tagsWithPosts"
              :key="t.id"
              :to="`/tag/${t.slug}`"
              class="tag tag-pill"
              :style="tagPillStyle(t.slug)"
            >
              {{ t.name }}（{{ tagPostCount(t) }}）
            </router-link>
            <span v-if="!tagsWithPosts.length" class="muted">暂无</span>
          </div>
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
  </div>
</template>

<style scoped>
.layout {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: transparent;
  color: var(--text);
  /* 暮光星空上的前景色（浅色模式 = 偏亮星空主题） */
  --text: rgba(237, 233, 254, 0.92);
  --text-h: #ffffff;
  --border: rgba(255, 255, 255, 0.14);
  --code-bg: rgba(15, 23, 42, 0.5);
  --accent: #c4b5fd;
  --accent-bg: rgba(167, 139, 250, 0.22);
  --glass: rgba(22, 28, 52, 0.32);
  --glass-nav: rgba(22, 28, 52, 0.4);
}

.layout.dark {
  --text: #9ca3af;
  --text-h: #f3f4f6;
  --border: rgba(255, 255, 255, 0.1);
  --code-bg: rgba(31, 41, 55, 0.85);
  --accent: #7dd3fc;
  --accent-bg: rgba(56, 189, 248, 0.14);
  --glass: rgba(10, 14, 28, 0.38);
  --glass-nav: rgba(10, 14, 28, 0.48);
}

.layout-chrome {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.header {
  border-bottom: 1px solid var(--border);
  padding: 12px 24px;
  background: var(--glass-nav);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
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

.body {
  flex: 1;
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 200px;
  gap: 28px;
  padding: 24px;
  box-sizing: border-box;
}

.main {
  min-width: 0;
  padding: 4px 8px 16px 4px;
  border-radius: 12px 0 0 12px;
  /* background: var(--glass);
  backdrop-filter: blur(10px); */
  -webkit-backdrop-filter: blur(10px);
}

.sidebar {
  border-left: 1px solid var(--border);
  padding-left: 18px;
  padding-top: 4px;
  padding-bottom: 8px;
  border-radius: 0 12px 12px 0;
  background: var(--glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
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

.tag-cloud .tag-pill {
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.35;
  font-variant-numeric: tabular-nums;
  box-sizing: border-box;
}

.tag-cloud a.tag-pill:hover {
  filter: brightness(1.1);
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

.muted {
  color: var(--text);
  opacity: 0.6;
}

.footer {
  border-top: 1px solid var(--border);
  padding: 24px;
  text-align: center;
  background: var(--glass-nav);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
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

  .main {
    border-radius: 12px;
    padding: 4px 8px 16px;
  }

  .sidebar {
    border-left: none;
    border-top: 1px solid var(--border);
    padding-left: 0;
    padding-top: 24px;
    border-radius: 12px;
  }
}
</style>
