import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '../api/reports'
import { usersApi } from '../api/users'
import { useAuthStore } from '../store/auth'
import { formatMoney } from '../utils/format'
import { canUserSeeAllData } from '../utils/permissions'

const toDateTime = (date: string, endOfDay = false) => {
  if (!date) {
    return undefined
  }

  return `${date}T${endOfDay ? '23:59:59' : '00:00:00'}`
}

export function Reports() {
  const user = useAuthStore((state) => state.user)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const canSeeAll = canUserSeeAllData(user)
  const dateRangeInvalid = dateFrom !== '' && dateTo !== '' && dateFrom > dateTo

  const usersQuery = useQuery({
    queryKey: ['users', 'report-filter'],
    queryFn: usersApi.options,
    enabled: canSeeAll,
  })
  const reportQuery = useQuery({
    queryKey: ['reports', 'funnel', { dateFrom, dateTo, ownerId }],
    queryFn: () =>
      reportsApi.funnel({
        date_from: toDateTime(dateFrom),
        date_to: toDateTime(dateTo, true),
        owner_id: ownerId ? Number(ownerId) : undefined,
      }),
    enabled: !dateRangeInvalid,
  })

  const maxDeals = Math.max(1, ...(reportQuery.data?.stages.map((stage) => stage.deal_count) ?? [1]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Отчеты</h1>
        <p className="mt-1 text-sm text-slate-500">Воронка продаж по стадиям и конверсии.</p>
      </div>

      <section className={`grid gap-3 rounded-2xl bg-white p-4 shadow-sm ${canSeeAll ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        <label className="text-sm font-medium text-slate-700">
          Дата от
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Дата до
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
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
              {usersQuery.data?.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.full_name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setDateFrom('')
              setDateTo('')
              setOwnerId('')
            }}
            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Сбросить
          </button>
        </div>
      </section>
      {dateRangeInvalid && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Дата от не может быть позже даты до.
        </p>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Всего сделок</p>
          <p className="mt-2 text-3xl font-bold">{reportQuery.data?.total_deals ?? 0}</p>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Сумма</p>
          <p className="mt-2 text-3xl font-bold">{formatMoney(reportQuery.data?.total_amount)}</p>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Конверсия</p>
          <span className="mt-3 inline-flex rounded-full bg-cyan-50 px-4 py-2 text-lg font-bold text-cyan-700">
            {Number(reportQuery.data?.conversion_rate ?? 0).toFixed(1)}%
          </span>
        </article>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">Диаграмма по стадиям</h2>
        <div className="mt-5 space-y-4">
          {reportQuery.isLoading && <p className="text-slate-500">Загрузка отчета...</p>}
          {reportQuery.data?.stages.map((stage) => (
            <div key={stage.stage_name}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700">{stage.stage_name}</span>
                <span className="text-slate-500">
                  {stage.deal_count} / {formatMoney(stage.total_amount)}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-cyan-500"
                  style={{ width: `${Math.max(4, (stage.deal_count / maxDeals) * 100)}%` }}
                />
              </div>
            </div>
          ))}
          {!reportQuery.isLoading && !reportQuery.data?.stages.length && (
            <p className="text-sm text-slate-500">Нет данных для отчета.</p>
          )}
        </div>
      </section>
    </div>
  )
}
