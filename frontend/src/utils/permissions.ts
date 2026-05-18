import type { User, UserRole } from '../types'

export const isAdminRole = (role?: UserRole | null) => role === 'admin'

export const canSeeAllData = (role?: UserRole | null) =>
  role === 'admin' || role === 'manager'

export const canReassign = (role?: UserRole | null) =>
  role === 'admin' || role === 'manager'

export const isSalesRole = (role?: UserRole | null) => role === 'sales'

export const isAdminUser = (user?: User | null) => isAdminRole(user?.role)

export const canUserSeeAllData = (user?: User | null) => canSeeAllData(user?.role)

export const canUserReassign = (user?: User | null) => canReassign(user?.role)
