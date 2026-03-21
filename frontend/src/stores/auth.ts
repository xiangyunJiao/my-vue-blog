import { defineStore } from 'pinia';
import { ref } from 'vue';
import { auth as authApi } from '../api';

export type AuthUser = { id: number; email: string; created_at?: string };

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);

  async function fetchUser(): Promise<AuthUser | null> {
    try {
      const payload = (await authApi.me()) as { user: AuthUser | null };
      user.value = payload.user ?? null;
      return payload.user ?? null;
    } catch {
      user.value = null;
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
