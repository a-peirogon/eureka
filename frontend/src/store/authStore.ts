import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthStore {
  user: User | null
  access_token: string | null
  refresh_token: string | null
  setAuth: (user: User, access_token: string, refresh_token: string) => void
  updateUser: (user: Partial<User>) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      access_token: null,
      refresh_token: null,

      setAuth: (user, access_token, refresh_token) =>
        set({ user, access_token, refresh_token }),

      updateUser: (partial) =>
        set((s) => ({ user: s.user ? { ...s.user, ...partial } : null })),

      clearAuth: () =>
        set({ user: null, access_token: null, refresh_token: null }),

      isAuthenticated: () => !!get().access_token && !!get().user,
    }),
    {
      name: 'eureka-auth',
      partialize: (s) => ({
        user: s.user,
        access_token: s.access_token,
        refresh_token: s.refresh_token,
      }),
    }
  )
)
