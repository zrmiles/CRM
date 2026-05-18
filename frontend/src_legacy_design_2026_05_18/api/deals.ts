import { api } from './axios'
import type { Deal, DealPayload, DealUpdatePayload, PaginatedResponse } from '../types'

export interface DealListParams {
  stage_id?: number
  client_id?: number
  owner_id?: number
  amount_min?: number
  amount_max?: number
  page?: number
  per_page?: number
}

export const dealsApi = {
  async list(params: DealListParams = {}) {
    const response = await api.get<PaginatedResponse<Deal>>('/deals/', { params })
    return response.data
  },

  async get(id: number) {
    const response = await api.get<Deal>(`/deals/${id}`)
    return response.data
  },

  async create(payload: DealPayload) {
    const response = await api.post<Deal>('/deals/', payload)
    return response.data
  },

  async update(id: number, payload: DealUpdatePayload) {
    const response = await api.patch<Deal>(`/deals/${id}`, payload)
    return response.data
  },

  async remove(id: number) {
    await api.delete(`/deals/${id}`)
  },
}
