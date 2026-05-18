import type { UserOption } from '../types'
import { formatUserRole } from './format'

export const getUserLabel = (users: UserOption[] | undefined, userId?: number | null) => {
  if (!userId) {
    return '-'
  }

  const user = users?.find((item) => item.id === userId)
  if (!user) {
    return `#${userId}`
  }

  const roleLabel = formatUserRole(user.role)
  return user.full_name.trim().toLocaleLowerCase('ru-RU') === roleLabel.toLocaleLowerCase('ru-RU')
    ? roleLabel
    : `${user.full_name} (${roleLabel})`
}
