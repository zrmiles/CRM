import { useEffect, useState } from 'react'
import { API_ERROR_EVENT, type ApiErrorEventDetail } from '../api/errors'
import {
  APP_NOTIFICATION_EVENT,
  type NotificationDetail,
} from '../utils/notifications'

interface ToastState {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

export function ToastHost() {
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    let timeoutId: number | null = null

    const showToast = (detail: NotificationDetail) => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }

      setToast({
        id: Date.now(),
        message: detail.message,
        type: detail.type,
      })

      timeoutId = window.setTimeout(() => setToast(null), 4_000)
    }

    const onError = (event: Event) => {
      const detail = (event as CustomEvent<ApiErrorEventDetail>).detail
      showToast({ message: detail.message, type: 'error' })
    }

    const onNotification = (event: Event) => {
      const detail = (event as CustomEvent<NotificationDetail>).detail
      showToast(detail)
    }

    window.addEventListener(API_ERROR_EVENT, onError)
    window.addEventListener(APP_NOTIFICATION_EVENT, onNotification)

    return () => {
      window.removeEventListener(API_ERROR_EVENT, onError)
      window.removeEventListener(APP_NOTIFICATION_EVENT, onNotification)
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [])

  if (!toast) {
    return null
  }

  const toneClass =
    toast.type === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : toast.type === 'info'
        ? 'border-cyan-200 bg-cyan-50 text-cyan-800'
        : 'border-red-200 bg-red-50 text-red-800'

  return (
    <div
      className={`fixed right-4 top-4 z-50 max-w-sm rounded-md border px-4 py-3 text-sm shadow-lg ${toneClass}`}
    >
      {toast.message}
    </div>
  )
}
