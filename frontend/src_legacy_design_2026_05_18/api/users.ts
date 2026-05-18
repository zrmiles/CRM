import { api } from './axios'
import type { RegisterPayload, User, UserOption, UserRole } from '../types'

export interface UserListParams {
  skip?: number
  limit?: number
}

export interface UserUpdatePayload {
  email?: string
  full_name?: string
  role?: UserRole
  is_active?: boolean
}

export const usersApi = {
  async list(params: UserListParams = {}) {
    const response = await api.get<User[]>('/users/', { params })
    return response.data
  },

  async options() {
    const response = await api.get<UserOption[]>('/users/options')
    return response.data
  },

  async get(id: number) {
    const response = await api.get<User>(`/users/${id}`)
    return response.data
  },

  async update(id: number, payload: UserUpdatePayload) {
    const response = await api.patch<User>(`/users/${id}`, payload)
    return response.data
  },

  async deactivate(id: number) {
    const response = await api.delete<User>(`/users/${id}`)
    return response.data
  },

  async create(payload: RegisterPayload) {
    const response = await api.post<User>('/auth/register', payload)
    return response.data
  },
}
