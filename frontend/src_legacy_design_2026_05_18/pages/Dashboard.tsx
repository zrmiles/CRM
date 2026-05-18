import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { activitiesApi } from '../api/activities'
import { clientsApi } from '../api/clients'
import { reportsApi } from '../api/reports'
import { formatActivityType, formatDate, formatMoney } from '../utils/format'

export function Dashboard() {
  const reportQuery = useQuery({
    queryKey: ['reports', 'funnel', 'dashboard'],
    queryFn: () => reportsApi.funnel(),
  })
  const activitiesQuery = useQuery({
    queryKey: ['activities', 'latest'],
    queryFn: () => activitiesApi.list({ page: 1, per_page: 5 }),
  })
  const clientsQuery = useQuery({
    queryKey: ['clients', 'dashboard'],
    queryFn: () => clientsApi.list({ page: 1, per_page: 100 }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Дашборд</h1>
        <p className="mt-1 text-sm text-slate-500">Воронка продаж и последние активности.</p>
      </div>

      {reportQuery.isLoading ? (
        <div className="rounded-2xl bg-white p-6 text-slate-500">Загрузка отчета...</div>
      ) : (
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
            <p className="mt-2 text-3xl font-bold">
              {Number(reportQuery.data?.conversion_rate ?? 0).toFixed(1)}%
            </p>
          </article>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Воронка по стадиям</h2>
          <div className="mt-4 space-y-3">
            {reportQuery.data?.stages.map((stage) => (
              <div key={stage.stage_name} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{stage.stage_name}</p>
                  <p className="text-sm text-slate-500">{stage.deal_count} сделок</p>
                </div>
                <p className="mt-2 text-sm text-slate-600">{formatMoney(stage.total_amount)}</p>
              </div>
            ))}
            {!reportQuery.data?.stages.length && (
              <p className="text-sm text-slate-500">Нет данных по стадиям.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Последние активности</h2>
          <div className="mt-4 space-y-3">
            {activitiesQuery.isLoading && <p className="text-sm text-slate-500">Загрузка...</p>}
            {activitiesQuery.data?.items.map((activity) => {
              const client = clientsQuery.data?.items.find((item) => item.id === activity.client_id)
              return (
                <div key={activity.id} className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-medium uppercase text-cyan-700">{formatActivityType(activity.type)}</p>
                  <p className="mt-1 text-slate-800">{activity.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {client ? (
                      <Link to={`/clients/${client.id}`} className="font-medium text-cyan-700">
                        {client.first_name} {client.last_name}
                      </Link>
                    ) : (
                      <span>Клиент #{activity.client_id}</span>
                    )}
                    {activity.deal_id && (
                      <>
                        <span>·</span>
                        <Link to={`/deals/${activity.deal_id}`} className="font-medium text-cyan-700">
                          Сделка #{activity.deal_id}
                        </Link>
                      </>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{formatDate(activity.created_at)}</p>
                </div>
              )
            })}
            {!activitiesQuery.isLoading && !activitiesQuery.data?.items.length && (
              <p className="text-sm text-slate-500">Активностей пока нет.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
