import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Deal, Stage } from '../types'
import { formatMoney } from '../utils/format'

interface KanbanBoardProps {
  stages: Stage[]
  deals: Deal[]
  onMoveDeal: (dealId: number, stageId: number) => void
  isUpdating?: boolean
}

export function KanbanBoard({ stages, deals, onMoveDeal, isUpdating }: KanbanBoardProps) {
  const [draggingDealId, setDraggingDealId] = useState<number | null>(null)
  const [dropStageId, setDropStageId] = useState<number | null>(null)

  return (
    <div className="grid gap-4 overflow-x-auto lg:grid-cols-4 xl:grid-cols-5">
      {stages.map((stage) => {
        const stageDeals = deals.filter((deal) => deal.stage_id === stage.id)
        const total = stageDeals.reduce((sum, deal) => sum + Number(deal.amount ?? 0), 0)

        return (
          <section
            key={stage.id}
            onDragOver={(event) => {
              event.preventDefault()
              setDropStageId(stage.id)
            }}
            onDragLeave={() => setDropStageId((current) => (current === stage.id ? null : current))}
            onDrop={(event) => {
              const dealId = Number(event.dataTransfer.getData('dealId'))
              if (dealId) {
                onMoveDeal(dealId, stage.id)
              }
              setDraggingDealId(null)
              setDropStageId(null)
            }}
            className={[
              'min-h-80 min-w-72 rounded-2xl border bg-white p-4 transition',
              dropStageId === stage.id
                ? 'border-cyan-400 bg-cyan-50/60'
                : 'border-slate-200',
            ].join(' ')}
          >
            <div className="mb-4">
              <h2 className="font-semibold text-slate-950">{stage.name}</h2>
              <p className="text-sm text-slate-500">
                {stageDeals.length} сделок, {formatMoney(total)}
              </p>
            </div>

            <div className="space-y-3">
              {stageDeals.map((deal) => (
                <Link
                  key={deal.id}
                  to={`/deals/${deal.id}`}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('dealId', String(deal.id))
                    setDraggingDealId(deal.id)
                  }}
                  onDragEnd={() => {
                    setDraggingDealId(null)
                    setDropStageId(null)
                  }}
                  className={[
                    'block rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50',
                    draggingDealId === deal.id ? 'opacity-50 ring-2 ring-cyan-300' : '',
                  ].join(' ')}
                >
                  <p className="font-medium text-slate-950">{deal.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{formatMoney(deal.amount)}</p>
                </Link>
              ))}
              {stageDeals.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-400">
                  Перетащите сделку сюда
                </p>
              )}
            </div>

            {isUpdating && <p className="mt-3 text-xs text-cyan-700">Обновление...</p>}
          </section>
        )
      })}
    </div>
  )
}
