import { api } from './axios'
import type { Activity, ActivityPayload, PaginatedResponse } from '../types'

export interface ActivityListParams {
  client_id?: number
  deal_id?: number
  activity_type?: Activity['type']
  page?: number
  per_page?: number
}

export const activitiesApi = {
  async list(params: ActivityListParams = {}) {
    const response = await api.get<PaginatedResponse<Activity>>('/activities/', { params })
    return response.data
  },

  async get(id: number) {
    const response = await api.get<Activity>(`/activities/${id}`)
    return response.data
  },

  async create(payload: ActivityPayload) {
    const response = await api.post<Activity>('/activities/', payload)
    return response.data
  },
}
