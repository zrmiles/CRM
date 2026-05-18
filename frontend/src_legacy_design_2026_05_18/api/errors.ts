import axios from 'axios'
import { notifyError } from '../utils/notifications'

export const API_ERROR_EVENT = 'mini-crm:api-error'

export interface ApiErrorEventDetail {
  message: string
  status?: number
}

const extractMessage = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object' && 'detail' in value) {
    const detail = (value as { detail?: unknown }).detail
    if (typeof detail === 'string') {
      return detail
    }
  }

  return null
}

export const getApiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return extractMessage(error.response?.data) ?? error.message ?? 'Ошибка API'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Неизвестная ошибка'
}

export const emitApiError = (error: unknown) => {
  if (typeof window === 'undefined') {
    return
  }

  const status = axios.isAxiosError(error) ? error.response?.status : undefined
  const detail: ApiErrorEventDetail = {
    message: getApiErrorMessage(error),
    status,
  }

  window.dispatchEvent(new CustomEvent(API_ERROR_EVENT, { detail }))
  notifyError(detail.message)
}
