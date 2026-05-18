import { api } from './axios'
import type { FunnelReport } from '../types'

export interface FunnelReportParams {
  date_from?: string
  date_to?: string
  owner_id?: number
}

export const reportsApi = {
  async funnel(params: FunnelReportParams = {}) {
    const response = await api.get<FunnelReport>('/reports/funnel', { params })
    return response.data
  },
}
