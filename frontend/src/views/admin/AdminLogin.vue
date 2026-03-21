<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { formatApiError } from '../../utils/apiError'
import { ElMessage } from 'element-plus'

const router = useRouter()
const authStore = useAuthStore()
const email = ref('admin@localhost')
const password = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!email.value || !password.value) {
    ElMessage.warning('请输入邮箱和密码')
    return
  }
  loading.value = true
  try {
    await authStore.login(email.value, password.value)
    ElMessage.success('登录成功')
    router.push('/admin')
  } catch (e) {
    ElMessage.error(formatApiError(e, '登录失败'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="admin-login">
    <div class="login-card">
      <h1>管理后台</h1>
      <el-form label-width="80px" @submit.prevent="handleLogin">
        <el-form-item label="邮箱">
          <el-input v-model="email" placeholder="admin@localhost" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="password" type="password" placeholder="密码" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleLogin" style="width: 100%">
            登录
          </el-button>
        </el-form-item>
      </el-form>
      <router-link to="/" class="back-link">← 返回博客</router-link>
    </div>
  </div>
</template>

<style scoped>
.admin-login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}

.login-card {
  width: 360px;
  padding: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
}

.login-card h1 {
  margin: 0 0 24px;
  font-size: 24px;
  text-align: center;
}

.back-link {
  display: block;
  text-align: center;
  margin-top: 16px;
  color: var(--accent);
  text-decoration: none;
  font-size: 14px;
}

.back-link:hover {
  text-decoration: underline;
}
</style>
