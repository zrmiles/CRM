import { type FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { activitiesApi } from '../api/activities'
import { clientsApi } from '../api/clients'
import { dealsApi } from '../api/deals'
import { stagesApi } from '../api/stages'
import { tasksApi } from '../api/tasks'
import { usersApi } from '../api/users'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import { useAuthStore } from '../store/auth'
import type {
  Activity,
  ActivityPayload,
  Deal,
  DealUpdatePayload,
  Task,
  TaskPayload,
} from '../types'
import {
  formatActivityType,
  formatDate,
  formatMoney,
  toDateTimeLocalValue,
  toOptionalNumber,
} from '../utils/format'
import { notifySuccess } from '../utils/notifications'
import { canUserReassign } from '../utils/permissions'
import { getUserLabel } from '../utils/users'

interface DealFormState {
  title: string
  client_id: string
  stage_id: string
  amount: string
  description: string
  owner_id: string
}

interface TaskFormState {
  title: string
  description: string
  due_date: string
  assignee_id: string
}

const emptyTaskForm: TaskFormState = {
  title: '',
  description: '',
  due_date: '',
  assignee_id: '',
}

const activityTypes: Activity['type'][] = ['call', 'email', 'meeting', 'note']

const getDealForm = (deal: Deal): DealFormState => ({
  title: deal.title,
  client_id: String(deal.client_id),
  stage_id: String(deal.stage_id),
  amount: deal.amount ? String(deal.amount) : '',
  description: deal.description ?? '',
  owner_id: String(deal.owner_id),
})

const getTaskForm = (task?: Task | null): TaskFormState =>
  task
    ? {
        title: task.title,
        description: task.description ?? '',
        due_date: toDateTimeLocalValue(task.due_date),
        assignee_id: String(task.assignee_id),
      }
    : emptyTaskForm

export function DealDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const dealId = Number(id)
  const currentUser = useAuthStore((state) => state.user)
  const canReassign = canUserReassign(currentUser)
  const queryClient = useQueryClient()
  const [dealOpen, setDealOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)
  const [deleteDealOpen, setDeleteDealOpen] = useState(false)
  const [dealForm, setDealForm] = useState<DealFormState | null>(null)
  const [taskForm, setTaskForm] = useState<TaskFormState>(emptyTaskForm)
  const [activityForm, setActivityForm] = useState<ActivityPayload>({
    type: 'note',
    description: '',
    client_id: 0,
  })

  const dealQuery = useQuery({
    queryKey: ['deals', dealId],
    queryFn: () => dealsApi.get(dealId),
    enabled: Boolean(dealId),
  })
  const clientQuery = useQuery({
    queryKey: ['clients', dealQuery.data?.client_id],
    queryFn: () => clientsApi.get(Number(dealQuery.data?.client_id)),
    enabled: Boolean(dealQuery.data?.client_id),
  })
  const clientsQuery = useQuery({
    queryKey: ['clients', 'detail-select'],
    queryFn: () => clientsApi.list({ per_page: 100 }),
  })
  const stagesQuery = useQuery({
    queryKey: ['stages'],
    queryFn: stagesApi.list,
  })
  const usersQuery = useQuery({
    queryKey: ['users', 'deal-detail'],
    queryFn: usersApi.options,
    enabled: canReassign,
  })
  const tasksQuery = useQuery({
    queryKey: ['tasks', 'deal', dealId],
    queryFn: () => tasksApi.list({ deal_id: dealId, per_page: 50 }),
    enabled: Boolean(dealId),
  })
  const activitiesQuery = useQuery({
    queryKey: ['activities', 'deal', dealId],
    queryFn: () => activitiesApi.list({ deal_id: dealId, per_page: 20 }),
    enabled: Boolean(dealId),
  })

  const taskMap = useMemo(
    () => new Map((tasksQuery.data?.items ?? []).map((task) => [task.id, task])),
    [tasksQuery.data?.items],
  )

  const updateDealMutation = useMutation({
    mutationFn: (payload: DealUpdatePayload) => dealsApi.update(dealId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['deals'] })
      setDealOpen(false)
      notifySuccess('Сделка обновлена')
    },
  })

  const deleteDealMutation = useMutation({
    mutationFn: () => dealsApi.remove(dealId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['deals'] })
      notifySuccess('Сделка удалена')
      navigate('/deals', { replace: true })
    },
  })

  const saveTaskMutation = useMutation({
    mutationFn: (payload: TaskPayload) =>
      editingTask ? tasksApi.update(editingTask.id, payload) : tasksApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setTaskForm(emptyTaskForm)
      setEditingTask(null)
      setTaskOpen(false)
      notifySuccess(editingTask ? 'Задача обновлена' : 'Задача создана')
    },
  })

  const completeTaskMutation = useMutation({
    mutationFn: (taskId: number) => tasksApi.complete(taskId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      notifySuccess('Задача отмечена выполненной')
    },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) => tasksApi.remove(taskId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setDeletingTask(null)
      notifySuccess('Задача удалена')
    },
  })

  const createActivityMutation = useMutation({
    mutationFn: (payload: ActivityPayload) => activitiesApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['activities'] })
      setActivityOpen(false)
      setActivityForm({
        type: 'note',
        description: '',
        client_id: dealQuery.data?.client_id ?? 0,
        deal_id: dealId,
      })
      notifySuccess('Активность добавлена')
    },
  })

  const onDealSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!dealForm) {
      return
    }

    const payload: DealUpdatePayload = {
      title: dealForm.title.trim(),
      client_id: Number(dealForm.client_id),
      stage_id: Number(dealForm.stage_id),
      amount: dealForm.amount.trim() ? Number(dealForm.amount) : undefined,
      description: dealForm.description.trim() || undefined,
    }

    if (canReassign && dealForm.owner_id.trim()) {
      payload.owner_id = Number(dealForm.owner_id)
    }

    updateDealMutation.mutate(payload)
  }

  const onTaskSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const payload: TaskPayload = {
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || undefined,
      due_date: taskForm.due_date || undefined,
      assignee_id: canReassign ? toOptionalNumber(taskForm.assignee_id) : undefined,
      deal_id: dealId,
    }

    saveTaskMutation.mutate(payload)
  }

  const onActivitySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createActivityMutation.mutate(activityForm)
  }

  if (dealQuery.isLoading) {
    return <div className="app-panel rounded-lg p-5 text-slate-500">Загрузка сделки...</div>
  }

  if (!dealQuery.data) {
    return <div className="app-panel rounded-lg p-5 text-slate-500">Сделка не найдена.</div>
  }

  const deal = dealQuery.data
  const stage = stagesQuery.data?.find((item) => item.id === deal.stage_id)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">{deal.title}</h1>
          <p className="page-subtitle">{stage?.name ?? 'Стадия не найдена'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setDealForm(getDealForm(deal))
              setDealOpen(true)
            }}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Редактировать
          </button>
          <button
            type="button"
            onClick={() => {
              setTaskForm(emptyTaskForm)
              setEditingTask(null)
              setTaskOpen(true)
            }}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Добавить задачу
          </button>
          <button
            type="button"
            onClick={() => {
              setActivityForm({
                type: 'note',
                description: '',
                client_id: deal.client_id,
                deal_id: dealId,
              })
              setActivityOpen(true)
            }}
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          >
            Добавить активность
          </button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-5">
        <article className="app-panel rounded-lg p-4">
          <p className="text-sm text-slate-500">Клиент</p>
          {clientQuery.data ? (
            <Link className="mt-2 block font-medium text-cyan-700" to={`/clients/${clientQuery.data.id}`}>
              {clientQuery.data.first_name} {clientQuery.data.last_name}
            </Link>
          ) : (
            <p className="mt-2 font-medium">-</p>
          )}
        </article>
        <article className="app-panel rounded-lg p-4">
          <p className="text-sm text-slate-500">Стадия</p>
          <p className="mt-2 font-medium">{stage?.name ?? '-'}</p>
        </article>
        <article className="app-panel rounded-lg p-4">
          <p className="text-sm text-slate-500">Сумма</p>
          <p className="mt-2 font-medium">{formatMoney(deal.amount)}</p>
        </article>
        <article className="app-panel rounded-lg p-4">
          <p className="text-sm text-slate-500">Владелец</p>
          <p className="mt-2 font-medium">
            {canReassign ? getUserLabel(usersQuery.data, deal.owner_id) : 'Вы'}
          </p>
        </article>
        <article className="app-panel rounded-lg p-4">
          <p className="text-sm text-slate-500">Закрыта</p>
          <p className="mt-2 font-medium">{formatDate(deal.closed_at)}</p>
        </article>
      </section>

      {deal.description && (
        <section className="app-panel rounded-lg p-4">
          <h2 className="font-semibold text-slate-950">Описание</h2>
          <p className="mt-2 text-slate-700">{deal.description}</p>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="app-panel rounded-lg p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-950">Задачи</h2>
            <span className="text-sm text-slate-500">{tasksQuery.data?.total ?? 0}</span>
          </div>
          <div className="mt-4 space-y-3">
            {tasksQuery.data?.items.map((task) => (
              <div key={task.id} className="rounded-md border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{task.title}</p>
                    <p className="page-subtitle">
                      Дедлайн: {formatDate(task.due_date)} · Исполнитель:{' '}
                      {canReassign ? getUserLabel(usersQuery.data, task.assignee_id) : 'Вы'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!task.is_completed && (
                      <button
                        type="button"
                        disabled={completeTaskMutation.isPending}
                        onClick={() => completeTaskMutation.mutate(task.id)}
                        className="rounded-lg border border-emerald-200 px-3 py-1.5 text-sm text-emerald-700 disabled:opacity-50"
                      >
                        Выполнено
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTask(taskMap.get(task.id) ?? task)
                        setTaskForm(getTaskForm(task))
                        setTaskOpen(true)
                      }}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      disabled={deleteTaskMutation.isPending}
                      onClick={() => setDeletingTask(task)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
                {task.description && <p className="mt-2 text-sm text-slate-600">{task.description}</p>}
              </div>
            ))}
            {!tasksQuery.data?.items.length && <p className="text-sm text-slate-500">Задач нет.</p>}
          </div>
        </div>

        <div className="app-panel rounded-lg p-4">
          <h2 className="font-semibold text-slate-950">Активности</h2>
          <div className="mt-4 space-y-3">
            {activitiesQuery.data?.items.map((activity) => (
              <div key={activity.id} className="rounded-md border border-slate-200 p-4">
                <p className="text-sm font-medium uppercase text-cyan-700">
                  {formatActivityType(activity.type)}
                </p>
                <p className="mt-1">{activity.description}</p>
                <p className="mt-2 text-xs text-slate-500">{formatDate(activity.created_at)}</p>
              </div>
            ))}
            {!activitiesQuery.data?.items.length && (
              <p className="text-sm text-slate-500">Активностей по сделке пока нет.</p>
            )}
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={deleteDealMutation.isPending}
          onClick={() => setDeleteDealOpen(true)}
          className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
        >
          Удалить сделку
        </button>
      </div>

      <Modal open={dealOpen} onClose={() => setDealOpen(false)} title="Редактировать сделку">
        <form onSubmit={onDealSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Название
            <input
              required
              value={dealForm?.title ?? ''}
              onChange={(event) =>
                setDealForm((current) => (current ? { ...current, title: event.target.value } : current))
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Клиент
            <select
              required
              value={dealForm?.client_id ?? ''}
              onChange={(event) =>
                setDealForm((current) => (current ? { ...current, client_id: event.target.value } : current))
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              {clientsQuery.data?.items.map((client) => (
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
              value={dealForm?.stage_id ?? ''}
              onChange={(event) =>
                setDealForm((current) => (current ? { ...current, stage_id: event.target.value } : current))
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              {stagesQuery.data?.map((stageItem) => (
                <option key={stageItem.id} value={stageItem.id}>
                  {stageItem.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Сумма
            <input
              type="number"
              min="0"
              value={dealForm?.amount ?? ''}
              onChange={(event) =>
                setDealForm((current) => (current ? { ...current, amount: event.target.value } : current))
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          {canReassign && (
            <label className="block text-sm font-medium text-slate-700">
              Переназначить
              <select
                value={dealForm?.owner_id ?? ''}
                onChange={(event) =>
                  setDealForm((current) => (current ? { ...current, owner_id: event.target.value } : current))
                }
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {usersQuery.data?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-sm font-medium text-slate-700">
            Описание
            <textarea
              value={dealForm?.description ?? ''}
              onChange={(event) =>
                setDealForm((current) => (current ? { ...current, description: event.target.value } : current))
              }
              className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={updateDealMutation.isPending}
            className="w-full rounded-md bg-slate-950 px-3 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            {updateDealMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </form>
      </Modal>

      <Modal
        open={taskOpen}
        onClose={() => {
          setTaskOpen(false)
          setEditingTask(null)
          setTaskForm(emptyTaskForm)
        }}
        title={editingTask ? 'Редактировать задачу' : 'Добавить задачу'}
      >
        <form onSubmit={onTaskSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Название
            <input
              required
              value={taskForm.title}
              onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          {canReassign && (
            <label className="block text-sm font-medium text-slate-700">
              Переназначить
              <select
                value={taskForm.assignee_id}
                onChange={(event) => setTaskForm({ ...taskForm, assignee_id: event.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">Текущий пользователь</option>
                {usersQuery.data?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-sm font-medium text-slate-700">
            Дедлайн
            <input
              type="datetime-local"
              value={taskForm.due_date}
              onChange={(event) => setTaskForm({ ...taskForm, due_date: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Описание
            <textarea
              value={taskForm.description}
              onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })}
              className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={saveTaskMutation.isPending}
            className="w-full rounded-md bg-slate-950 px-3 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            {saveTaskMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </form>
      </Modal>

      <Modal open={activityOpen} onClose={() => setActivityOpen(false)} title="Добавить активность">
        <form onSubmit={onActivitySubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Тип
            <select
              value={activityForm.type}
              onChange={(event) =>
                setActivityForm({ ...activityForm, type: event.target.value as Activity['type'] })
              }
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
              value={activityForm.description}
              onChange={(event) =>
                setActivityForm({ ...activityForm, description: event.target.value })
              }
              className="mt-1 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={createActivityMutation.isPending}
            className="w-full rounded-md bg-slate-950 px-3 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            {createActivityMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingTask)}
        title="Удалить задачу"
        message={deletingTask ? `Задача "${deletingTask.title}" будет удалена.` : ''}
        confirmLabel="Удалить"
        isPending={deleteTaskMutation.isPending}
        onCancel={() => setDeletingTask(null)}
        onConfirm={() => {
          if (deletingTask) {
            deleteTaskMutation.mutate(deletingTask.id)
          }
        }}
      />

      <ConfirmDialog
        open={deleteDealOpen}
        title="Удалить сделку"
        message={`Сделка "${deal.title}" будет удалена вместе с рабочим контекстом на этой странице.`}
        confirmLabel="Удалить"
        isPending={deleteDealMutation.isPending}
        onCancel={() => setDeleteDealOpen(false)}
        onConfirm={() => deleteDealMutation.mutate()}
      />
    </div>
  )
}
