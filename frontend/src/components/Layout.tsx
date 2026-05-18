import {
  Activity,
  BarChart3,
  CheckSquare,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Settings2,
  Users,
  Workflow,
} from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/auth'

const baseNav = [
  { to: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { to: '/clients', label: 'Клиенты', icon: Users },
  { to: '/deals', label: 'Сделки', icon: KanbanSquare },
  { to: '/tasks', label: 'Задачи', icon: CheckSquare },
  { to: '/activities', label: 'Активности', icon: Activity },
  { to: '/reports', label: 'Отчеты', icon: BarChart3 },
]

const adminNav = [
  { to: '/users', label: 'Пользователи', icon: Settings2 },
  { to: '/stages', label: 'Стадии', icon: Workflow },
]

export function Layout() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const nav = user?.role === 'admin' ? [...baseNav, ...adminNav] : baseNav

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 lg:block">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Mini-CRM</p>
          <p className="mt-1 text-sm text-slate-500">Операционная панель продаж</p>
        </div>

        <nav className="mt-7 flex flex-col gap-1">
          {nav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition',
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
                  ].join(' ')
                }
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-5 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">{user?.full_name}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                void authApi.logout().catch(() => undefined)
                logout()
                navigate('/login', { replace: true })
              }}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Выйти
            </button>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
            {nav.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      'inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm',
                      isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700',
                    ].join(' ')
                  }
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>
        </header>

        <main className="px-4 py-5 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
