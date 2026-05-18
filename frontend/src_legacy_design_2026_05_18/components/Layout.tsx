import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/auth'

const baseNav = [
  { to: '/dashboard', label: 'Дашборд' },
  { to: '/clients', label: 'Клиенты' },
  { to: '/deals', label: 'Сделки' },
  { to: '/tasks', label: 'Задачи' },
  { to: '/activities', label: 'Активности' },
  { to: '/reports', label: 'Отчеты' },
]

const adminNav = [
  { to: '/users', label: 'Пользователи' },
  { to: '/stages', label: 'Стадии' },
]

export function Layout() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const nav = user?.role === 'admin' ? [...baseNav, ...adminNav] : baseNav

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white p-5 lg:block">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-600">Mini-CRM</p>
          <p className="mt-2 text-sm text-slate-500">Управление продажами</p>
        </div>

        <nav className="mt-8 flex flex-col gap-2">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'rounded-xl px-4 py-2 text-sm font-medium transition',
                  isActive ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur">
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
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Выйти
            </button>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'whitespace-nowrap rounded-full px-3 py-1.5 text-sm',
                    isActive ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
