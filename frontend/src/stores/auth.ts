import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';
import { auth as authApi } from '../api';

export type AuthUser = { id: number; email: string; created_at?: string };

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);

  async function fetchUser(): Promise<AuthUser | null> {
    try {
      const payload = (await authApi.me()) as { user: AuthUser | null };
      user.value = payload.user ?? null;
      return payload.user ?? null;
    } catch (e) {
      // 仅未登录/会话失效时清空；网络错误等不覆盖（避免刚登录进首页被误清空）
      const status = axios.isAxiosError(e) ? e.response?.status : undefined;
      if (status === 401) {
        user.value = null;
      }
      return null;
    }
  }

  async function login(email: string, password: string): Promise<AuthUser> {
    const payload = (await authApi.login({ email, password })) as { user: AuthUser };
    user.value = payload.user;
    return payload.user;
  }

  async function logout(): Promise<void> {
    await authApi.logout();
    user.value = null;
  }

  return { user, fetchUser, login, logout };
});
