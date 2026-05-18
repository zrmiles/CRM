import { type FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { activitiesApi } from '../api/activities'
import { clientsApi } from '../api/clients'
import { dealsApi } from '../api/deals'
import { usersApi } from '../api/users'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { useAuthStore } from '../store/auth'
import type { Activity, ActivityPayload } from '../types'
import { formatActivityType, formatDate } from '../utils/format'
import { notifySuccess } from '../utils/notifications'
import { canUserSeeAllData } from '../utils/permissions'
import { getUserLabel } from '../utils/users'

const activityTypes: Activity['type'][] = ['call', 'email', 'meeting', 'note']

const emptyForm: ActivityPayload = {
  type: 'note',
  description: '',
  client_id: 0,
}

export function Activities() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.user)
  const canSeeAll = canUserSeeAllData(currentUser)
  const [page, setPage] = useState(1)
  const [clientId, setClientId] = useState('')
  const [activityType, setActivityType] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<ActivityPayload>(emptyForm)

  const clientsQuery = useQuery({
    queryKey: ['clients', 'activity-filter'],
    queryFn: () => clientsApi.list({ per_page: 100 }),
  })
  const dealsQuery = useQuery({
    queryKey: ['deals', 'activity-filter', form.client_id],
    queryFn: () =>
      dealsApi.list({
        client_id: form.client_id || undefined,
        per_page: 100,
      }),
  })
  const usersQuery = useQuery({
    queryKey: ['users', 'activity-options'],
    queryFn: usersApi.options,
    enabled: canSeeAll,
  })
  const activitiesQuery = useQuery({
    queryKey: ['activities', { page, clientId, activityType }],
    queryFn: () =>
      activitiesApi.list({
        page,
        per_page: 10,
        client_id: clientId ? Number(clientId) : undefined,
        activity_type: activityType ? (activityType as Activity['type']) : undefined,
      }),
  })

  const createMutation = useMutation({
    mutationFn: (payload: ActivityPayload) => activitiesApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['activities'] })
      setModalOpen(false)
      setForm(emptyForm)
      notifySuccess('Активность добавлена')
    },
  })

  const deals = useMemo(
    () => dealsQuery.data?.items ?? [],
    [dealsQuery.data?.items],
  )

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createMutation.mutate(form)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Активности</h1>
          <p className="page-subtitle">Хронологический лог коммуникаций.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Добавить активность
        </button>
      </div>

      <section className="grid gap-3 rounded-lg bg-white p-4 shadow-sm md:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">
          Тип
          <select
            value={activityType}
            onChange={(event) => {
              setActivityType(event.target.value)
              setPage(1)
            }}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">Все типы</option>
            {activityTypes.map((type) => (
              <option key={type} value={type}>
                {formatActivityType(type)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Клиент
          <select
            value={clientId}
            onChange={(event) => {
              setClientId(event.target.value)
              setPage(1)
            }}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">Все клиенты</option>
            {clientsQuery.data?.items.map((client) => (
              <option key={client.id} value={client.id}>
                {client.first_name} {client.last_name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setActivityType('')
              setClientId('')
              setPage(1)
            }}
            className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Сбросить
          </button>
        </div>
      </section>

      <section className="app-panel rounded-lg">
        <div className="divide-y divide-slate-100">
          {activitiesQuery.isLoading && <p className="p-6 text-slate-500">Загрузка активностей...</p>}
          {activitiesQuery.data?.items.map((activity) => {
            const client = clientsQuery.data?.items.find((item) => item.id === activity.client_id)
            const deal = deals.find((item) => item.id === activity.deal_id)
            return (
              <article key={activity.id} className="flex gap-4 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-sm font-bold uppercase text-cyan-700">
                  {formatActivityType(activity.type).slice(0, 1)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium uppercase text-cyan-700">{formatActivityType(activity.type)}</p>
                    <p className="text-sm text-slate-400">{formatDate(activity.created_at)}</p>
                  </div>
                  <p className="mt-1 text-slate-800">{activity.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span>Клиент:</span>
                    {client ? (
                      <Link to={`/clients/${client.id}`} className="font-medium text-cyan-700">
                        {client.first_name} {client.last_name}
                      </Link>
                    ) : (
                      <span>{activity.client_id}</span>
                    )}
                    {activity.deal_id && (
                      <>
                        <span>·</span>
                        <Link to={`/deals/${activity.deal_id}`} className="font-medium text-cyan-700">
                          {deal?.title ?? `Сделка #${activity.deal_id}`}
                        </Link>
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Автор: {canSeeAll ? getUserLabel(usersQuery.data, activity.user_id) : 'Вы'}
                  </p>
                </div>
              </article>
            )
          })}
          {!activitiesQuery.isLoading && !activitiesQuery.data?.items.length && (
            <p className="p-6 text-slate-500">Активности не найдены.</p>
          )}
        </div>
        <Pagination
          page={page}
          perPage={activitiesQuery.data?.per_page ?? 10}
          total={activitiesQuery.data?.total ?? 0}
          onPageChange={setPage}
        />
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Добавить активность">
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Клиент
            <select
              required
              value={form.client_id || ''}
              onChange={(event) =>
                setForm({
                  ...form,
                  client_id: Number(event.target.value),
                  deal_id: undefined,
                })
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">Выберите клиента</option>
              {clientsQuery.data?.items.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.first_name} {client.last_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Сделка
            <select
              disabled={!form.client_id}
              value={form.deal_id ?? ''}
              onChange={(event) =>
                setForm({
                  ...form,
                  deal_id: event.target.value ? Number(event.target.value) : undefined,
                })
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">Без сделки</option>
              {deals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Тип
            <select
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value as Activity['type'] })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              {activityTypes.map((type) => (
                <option key={type} value={type}>
                  {formatActivityType(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Описание
            <textarea
              required
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="mt-1 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full rounded-md bg-slate-950 px-3 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            {createMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
