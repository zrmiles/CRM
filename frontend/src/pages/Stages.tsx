import { type FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Database, Pencil, Plus, Trash2 } from 'lucide-react'
import { stagesApi } from '../api/stages'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import type { Stage, StagePayload } from '../types'
import { notifySuccess } from '../utils/notifications'

interface StageFormState {
  name: string
  position: string
  is_default: boolean
}

const emptyStageForm: StageFormState = {
  name: '',
  position: '',
  is_default: false,
}

export function Stages() {
  const queryClient = useQueryClient()
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingStage, setEditingStage] = useState<Stage | null>(null)
  const [deletingStage, setDeletingStage] = useState<Stage | null>(null)
  const [form, setForm] = useState<StageFormState>(emptyStageForm)

  const stagesQuery = useQuery({
    queryKey: ['stages'],
    queryFn: stagesApi.list,
  })

  const invalidateStages = () => queryClient.invalidateQueries({ queryKey: ['stages'] })

  const saveMutation = useMutation({
    mutationFn: (payload: StagePayload) =>
      editingStage ? stagesApi.update(editingStage.id, payload) : stagesApi.create(payload),
    onSuccess: async () => {
      await invalidateStages()
      setModalOpen(false)
      setEditingStage(null)
      setForm(emptyStageForm)
      notifySuccess(editingStage ? 'Стадия обновлена' : 'Стадия создана')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => stagesApi.remove(id),
    onSuccess: async () => {
      await invalidateStages()
      setDeletingStage(null)
      notifySuccess('Стадия удалена')
    },
  })

  const seedMutation = useMutation({
    mutationFn: stagesApi.seed,
    onSuccess: async () => {
      await invalidateStages()
      notifySuccess('Стандартные стадии созданы')
    },
  })

  const reorderMutation = useMutation({
    mutationFn: (ids: number[]) => stagesApi.reorder(ids),
    onSuccess: async () => {
      await invalidateStages()
      notifySuccess('Порядок стадий обновлен')
    },
  })

  const stages = stagesQuery.data ?? []

  const openCreate = () => {
    setEditingStage(null)
    setForm({
      ...emptyStageForm,
      position: String((stages.at(-1)?.position ?? stages.length) + 1),
    })
    setModalOpen(true)
  }

  const openEdit = (stage: Stage) => {
    setEditingStage(stage)
    setForm({
      name: stage.name,
      position: String(stage.position),
      is_default: stage.is_default,
    })
    setModalOpen(true)
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    saveMutation.mutate({
      name: form.name.trim(),
      position: Number(form.position),
      is_default: form.is_default,
    })
  }

  const reorderBefore = (targetId: number) => {
    if (!draggedId || draggedId === targetId) {
      return
    }

    const ids = stages.map((stage) => stage.id)
    const next = ids.filter((id) => id !== draggedId)
    const targetIndex = next.indexOf(targetId)
    next.splice(targetIndex, 0, draggedId)
    reorderMutation.mutate(next)
    setDraggedId(null)
  }

  const moveStage = (stageId: number, direction: -1 | 1) => {
    const ids = stages.map((stage) => stage.id)
    const currentIndex = ids.indexOf(stageId)
    const nextIndex = currentIndex + direction
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ids.length) {
      return
    }

    const next = [...ids]
    const [moved] = next.splice(currentIndex, 1)
    next.splice(nextIndex, 0, moved)
    reorderMutation.mutate(next)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Стадии</h1>
          <p className="page-subtitle">Управление стадиями доступно администраторам.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={seedMutation.isPending}
            onClick={() => seedMutation.mutate()}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Database className="h-4 w-4" aria-hidden="true" />
            Создать базовые стадии
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Добавить стадию
          </button>
        </div>
      </div>

      <section className="app-panel rounded-lg p-4">
        <p className="mb-4 text-sm text-slate-500">Перетаскивай карточки, чтобы менять порядок стадий.</p>
        <div className="space-y-3">
          {stagesQuery.isLoading && <p className="text-slate-500">Загрузка стадий...</p>}
          {stages.map((stage, index) => (
            <article
              key={stage.id}
              draggable
              onDragStart={() => setDraggedId(stage.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => reorderBefore(stage.id)}
              className="flex cursor-move flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50/40"
            >
              <div>
                <p className="font-medium text-slate-950">
                  {stage.position}. {stage.name}
                </p>
                <p className="text-sm text-slate-500">
                  ID {stage.id} {stage.is_default ? '· default' : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  disabled={index === 0 || reorderMutation.isPending}
                  onClick={() => moveStage(stage.id, -1)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  Вверх
                </button>
                <button
                  type="button"
                  disabled={index === stages.length - 1 || reorderMutation.isPending}
                  onClick={() => moveStage(stage.id, 1)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                  Вниз
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(stage)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Изменить
                </button>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => setDeletingStage(stage)}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Удалить
                </button>
              </div>
            </article>
          ))}
          {!stagesQuery.isLoading && stages.length === 0 && (
            <p className="text-sm text-slate-500">
              Стадий пока нет. Используйте seed или создайте вручную.
            </p>
          )}
        </div>
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingStage ? 'Редактировать стадию' : 'Добавить стадию'}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Название
            <input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Позиция
            <input
              type="number"
              min="1"
              required
              value={form.position}
              onChange={(event) => setForm({ ...form, position: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(event) => setForm({ ...form, is_default: event.target.checked })}
              className="h-4 w-4 rounded border-slate-300"
            />
            Default стадия
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
        open={Boolean(deletingStage)}
        title="Удалить стадию"
        message={
          deletingStage
            ? `Стадия "${deletingStage.name}" будет удалена. Если в ней есть сделки, сервер отклонит удаление.`
            : ''
        }
        confirmLabel="Удалить"
        isPending={deleteMutation.isPending}
        onCancel={() => setDeletingStage(null)}
        onConfirm={() => {
          if (deletingStage) {
            deleteMutation.mutate(deletingStage.id)
          }
        }}
      />
    </div>
  )
}
