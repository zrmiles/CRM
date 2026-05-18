import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import type { UserRole } from '../types'

interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const location = useLocation()
  const accessToken = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const isLoading = useAuthStore((state) => state.isLoading)
  const isInitialized = useAuthStore((state) => state.isInitialized)
  const fetchMe = useAuthStore((state) => state.fetchMe)

  useEffect(() => {
    if (accessToken && !user && !isInitialized) {
      void fetchMe().catch(() => undefined)
    }
  }, [accessToken, fetchMe, isInitialized, user])

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (isLoading || !isInitialized || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        Загрузка профиля...
      </div>
    )
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
