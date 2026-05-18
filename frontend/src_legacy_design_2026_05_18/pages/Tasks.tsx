import { type FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Задачи</h1>
          <p className="mt-1 text-sm text-slate-500">Список задач с фильтрами и управлением.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Добавить задачу
        </button>
      </div>

      <section className={`grid gap-3 rounded-2xl bg-white p-4 shadow-sm ${canSeeAll ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        <label className="text-sm font-medium text-slate-700">
          Сделка
          <select
            value={dealId}
            onChange={(event) => {
              setDealId(event.target.value)
              setPage(1)
            }}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
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
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
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
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
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
            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Сбросить
          </button>
        </div>
      </section>

      <div className="rounded-2xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Задача</th>
                <th className="px-4 py-3">Сделка</th>
                <th className="px-4 py-3">Исполнитель</th>
                <th className="px-4 py-3">Дедлайн</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasksQuery.isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Загрузка задач...
                  </td>
                </tr>
              )}
              {tasksQuery.data?.items.map((task) => {
                const deal = dealsQuery.data?.items.find((item) => item.id === task.deal_id)
                return (
                  <tr key={task.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-950">{task.title}</p>
                      {task.description && <p className="text-slate-500">{task.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <Link to={`/deals/${task.deal_id}`} className="font-medium text-cyan-700">
                        {deal?.title ?? `Сделка #${task.deal_id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {canSeeAll ? getUserLabel(usersQuery.data, task.assignee_id) : 'Вы'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(task.due_date)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          'rounded-full px-3 py-1 text-xs font-medium',
                          task.is_completed
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700',
                        ].join(' ')}
                      >
                        {task.is_completed ? 'Выполнена' : 'Активна'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
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
                            'rounded-lg border px-3 py-1.5 disabled:opacity-50',
                            task.is_completed
                              ? 'border-amber-200 text-amber-700'
                              : 'border-emerald-200 text-emerald-700',
                          ].join(' ')}
                        >
                          {task.is_completed ? 'Вернуть в активные' : 'Отметить выполненной'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(task)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700"
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          disabled={deleteMutation.isPending}
                          onClick={() => setDeletingTask(task)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-red-700 disabled:opacity-50"
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!tasksQuery.isLoading && !tasksQuery.data?.items.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
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
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Сделка
            <select
              required
              value={form.deal_id}
              onChange={(event) => setForm({ ...form, deal_id: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
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
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
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
            disabled={saveMutation.isPending}
            className="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60"
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
