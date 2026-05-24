import { type FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { dealsApi } from '../api/deals'
import { tasksApi } from '../api/tasks'
import { usersApi } from '../api/users'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { useAuthStore } from '../store/auth'
import type { Task, TaskPayload } from '../types'
import { formatDate, toDateTimeLocalValue, toOptionalNumber } from '../utils/format'
import { notifySuccess } from '../utils/notifications'
import { canUserReassign, canUserSeeAllData } from '../utils/permissions'
import { getUserLabel } from '../utils/users'

interface TaskFormState {
  title: string
  description: string
  due_date: string
  deal_id: string
  assignee_id: string
}

const emptyTaskForm: TaskFormState = {
  title: '',
  description: '',
  due_date: '',
  deal_id: '',
  assignee_id: '',
}

const toCompletedFilter = (value: string) => {
  if (value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  return undefined
}

export function Tasks() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.user)
  const canSeeAll = canUserSeeAllData(currentUser)
  const canReassign = canUserReassign(currentUser)
  const [page, setPage] = useState(1)
  const [dealId, setDealId] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [completed, setCompleted] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)
  const [form, setForm] = useState<TaskFormState>(emptyTaskForm)

  const dealsQuery = useQuery({
    queryKey: ['deals', 'task-filter'],
    queryFn: () => dealsApi.list({ per_page: 100 }),
  })
  const usersQuery = useQuery({
    queryKey: ['users', 'task-filter'],
    queryFn: usersApi.options,
    enabled: canSeeAll,
  })
  const tasksQuery = useQuery({
    queryKey: ['tasks', { page, dealId, assigneeId, completed }],
    queryFn: () =>
      tasksApi.list({
        page,
        per_page: 10,
        deal_id: dealId ? Number(dealId) : undefined,
        assignee_id: canSeeAll ? toOptionalNumber(assigneeId) : undefined,
        is_completed: toCompletedFilter(completed),
      }),
  })

  const saveMutation = useMutation({
    mutationFn: (payload: TaskPayload) =>
      editingTask ? tasksApi.update(editingTask.id, payload) : tasksApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setModalOpen(false)
      setEditingTask(null)
      setForm(emptyTaskForm)
      notifySuccess(editingTask ? 'Задача обновлена' : 'Задача создана')
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ taskId, isCompleted }: { taskId: number; isCompleted: boolean }) =>
      tasksApi.update(taskId, { is_completed: isCompleted }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      notifySuccess('Статус задачи обновлен')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (taskId: number) => tasksApi.remove(taskId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setDeletingTask(null)
      notifySuccess('Задача удалена')
    },
  })

  const openCreate = () => {
    setEditingTask(null)
    setForm({ ...emptyTaskForm, deal_id: dealId })
    setModalOpen(true)
  }

  const openEdit = (task: Task) => {
    setEditingTask(task)
    setForm({
      title: task.title,
      description: task.description ?? '',
      due_date: toDateTimeLocalValue(task.due_date),
      deal_id: String(task.deal_id),
      assignee_id: String(task.assignee_id),
    })
    setModalOpen(true)
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    saveMutation.mutate({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      due_date: form.due_date || undefined,
      deal_id: Number(form.deal_id),
      assignee_id: canReassign ? toOptionalNumber(form.assignee_id) : undefined,
    })
  }

  const renderStatusBadge = (task: Task) => (
    <span
      className={[
        'rounded-full px-3 py-1 text-xs font-medium',
        task.is_completed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
      ].join(' ')}
    >
      {task.is_completed ? 'Выполнена' : 'Активна'}
    </span>
  )

  const renderTaskActions = (task: Task, fullWidth = false) => (
    <div className={`flex flex-wrap gap-1 ${fullWidth ? '[&>button]:flex-1' : ''}`}>
      <button
        type="button"
        disabled={statusMutation.isPending}
        onClick={() =>
          statusMutation.mutate({
            taskId: task.id,
            isCompleted: !task.is_completed,
          })
        }
        className={[
          'inline-flex items-center justify-center gap-1 rounded-md border px-2.5 py-1.5 disabled:opacity-50',
          task.is_completed
            ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
        ].join(' ')}
      >
        {task.is_completed ? (
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {task.is_completed ? 'Вернуть в активные' : 'Отметить выполненной'}
      </button>
      <button
        type="button"
        onClick={() => openEdit(task)}
        className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-slate-700 hover:bg-slate-50"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        Изменить
      </button>
      <button
        type="button"
        disabled={deleteMutation.isPending}
        onClick={() => setDeletingTask(task)}
        className="inline-flex items-center justify-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        Удалить
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Задачи</h1>
          <p className="page-subtitle">Список задач с фильтрами и управлением.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Добавить задачу
        </button>
      </div>

      <section className={`app-panel grid gap-3 rounded-lg p-4 ${canSeeAll ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        <label className="text-sm font-medium text-slate-700">
          Сделка
          <select
            value={dealId}
            onChange={(event) => {
              setDealId(event.target.value)
              setPage(1)
            }}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">Все сделки</option>
            {dealsQuery.data?.items.map((deal) => (
              <option key={deal.id} value={deal.id}>
                {deal.title}
              </option>
            ))}
          </select>
        </label>

        {canSeeAll && (
          <label className="text-sm font-medium text-slate-700">
            Исполнитель
            <select
              value={assigneeId}
              onChange={(event) => {
                setAssigneeId(event.target.value)
                setPage(1)
              }}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">Все исполнители</option>
              {usersQuery.data?.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="text-sm font-medium text-slate-700">
          Статус
          <select
            value={completed}
            onChange={(event) => {
              setCompleted(event.target.value)
              setPage(1)
            }}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">Все</option>
            <option value="false">Активные</option>
            <option value="true">Выполненные</option>
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setDealId('')
              setAssigneeId('')
              setCompleted('')
              setPage(1)
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Сбросить
          </button>
        </div>
      </section>

      <div className="app-panel rounded-lg">
        <div className="divide-y divide-slate-100 md:hidden">
          {tasksQuery.isLoading && (
            <div className="px-3 py-6 text-center text-slate-500">Загрузка задач...</div>
          )}
          {tasksQuery.data?.items.map((task) => {
            const deal = dealsQuery.data?.items.find((item) => item.id === task.deal_id)
            return (
              <article key={task.id} className="space-y-3 px-3 py-4">
                <div className="space-y-1">
                  <p className="font-medium text-slate-950">{task.title}</p>
                  {task.description && <p className="text-sm text-slate-500">{task.description}</p>}
                </div>
                <dl className="grid gap-2 text-sm">
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">Сделка</dt>
                    <dd>
                      <Link to={`/deals/${task.deal_id}`} className="font-medium text-cyan-700">
                        {deal?.title ?? `Сделка #${task.deal_id}`}
                      </Link>
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-xs font-semibold uppercase text-slate-500">Исполнитель</dt>
                      <dd className="text-slate-700">
                        {canSeeAll ? getUserLabel(usersQuery.data, task.assignee_id) : 'Вы'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase text-slate-500">Статус</dt>
                      <dd>{renderStatusBadge(task)}</dd>
                    </div>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">Дедлайн</dt>
                    <dd className="text-slate-700">{formatDate(task.due_date)}</dd>
                  </div>
                </dl>
                {renderTaskActions(task, true)}
              </article>
            )
          })}
          {!tasksQuery.isLoading && !tasksQuery.data?.items.length && (
            <div className="px-3 py-6 text-center text-slate-500">Задачи не найдены.</div>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="table-compact">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Задача</th>
                <th className="px-3 py-2.5">Сделка</th>
                <th className="px-3 py-2.5">Исполнитель</th>
                <th className="px-3 py-2.5">Дедлайн</th>
                <th className="px-3 py-2.5">Статус</th>
                <th className="px-3 py-2.5">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasksQuery.isLoading && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    Загрузка задач...
                  </td>
                </tr>
              )}
              {tasksQuery.data?.items.map((task) => {
                const deal = dealsQuery.data?.items.find((item) => item.id === task.deal_id)
                return (
                  <tr key={task.id}>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-slate-950">{task.title}</p>
                      {task.description && <p className="text-slate-500">{task.description}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      <Link to={`/deals/${task.deal_id}`} className="font-medium text-cyan-700">
                        {deal?.title ?? `Сделка #${task.deal_id}`}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {canSeeAll ? getUserLabel(usersQuery.data, task.assignee_id) : 'Вы'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{formatDate(task.due_date)}</td>
                    <td className="px-3 py-2.5">{renderStatusBadge(task)}</td>
                    <td className="px-3 py-2.5">{renderTaskActions(task)}</td>
                  </tr>
                )
              })}
              {!tasksQuery.isLoading && !tasksQuery.data?.items.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    Задачи не найдены.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          perPage={tasksQuery.data?.per_page ?? 10}
          total={tasksQuery.data?.total ?? 0}
          onPageChange={setPage}
        />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingTask(null)
          setForm(emptyTaskForm)
        }}
        title={editingTask ? 'Редактировать задачу' : 'Добавить задачу'}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Название
            <input
              required
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Сделка
            <select
              required
              value={form.deal_id}
              onChange={(event) => setForm({ ...form, deal_id: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">Выберите сделку</option>
              {dealsQuery.data?.items.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.title}
                </option>
              ))}
            </select>
          </label>
          {canReassign && (
            <label className="block text-sm font-medium text-slate-700">
              Переназначить
              <select
                value={form.assignee_id}
                onChange={(event) => setForm({ ...form, assignee_id: event.target.value })}
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
              value={form.due_date}
              onChange={(event) => setForm({ ...form, due_date: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Описание
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="w-full rounded-md bg-slate-950 px-3 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            {saveMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingTask)}
        title="Удалить задачу"
        message={deletingTask ? `Задача "${deletingTask.title}" будет удалена.` : ''}
        confirmLabel="Удалить"
        isPending={deleteMutation.isPending}
        onCancel={() => setDeletingTask(null)}
        onConfirm={() => {
          if (deletingTask) {
            deleteMutation.mutate(deletingTask.id)
          }
        }}
      />
    </div>
  )
}
