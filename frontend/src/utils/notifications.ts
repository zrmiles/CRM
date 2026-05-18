export type NotificationType = 'success' | 'error' | 'info'

export const APP_NOTIFICATION_EVENT = 'mini-crm:notification'

export interface NotificationDetail {
  message: string
  type: NotificationType
}

export const emitNotification = (detail: NotificationDetail) => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(APP_NOTIFICATION_EVENT, { detail }))
}

export const notifySuccess = (message: string) => {
  emitNotification({ message, type: 'success' })
}

export const notifyError = (message: string) => {
  emitNotification({ message, type: 'error' })
}

export const notifyInfo = (message: string) => {
  emitNotification({ message, type: 'info' })
}
