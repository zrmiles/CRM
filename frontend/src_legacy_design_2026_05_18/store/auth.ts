import { create } from 'zustand'
import { authApi } from '../api/auth'
import {
  AUTH_LOGOUT_EVENT,
  AUTH_TOKENS_UPDATED_EVENT,
  clearStoredTokens,
  getStoredTokens,
  setStoredTokens,
  type AuthTokens,
  type StoredAuthTokens,
} from '../api/tokenStorage'
import type { LoginPayload, RegisterPayload, User } from '../types'

interface AuthState extends AuthTokens {
  user: User | null
  isLoading: boolean
  isInitialized: boolean
  login: (payload: LoginPayload) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  fetchMe: () => Promise<User | null>
  setTokens: (tokens: StoredAuthTokens) => void
  logout: () => void
}

const initialTokens = getStoredTokens()

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: initialTokens.accessToken,
  isLoading: false,
  isInitialized: false,

  async login(payload) {
    set({ isLoading: true })
    try {
      const tokenResponse = await authApi.login(payload)
      const tokens = {
        accessToken: tokenResponse.access_token,
      }

      setStoredTokens(tokens)
      set({ ...tokens })

      const user = await authApi.me()
      set({ user, isInitialized: true })
    } finally {
      set({ isLoading: false })
    }
  },

  async register(payload) {
    set({ isLoading: true })
    try {
      await authApi.register(payload)
      await get().login({ email: payload.email, password: payload.password })
    } finally {
      set({ isLoading: false })
    }
  },

  async fetchMe() {
    let { accessToken } = get()
    if (!accessToken) {
      try {
        const tokenResponse = await authApi.refresh()
        const tokens = { accessToken: tokenResponse.access_token }
        setStoredTokens(tokens)
        set(tokens)
        accessToken = tokens.accessToken
      } catch {
        set({ user: null, accessToken: null, isInitialized: true })
        return null
      }
    }

    set({ isLoading: true })
    try {
      const user = await authApi.me()
      set({ user, isInitialized: true })
      return user
    } catch (error) {
      set({ user: null, isInitialized: true })
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  setTokens(tokens) {
    setStoredTokens(tokens)
    set(tokens)
  },

  logout() {
    clearStoredTokens()
    set({
      user: null,
      accessToken: null,
      isInitialized: true,
      isLoading: false,
    })
  },
}))

export const syncAuthStoreWithBrowserEvents = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.addEventListener(AUTH_TOKENS_UPDATED_EVENT, (event) => {
    const tokens = (event as CustomEvent<StoredAuthTokens>).detail
    useAuthStore.getState().setTokens(tokens)
  })

  window.addEventListener(AUTH_LOGOUT_EVENT, () => {
    useAuthStore.getState().logout()
  })
}
