import { type FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api/users'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import { useAuthStore } from '../store/auth'
import type { RegisterPayload, User, UserRole } from '../types'
import { formatDate, formatUserRole } from '../utils/format'
import { notifySuccess } from '../utils/notifications'

const roles: UserRole[] = ['admin', 'manager', 'sales']

const emptyUserForm: RegisterPayload = {
  email: '',
  password: '',
  full_name: '',
  role: 'sales',
}

export function Users() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.user)
  const [modalOpen, setModalOpen] = useState(false)
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null)
  const [form, setForm] = useState<RegisterPayload>(emptyUserForm)

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list({ limit: 100 }),
  })

  const createMutation = useMutation({
    mutationFn: (payload: RegisterPayload) => usersApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      setModalOpen(false)
      setForm(emptyUserForm)
      notifySuccess('Пользователь создан')
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => usersApi.deactivate(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeactivatingUser(null)
      notifySuccess('Пользователь деактивирован')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      role,
      is_active,
    }: {
      id: number
      role?: UserRole
      is_active?: boolean
    }) => usersApi.update(id, { role, is_active }),
    onSuccess: async (_, payload) => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      notifySuccess(payload.is_active === true ? 'Пользователь активирован' : 'Роль обновлена')
    },
  })

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createMutation.mutate({
      email: form.email.trim(),
      password: form.password,
      full_name: form.full_name.trim(),
      role: form.role,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Пользователи</h1>
          <p className="page-subtitle">Управление учетными записями доступно администраторам.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Добавить пользователя
        </button>
      </div>

      <div className="app-panel rounded-lg">
        <div className="overflow-x-auto">
          <table className="table-compact">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Почта</th>
                <th className="px-3 py-2.5">Имя</th>
                <th className="px-3 py-2.5">Роль</th>
                <th className="px-3 py-2.5">Статус</th>
                <th className="px-3 py-2.5">Создан</th>
                <th className="px-3 py-2.5">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usersQuery.isLoading && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    Загрузка пользователей...
                  </td>
                </tr>
              )}
              {usersQuery.data?.map((user) => {
                const isSelf = currentUser?.id === user.id
                return (
                  <tr key={user.id}>
                    <td className="px-3 py-2.5 font-medium text-slate-950">{user.email}</td>
                    <td className="px-3 py-2.5 text-slate-600">{user.full_name}</td>
                    <td className="px-3 py-2.5">
                      <select
                        value={user.role}
                        disabled={updateMutation.isPending || isSelf}
                        onChange={(event) =>
                          updateMutation.mutate({ id: user.id, role: event.target.value as UserRole })
                        }
                        className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-60"
                      >
                        {roles.map((role) => (
                          <option key={role} value={role}>
                            {formatUserRole(role)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={[
                          'rounded-full px-3 py-1 text-xs font-medium',
                          user.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
                        ].join(' ')}
                      >
                        {user.is_active ? 'Активен' : 'Неактивен'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{formatDate(user.created_at)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={deactivateMutation.isPending || isSelf || !user.is_active}
                          onClick={() => setDeactivatingUser(user)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-red-700 disabled:opacity-50"
                        >
                          Деактивировать
                        </button>
                        {!user.is_active && (
                          <button
                            type="button"
                            disabled={updateMutation.isPending}
                            onClick={() => updateMutation.mutate({ id: user.id, is_active: true })}
                            className="rounded-lg border border-emerald-200 px-3 py-1.5 text-emerald-700 disabled:opacity-50"
                          >
                            Активировать
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Добавить пользователя">
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Электронная почта
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Полное имя
            <input
              required
              value={form.full_name}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Пароль
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Роль
            <select
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {formatUserRole(role)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full rounded-md bg-slate-950 px-3 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            {createMutation.isPending ? 'Создаем...' : 'Создать'}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivatingUser)}
        title="Деактивировать пользователя"
        message={deactivatingUser ? `Пользователь ${deactivatingUser.email} потеряет доступ к системе.` : ''}
        confirmLabel="Деактивировать"
        isPending={deactivateMutation.isPending}
        onCancel={() => setDeactivatingUser(null)}
        onConfirm={() => {
          if (deactivatingUser) {
            deactivateMutation.mutate(deactivatingUser.id)
          }
        }}
      />
    </div>
  )
}
