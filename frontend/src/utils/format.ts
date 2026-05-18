import type { Activity, UserRole } from '../types'

export const formatMoney = (value?: number | null) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0))

export const formatDate = (value?: string | null) => {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export const toOptionalNumber = (value: string) => {
  if (!value.trim()) {
    return undefined
  }

  return Number(value)
}

export const toDateTimeLocalValue = (value?: string | null) => {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60_000)
  return localDate.toISOString().slice(0, 16)
}

const roleLabels: Record<UserRole, string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  sales: 'Продавец',
}

export const formatUserRole = (role?: UserRole | null) => {
  if (!role) {
    return '-'
  }

  return roleLabels[role] ?? role
}

const activityTypeLabels: Record<Activity['type'], string> = {
  call: 'Звонок',
  email: 'Письмо',
  meeting: 'Встреча',
  note: 'Заметка',
}

export const formatActivityType = (type?: Activity['type'] | null) => {
  if (!type) {
    return '-'
  }

  return activityTypeLabels[type] ?? type
}
