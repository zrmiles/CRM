import { api } from './axios'
import type { PaginatedResponse, Task, TaskPayload, TaskUpdatePayload } from '../types'

export interface TaskListParams {
  deal_id?: number
  assignee_id?: number
  is_completed?: boolean
  page?: number
  per_page?: number
}

export const tasksApi = {
  async list(params: TaskListParams = {}) {
    const response = await api.get<PaginatedResponse<Task>>('/tasks/', { params })
    return response.data
  },

  async get(id: number) {
    const response = await api.get<Task>(`/tasks/${id}`)
    return response.data
  },

  async create(payload: TaskPayload) {
    const response = await api.post<Task>('/tasks/', payload)
    return response.data
  },

  async update(id: number, payload: TaskUpdatePayload) {
    const response = await api.patch<Task>(`/tasks/${id}`, payload)
    return response.data
  },

  async complete(id: number) {
    const response = await api.patch<Task>(`/tasks/${id}/complete`)
    return response.data
  },

  async remove(id: number) {
    await api.delete(`/tasks/${id}`)
  },
}
