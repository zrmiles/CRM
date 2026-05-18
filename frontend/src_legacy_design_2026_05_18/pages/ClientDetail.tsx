import { type FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { activitiesApi } from '../api/activities'
import { clientsApi } from '../api/clients'
import { dealsApi } from '../api/deals'
import { stagesApi } from '../api/stages'
import { usersApi } from '../api/users'
import { Modal } from '../components/Modal'
import { useAuthStore } from '../store/auth'
import type {
  Activity,
  ActivityPayload,
  ClientPayload,
  DealPayload,
} from '../types'
import { formatActivityType, formatDate, formatMoney } from '../utils/format'
import { notifySuccess } from '../utils/notifications'
import { canUserSeeAllData } from '../utils/permissions'
import { getUserLabel } from '../utils/users'

const activityTypes: Activity['type'][] = ['call', 'email', 'meeting', 'note']

interface ClientFormState {
  first_name: string
  last_name: string
  email: string
  phone: string
  company: string
}

interface DealFormState {
  title: string
  stage_id: string
  amount: string
  description: string
}

const toClientPayload = (form: ClientFormState): ClientPayload => ({
  first_name: form.first_name.trim(),
  last_name: form.last_name.trim(),
  email: form.email.trim() || undefined,
  phone: form.phone.trim() || undefined,
  company: form.company.trim() || undefined,
})

export function ClientDetail() {
  const { id } = useParams()
  const clientId = Number(id)
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.user)
  const canSeeAll = canUserSeeAllData(currentUser)
  const [activityOpen, setActivityOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [dealOpen, setDealOpen] = useState(false)
  const [activityForm, setActivityForm] = useState<ActivityPayload>({
    type: 'note',
    description: '',
    client_id: clientId,
  })
  const [clientForm, setClientForm] = useState<ClientFormState>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
  })
  const [dealForm, setDealForm] = useState<DealFormState>({
    title: '',
    stage_id: '',
    amount: '',
    description: '',
  })

  const clientQuery = useQuery({
    queryKey: ['clients', clientId],
    queryFn: () => clientsApi.get(clientId),
    enabled: Boolean(clientId),
  })
  const dealsQuery = useQuery({
    queryKey: ['deals', 'client', clientId],
    queryFn: () => dealsApi.list({ client_id: clientId, per_page: 100 }),
    enabled: Boolean(clientId),
  })
  const activitiesQuery = useQuery({
    queryKey: ['activities', 'client', clientId],
    queryFn: () => activitiesApi.list({ client_id: clientId, per_page: 20 }),
    enabled: Boolean(clientId),
  })
  const stagesQuery = useQuery({
    queryKey: ['stages'],
    queryFn: stagesApi.list,
  })
  const usersQuery = useQuery({
    queryKey: ['users', 'client-detail-options'],
    queryFn: usersApi.options,
    enabled: canSeeAll,
  })

  const createActivityMutation = useMutation({
    mutationFn: (payload: ActivityPayload) => activitiesApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['activities', 'client', clientId] })
      await queryClient.invalidateQueries({ queryKey: ['activities'] })
      setActivityForm({ type: 'note', description: '', client_id: clientId })
      setActivityOpen(false)
      notifySuccess('Активность добавлена')
    },
  })

  const updateClientMutation = useMutation({
    mutationFn: (payload: ClientPayload) => clientsApi.update(clientId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clients'] })
      setEditOpen(false)
      notifySuccess('Клиент обновлен')
    },
  })

  const createDealMutation = useMutation({
    mutationFn: (payload: DealPayload) => dealsApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['deals'] })
      setDealOpen(false)
      setDealForm({
        title: '',
        stage_id: '',
        amount: '',
        description: '',
      })
      notifySuccess('Сделка создана')
    },
  })

  const onActivitySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createActivityMutation.mutate(activityForm)
  }

  const onClientSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    updateClientMutation.mutate(toClientPayload(clientForm))
  }

  const onDealSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createDealMutation.mutate({
      title: dealForm.title.trim(),
      client_id: clientId,
      stage_id: Number(dealForm.stage_id),
      amount: dealForm.amount.trim() ? Number(dealForm.amount) : undefined,
      description: dealForm.description.trim() || undefined,
    })
  }

  if (clientQuery.isLoading) {
    return <div className="rounded-2xl bg-white p-6 text-slate-500">Загрузка клиента...</div>
  }

  if (!clientQuery.data) {
    return <div className="rounded-2xl bg-white p-6 text-slate-500">Клиент не найден.</div>
  }

  const client = clientQuery.data
  const stagesMap = new Map((stagesQuery.data ?? []).map((stage) => [stage.id, stage.name]))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">
            {client.first_name} {client.last_name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{client.company ?? 'Без компании'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setClientForm({
                first_name: client.first_name,
                last_name: client.last_name,
                email: client.email ?? '',
                phone: client.phone ?? '',
                company: client.company ?? '',
              })
              setEditOpen(true)
            }}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Редактировать
          </button>
          <button
            type="button"
            onClick={() => {
              setDealForm({
                title: '',
                stage_id: String(stagesQuery.data?.[0]?.id ?? ''),
                amount: '',
                description: '',
              })
              setDealOpen(true)
            }}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Новая сделка
          </button>
          <button
            type="button"
            onClick={() => setActivityOpen(true)}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          >
            Добавить активность
          </button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Email</p>
          <p className="mt-2 font-medium">{client.email ?? '-'}</p>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Телефон</p>
          <p className="mt-2 font-medium">{client.phone ?? '-'}</p>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Владелец</p>
          <p className="mt-2 font-medium">
            {canSeeAll ? getUserLabel(usersQuery.data, client.owner_id) : 'Вы'}
          </p>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Создан</p>
          <p className="mt-2 font-medium">{formatDate(client.created_at)}</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Сделки клиента</h2>
          <div className="mt-4 space-y-3">
            {dealsQuery.isLoading && <p className="text-sm text-slate-500">Загрузка сделок...</p>}
            {dealsQuery.data?.items.map((deal) => (
              <Link
                key={deal.id}
                to={`/deals/${deal.id}`}
                className="block rounded-xl border border-slate-200 p-4 hover:border-cyan-300"
              >
                <p className="font-medium text-slate-950">{deal.title}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {stagesMap.get(deal.stage_id) ?? `Стадия #${deal.stage_id}`} · {formatMoney(deal.amount)}
                </p>
              </Link>
            ))}
            {!dealsQuery.data?.items.length && (
              <p className="text-sm text-slate-500">Сделок по клиенту пока нет.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Лента активностей</h2>
          <div className="mt-4 space-y-3">
            {activitiesQuery.isLoading && <p className="text-sm text-slate-500">Загрузка активностей...</p>}
            {activitiesQuery.data?.items.map((activity) => (
              <div key={activity.id} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-medium uppercase text-cyan-700">{formatActivityType(activity.type)}</p>
                <p className="mt-1">{activity.description}</p>
                {activity.deal_id && (
                  <Link
                    to={`/deals/${activity.deal_id}`}
                    className="mt-2 inline-flex text-sm font-medium text-cyan-700"
                  >
                    Сделка #{activity.deal_id}
                  </Link>
                )}
                <p className="mt-2 text-xs text-slate-500">{formatDate(activity.created_at)}</p>
              </div>
            ))}
            {!activitiesQuery.data?.items.length && (
              <p className="text-sm text-slate-500">Активностей пока нет.</p>
            )}
          </div>
        </div>
      </section>

      <Modal open={activityOpen} onClose={() => setActivityOpen(false)} title="Добавить активность">
        <form onSubmit={onActivitySubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Сделка
            <select
              value={activityForm.deal_id ?? ''}
              onChange={(event) =>
                setActivityForm({
                  ...activityForm,
                  deal_id: event.target.value ? Number(event.target.value) : undefined,
                })
              }
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            >
              <option value="">Без сделки</option>
              {dealsQuery.data?.items.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Тип
            <select
              value={activityForm.type}
              onChange={(event) =>
                setActivityForm({ ...activityForm, type: event.target.value as Activity['type'] })
              }
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
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
              value={activityForm.description}
              onChange={(event) =>
                setActivityForm({ ...activityForm, description: event.target.value })
              }
              className="mt-1 min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={createActivityMutation.isPending}
            className="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {createActivityMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Редактировать клиента">
        <form onSubmit={onClientSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Имя
              <input
                required
                value={clientForm.first_name}
                onChange={(event) => setClientForm({ ...clientForm, first_name: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Фамилия
              <input
                required
                value={clientForm.last_name}
                onChange={(event) => setClientForm({ ...clientForm, last_name: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              value={clientForm.email}
              onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Телефон
            <input
              value={clientForm.phone}
              onChange={(event) => setClientForm({ ...clientForm, phone: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Компания
            <input
              value={clientForm.company}
              onChange={(event) => setClientForm({ ...clientForm, company: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={updateClientMutation.isPending}
            className="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {updateClientMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </form>
      </Modal>

      <Modal open={dealOpen} onClose={() => setDealOpen(false)} title="Новая сделка">
        <form onSubmit={onDealSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Название
            <input
              required
              value={dealForm.title}
              onChange={(event) => setDealForm({ ...dealForm, title: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Стадия
            <select
              required
              value={dealForm.stage_id}
              onChange={(event) => setDealForm({ ...dealForm, stage_id: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            >
              {stagesQuery.data?.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Сумма
            <input
              type="number"
              min="0"
              value={dealForm.amount}
              onChange={(event) => setDealForm({ ...dealForm, amount: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Описание
            <textarea
              value={dealForm.description}
              onChange={(event) => setDealForm({ ...dealForm, description: event.target.value })}
              className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={createDealMutation.isPending}
            className="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {createDealMutation.isPending ? 'Создаем...' : 'Создать'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
