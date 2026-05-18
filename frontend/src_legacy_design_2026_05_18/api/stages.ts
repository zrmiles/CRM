import { api } from './axios'
import type { Stage, StagePayload } from '../types'

export const stagesApi = {
  async list() {
    const response = await api.get<Stage[]>('/stages/')
    return response.data
  },

  async seed() {
    const response = await api.post<Stage[]>('/stages/seed')
    return response.data
  },

  async create(payload: StagePayload) {
    const response = await api.post<Stage>('/stages/', payload)
    return response.data
  },

  async update(id: number, payload: Partial<StagePayload>) {
    const response = await api.patch<Stage>(`/stages/${id}`, payload)
    return response.data
  },

  async remove(id: number) {
    await api.delete(`/stages/${id}`)
  },

  async reorder(stageIds: number[]) {
    const response = await api.put<Stage[]>('/stages/reorder', { stage_ids: stageIds })
    return response.data
  },
}
