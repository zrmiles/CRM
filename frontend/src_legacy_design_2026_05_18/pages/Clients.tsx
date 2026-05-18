import { type FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { clientsApi } from '../api/clients'
import { usersApi } from '../api/users'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { useAuthStore } from '../store/auth'
import type { Client, ClientPayload } from '../types'
import { formatDate } from '../utils/format'
import { notifySuccess } from '../utils/notifications'
import { canUserSeeAllData } from '../utils/permissions'
import { getUserLabel } from '../utils/users'

interface ClientFormState {
  first_name: string
  last_name: string
  email: string
  phone: string
  company: string
}

const emptyForm: ClientFormState = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  company: '',
}

const toClientPayload = (form: ClientFormState): ClientPayload => ({
  first_name: form.first_name.trim(),
  last_name: form.last_name.trim(),
  email: form.email.trim() || undefined,
  phone: form.phone.trim() || undefined,
  company: form.company.trim() || undefined,
})

export function Clients() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.user)
  const canSeeAll = canUserSeeAllData(currentUser)
  const [search, setSearch] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)
  const [form, setForm] = useState<ClientFormState>(emptyForm)

  const usersQuery = useQuery({
    queryKey: ['users', 'client-filter'],
    queryFn: usersApi.options,
    enabled: canSeeAll,
  })

  const clientsQuery = useQuery({
    queryKey: ['clients', { search, ownerId, page }],
    queryFn: () =>
      clientsApi.list({
        search: search || undefined,
        owner_id: canSeeAll && ownerId ? Number(ownerId) : undefined,
        page,
        per_page: 10,
      }),
  })

  const saveMutation = useMutation({
    mutationFn: (payload: ClientPayload) =>
      editingClient ? clientsApi.update(editingClient.id, payload) : clientsApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clients'] })
      setModalOpen(false)
      setEditingClient(null)
      setForm(emptyForm)
      notifySuccess(editingClient ? 'Клиент обновлен' : 'Клиент создан')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => clientsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clients'] })
      setDeletingClient(null)
      notifySuccess('Клиент удален')
    },
  })

  const openCreate = () => {
    setEditingClient(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (client: Client) => {
    setEditingClient(client)
    setForm({
      first_name: client.first_name,
      last_name: client.last_name,
      email: client.email ?? '',
      phone: client.phone ?? '',
      company: client.company ?? '',
    })
    setModalOpen(true)
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    saveMutation.mutate(toClientPayload(form))
  }

  const columns = canSeeAll ? 6 : 5

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Клиенты</h1>
          <p className="mt-1 text-sm text-slate-500">Поиск, карточки и контакты клиентов.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Добавить клиента
        </button>
      </div>

      <div className="rounded-2xl bg-white shadow-sm">
        <div className={`grid gap-3 border-b border-slate-200 p-4 ${canSeeAll ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          <label className="text-sm font-medium text-slate-700">
            Поиск
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Имя, email, телефон, компания"
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2 outline-none focus:border-cyan-500"
            />
          </label>

          {canSeeAll && (
            <label className="text-sm font-medium text-slate-700">
              Владелец
              <select
                value={ownerId}
                onChange={(event) => {
                  setOwnerId(event.target.value)
                  setPage(1)
                }}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="">Все владельцы</option>
                {usersQuery.data?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setOwnerId('')
                setPage(1)
              }}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Сбросить фильтры
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Клиент</th>
                <th className="px-4 py-3">Контакты</th>
                <th className="px-4 py-3">Компания</th>
                {canSeeAll && <th className="px-4 py-3">Владелец</th>}
                <th className="px-4 py-3">Создан</th>
                <th className="px-4 py-3">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clientsQuery.isLoading && (
                <tr>
                  <td colSpan={columns} className="px-4 py-8 text-center text-slate-500">
                    Загрузка клиентов...
                  </td>
                </tr>
              )}
              {clientsQuery.data?.items.map((client) => (
                <tr key={client.id}>
                  <td className="px-4 py-3">
                    <Link to={`/clients/${client.id}`} className="font-medium text-cyan-700">
                      {client.first_name} {client.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div>{client.email ?? '-'}</div>
                    <div>{client.phone ?? '-'}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{client.company ?? '-'}</td>
                  {canSeeAll && (
                    <td className="px-4 py-3 text-slate-600">
                      {getUserLabel(usersQuery.data, client.owner_id)}
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-600">{formatDate(client.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(client)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700"
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        disabled={deleteMutation.isPending}
                        onClick={() => setDeletingClient(client)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-red-700 disabled:opacity-50"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!clientsQuery.isLoading && !clientsQuery.data?.items.length && (
                <tr>
                  <td colSpan={columns} className="px-4 py-8 text-center text-slate-500">
                    Клиенты не найдены.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          perPage={clientsQuery.data?.per_page ?? 10}
          total={clientsQuery.data?.total ?? 0}
          onPageChange={setPage}
        />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingClient ? 'Редактировать клиента' : 'Добавить клиента'}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Имя
              <input
                required
                value={form.first_name}
                onChange={(event) => setForm({ ...form, first_name: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Фамилия
              <input
                required
                value={form.last_name}
                onChange={(event) => setForm({ ...form, last_name: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Телефон
            <input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Компания
            <input
              value={form.company}
              onChange={(event) => setForm({ ...form, company: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {saveMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingClient)}
        title="Удалить клиента"
        message={
          deletingClient
            ? `Клиент ${deletingClient.first_name} ${deletingClient.last_name} будет удален.`
            : ''
        }
        confirmLabel="Удалить"
        isPending={deleteMutation.isPending}
        onCancel={() => setDeletingClient(null)}
        onConfirm={() => {
          if (deletingClient) {
            deleteMutation.mutate(deletingClient.id)
          }
        }}
      />
    </div>
  )
}
