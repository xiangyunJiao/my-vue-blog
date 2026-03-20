import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import Layout from '../layouts/Layout.vue'
import AdminLayout from '../layouts/AdminLayout.vue'
import Home from '../views/Home.vue'
import PostDetail from '../views/PostDetail.vue'
import CategoryPage from '../views/CategoryPage.vue'
import TagPage from '../views/TagPage.vue'
import ArchivePage from '../views/ArchivePage.vue'
import AboutPage from '../views/AboutPage.vue'
import SearchPage from '../views/SearchPage.vue'
import AdminLogin from '../views/admin/AdminLogin.vue'
import AdminDashboard from '../views/admin/AdminDashboard.vue'
import AdminPostList from '../views/admin/AdminPostList.vue'
import AdminPostEdit from '../views/admin/AdminPostEdit.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: Layout,
      children: [
        { path: '', name: 'home', component: Home },
        { path: 'post/:slug', name: 'post', component: PostDetail },
        { path: 'category/:slug', name: 'category', component: CategoryPage },
        { path: 'tag/:slug', name: 'tag', component: TagPage },
        { path: 'search', name: 'search', component: SearchPage },
        { path: 'archive', name: 'archive', component: ArchivePage },
        { path: 'about', name: 'about', component: AboutPage },
      ],
    },
    {
      path: '/admin',
      children: [
        { path: 'login', name: 'adminLogin', component: AdminLogin },
        {
          path: '',
          component: AdminLayout,
          meta: { requiresAuth: true },
          children: [
            { path: '', name: 'admin', component: AdminDashboard },
            { path: 'posts', name: 'adminPosts', component: AdminPostList },
            { path: 'posts/new', name: 'adminPostNew', component: AdminPostEdit },
            { path: 'posts/:id/edit', name: 'adminPostEdit', component: AdminPostEdit },
          ],
        },
      ],
    },
  ],
})

router.beforeEach(async (to, from, next) => {
  if (to.meta.requiresAuth) {
    const authStore = useAuthStore()
    const user = authStore.user ?? (await authStore.fetchUser())
    if (!user) {
      next({ name: 'adminLogin', query: { redirect: to.fullPath } })
    } else {
      next()
    }
  } else {
    next()
  }
})

export default router
