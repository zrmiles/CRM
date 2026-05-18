import { type FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clientsApi } from '../api/clients'
import { dealsApi } from '../api/deals'
import { stagesApi } from '../api/stages'
import { usersApi } from '../api/users'
import { KanbanBoard } from '../components/KanbanBoard'
import { Modal } from '../components/Modal'
import { useAuthStore } from '../store/auth'
import type { Deal, DealPayload, PaginatedResponse } from '../types'
import { notifyError, notifySuccess } from '../utils/notifications'
import { canUserSeeAllData } from '../utils/permissions'
import { toOptionalNumber } from '../utils/format'

interface DealFormState {
  title: string
  client_id: string
  stage_id: string
  amount: string
  description: string
}

const emptyDealForm: DealFormState = {
  title: '',
  client_id: '',
  stage_id: '',
  amount: '',
  description: '',
}

export function Deals() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.user)
  const canSeeAll = canUserSeeAllData(currentUser)
  const [clientId, setClientId] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<DealFormState>(emptyDealForm)
  const amountRangeInvalid =
    amountMin.trim() !== '' &&
    amountMax.trim() !== '' &&
    Number(amountMin) > Number(amountMax)
  const dealsQueryKey = ['deals', 'kanban', { clientId, ownerId, amountMin, amountMax }]

  const stagesQuery = useQuery({
    queryKey: ['stages'],
    queryFn: stagesApi.list,
  })
  const clientsQuery = useQuery({
    queryKey: ['clients', 'select'],
    queryFn: () => clientsApi.list({ per_page: 100 }),
  })
  const usersQuery = useQuery({
    queryKey: ['users', 'deal-filter'],
    queryFn: usersApi.options,
    enabled: canSeeAll,
  })
  const dealsQuery = useQuery({
    queryKey: dealsQueryKey,
    queryFn: () =>
      dealsApi.list({
        client_id: toOptionalNumber(clientId),
        owner_id: canSeeAll ? toOptionalNumber(ownerId) : undefined,
        amount_min: toOptionalNumber(amountMin),
        amount_max: toOptionalNumber(amountMax),
        per_page: 100,
      }),
    enabled: !amountRangeInvalid,
  })

  const createMutation = useMutation({
    mutationFn: (payload: DealPayload) => dealsApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['deals'] })
      setModalOpen(false)
      setForm(emptyDealForm)
      notifySuccess('Сделка создана')
    },
  })

  const moveMutation = useMutation({
    mutationFn: ({ dealId, stageId }: { dealId: number; stageId: number }) =>
      dealsApi.update(dealId, { stage_id: stageId }),
    onMutate: async ({ dealId, stageId }) => {
      await queryClient.cancelQueries({ queryKey: dealsQueryKey })
      const previous = queryClient.getQueryData<PaginatedResponse<Deal>>(dealsQueryKey)

      queryClient.setQueryData<PaginatedResponse<Deal>>(dealsQueryKey, (current) =>
        current
          ? {
              ...current,
              items: current.items.map((deal) =>
                deal.id === dealId ? { ...deal, stage_id: stageId } : deal,
              ),
            }
          : current,
      )

      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(dealsQueryKey, context.previous)
      }
      notifyError('Не удалось обновить стадию сделки')
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['deals'] })
      notifySuccess('Стадия сделки обновлена')
    },
  })

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (form.amount.trim() && Number(form.amount) < 0) {
      notifyError('Сумма сделки не может быть отрицательной')
      return
    }

    createMutation.mutate({
      title: form.title.trim(),
      client_id: Number(form.client_id),
      stage_id: Number(form.stage_id),
      amount: toOptionalNumber(form.amount),
      description: form.description.trim() || undefined,
    })
  }

  const stages = stagesQuery.data ?? []
  const clients = clientsQuery.data?.items ?? []
  const deals = dealsQuery.data?.items ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Сделки</h1>
          <p className="mt-1 text-sm text-slate-500">Kanban-доска продаж по стадиям.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm({ ...emptyDealForm, stage_id: String(stages[0]?.id ?? '') })
            setModalOpen(true)
          }}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Новая сделка
        </button>
      </div>

      <section className={`grid gap-3 rounded-2xl bg-white p-4 shadow-sm ${canSeeAll ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
        <label className="text-sm font-medium text-slate-700">
          Клиент
          <select
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          >
            <option value="">Все клиенты</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.first_name} {client.last_name}
              </option>
            ))}
          </select>
        </label>

        {canSeeAll && (
          <label className="text-sm font-medium text-slate-700">
            Владелец
            <select
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
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

        <label className="text-sm font-medium text-slate-700">
          Сумма от
          <input
            type="number"
            min="0"
            value={amountMin}
            onChange={(event) => setAmountMin(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Сумма до
          <input
            type="number"
            min="0"
            value={amountMax}
            onChange={(event) => setAmountMax(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setClientId('')
              setOwnerId('')
              setAmountMin('')
              setAmountMax('')
            }}
            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Сбросить
          </button>
        </div>
      </section>
      {amountRangeInvalid && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Сумма от не может быть больше суммы до.
        </p>
      )}

      {stagesQuery.isLoading || dealsQuery.isLoading ? (
        <div className="rounded-2xl bg-white p-6 text-slate-500">Загрузка доски...</div>
      ) : amountRangeInvalid ? (
        <div className="rounded-2xl bg-white p-6 text-slate-500">Исправьте фильтр суммы.</div>
      ) : (
        <KanbanBoard
          stages={stages}
          deals={deals}
          onMoveDeal={(dealId, stageId) => moveMutation.mutate({ dealId, stageId })}
          isUpdating={moveMutation.isPending}
        />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Новая сделка">
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Название
            <input
              required
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Клиент
            <select
              required
              value={form.client_id}
              onChange={(event) => setForm({ ...form, client_id: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            >
              <option value="">Выберите клиента</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.first_name} {client.last_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Стадия
            <select
              required
              value={form.stage_id}
              onChange={(event) => setForm({ ...form, stage_id: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            >
              {stages.map((stage) => (
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
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Описание
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {createMutation.isPending ? 'Создаем...' : 'Создать'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
