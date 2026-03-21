import { defineStore } from 'pinia';
import { ref } from 'vue';
import { auth as authApi } from '../api';

export type AuthUser = { id: number; email: string; created_at?: string };

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);

  async function fetchUser(): Promise<AuthUser | null> {
    try {
      const { data } = await authApi.me();
      user.value = data.user as AuthUser | null;
      return (data.user as AuthUser | null) ?? null;
    } catch {
      user.value = null;
      return null;
    }
  }

  async function login(email: string, password: string): Promise<AuthUser> {
    const { data } = await authApi.login({ email, password });
    user.value = data.user as AuthUser;
    return data.user as AuthUser;
  }

  async function logout(): Promise<void> {
    await authApi.logout();
    user.value = null;
  }

  return { user, fetchUser, login, logout };
});
