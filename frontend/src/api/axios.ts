import axios, { type InternalAxiosRequestConfig } from 'axios'
import { emitApiError } from './errors'
import {
  clearStoredTokens,
  emitAuthLogout,
  emitTokensUpdated,
  getStoredTokens,
  setStoredTokens,
  type StoredAuthTokens,
} from './tokenStorage'
import type { TokenResponse } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 15_000,
})

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 15_000,
})

let refreshPromise: Promise<StoredAuthTokens> | null = null

const isAuthRefreshRequest = (url?: string) => url?.includes('/auth/refresh') ?? false

const normalizeTokens = (response: TokenResponse): StoredAuthTokens => ({
  accessToken: response.access_token,
})

const requestTokenRefresh = () => {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post<TokenResponse>('/auth/refresh')
      .then((response) => normalizeTokens(response.data))
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

const logoutAfterAuthFailure = () => {
  clearStoredTokens()
  emitAuthLogout()

  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login')
  }
}

api.interceptors.request.use((config) => {
  const { accessToken } = getStoredTokens()

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined
    const status = error.response?.status

    if (
      status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isAuthRefreshRequest(originalRequest.url)
    ) {
      if (status !== 401) {
        emitApiError(error)
      }

      return Promise.reject(error)
    }

    try {
      originalRequest._retry = true
      const tokens = await requestTokenRefresh()

      setStoredTokens(tokens)
      emitTokensUpdated(tokens)
      originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`

      return api(originalRequest)
    } catch (refreshError) {
      logoutAfterAuthFailure()
      return Promise.reject(refreshError)
    }
  },
)
