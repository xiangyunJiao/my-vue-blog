import {
  createRouter,
  createWebHistory,
  type NavigationGuardNext,
  type RouteLocationNormalized,
} from 'vue-router';
import { useAuthStore } from '../stores/auth';
import Layout from '../layouts/Layout.vue';
import AdminLayout from '../layouts/AdminLayout.vue';
import Home from '../views/Home.vue';
import PostDetail from '../views/PostDetail.vue';
import CategoryPage from '../views/CategoryPage.vue';
import TagPage from '../views/TagPage.vue';
import ArchivePage from '../views/ArchivePage.vue';
import AboutPage from '../views/AboutPage.vue';
import SearchPage from '../views/SearchPage.vue';
import AdminLogin from '../views/admin/AdminLogin.vue';
import AdminDashboard from '../views/admin/AdminDashboard.vue';
import AdminPostList from '../views/admin/AdminPostList.vue';
import AdminPostEdit from '../views/admin/AdminPostEdit.vue';
import AdminComments from '../views/admin/AdminComments.vue';
import AdminTaxonomy from '../views/admin/AdminTaxonomy.vue';

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
            { path: 'comments', name: 'adminComments', component: AdminComments },
            { path: 'taxonomy', name: 'adminTaxonomy', component: AdminTaxonomy },
          ],
        },
      ],
    },
  ],
});

router.beforeEach(async (to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) => {
  const authStore = useAuthStore();
  try {
    await authStore.fetchUser();
  } catch {
    /* 网络错误时不阻断路由；未登录由 fetchUser 清空 user */
  }
  if (to.meta.requiresAuth && !authStore.user) {
    next({ name: 'adminLogin', query: { redirect: to.fullPath } });
    return;
  }
  next();
});

export default router;
