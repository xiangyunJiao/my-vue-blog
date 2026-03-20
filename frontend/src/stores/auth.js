import { defineStore } from 'pinia'
import { ref } from 'vue'
import { auth as authApi } from '../api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)

  async function fetchUser() {
    try {
      const { data } = await authApi.me()
      user.value = data.user
      return data.user
    } catch {
      user.value = null
      return null
    }
  }

  async function login(email, password) {
    const { data } = await authApi.login({ email, password })
    user.value = data.user
    return data.user
  }

  async function logout() {
    await authApi.logout()
    user.value = null
  }

  return { user, fetchUser, login, logout }
})
