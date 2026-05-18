import { api } from './axios'
import type { LoginPayload, RegisterPayload, TokenResponse, User } from '../types'

export const authApi = {
  async login(payload: LoginPayload) {
    const response = await api.post<TokenResponse>('/auth/login', payload)
    return response.data
  },

  async register(payload: RegisterPayload) {
    const response = await api.post<User>('/auth/register', payload)
    return response.data
  },

  async refresh() {
    const response = await api.post<TokenResponse>('/auth/refresh')
    return response.data
  },

  async logout() {
    await api.post('/auth/logout')
  },

  async me() {
    const response = await api.get<User>('/auth/me')
    return response.data
  },
}
