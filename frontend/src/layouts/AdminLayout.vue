<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

async function handleLogout() {
  await authStore.logout()
  router.push('/admin/login')
}
</script>

<template>
  <div class="admin-layout">
    <aside class="sidebar">
      <h2 class="logo">管理后台</h2>
      <el-menu router :default-active="$route.path">
        <el-menu-item index="/admin">
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/admin/posts">
          <span>文章管理</span>
        </el-menu-item>
        <el-menu-item index="/admin/taxonomy">
          <span>分类与标签</span>
        </el-menu-item>
        <el-menu-item index="/admin/comments">
          <span>留言管理</span>
        </el-menu-item>
      </el-menu>
      <div class="sidebar-footer">
        <el-button type="danger" plain size="small" @click="handleLogout">退出登录</el-button>
      </div>
    </aside>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: var(--bg);
}

.sidebar {
  width: 220px;
  border-right: 1px solid var(--border);
  padding: 20px 0;
  display: flex;
  flex-direction: column;
}

.logo {
  margin: 0 20px 24px;
  font-size: 18px;
}

.el-menu {
  border: none;
  flex: 1;
}

.sidebar-footer {
  padding: 20px;
}

.main {
  flex: 1;
  padding: 24px;
  overflow: auto;
}
</style>
