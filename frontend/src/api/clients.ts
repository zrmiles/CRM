import { api } from './axios'
import type { Client, ClientPayload, PaginatedResponse } from '../types'

export interface ClientListParams {
  search?: string
  owner_id?: number
  page?: number
  per_page?: number
}

export const clientsApi = {
  async list(params: ClientListParams = {}) {
    const response = await api.get<PaginatedResponse<Client>>('/clients/', { params })
    return response.data
  },

  async get(id: number) {
    const response = await api.get<Client>(`/clients/${id}`)
    return response.data
  },

  async create(payload: ClientPayload) {
    const response = await api.post<Client>('/clients/', payload)
    return response.data
  },

  async update(id: number, payload: Partial<ClientPayload>) {
    const response = await api.patch<Client>(`/clients/${id}`, payload)
    return response.data
  },

  async remove(id: number) {
    await api.delete(`/clients/${id}`)
  },
}
