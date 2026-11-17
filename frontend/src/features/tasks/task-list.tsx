import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { doctorName, doctorsQuery, metricsQuery, organizationsQuery, taskListQuery, type TaskFilters, type TaskSegment } from '../../api/tasks'
import { formatTashkentDateTime, taskStatusLabels } from '../hospital/format'
import { Field, inputStyle, Notice, RequestError, secondaryButton } from '../hospital/ui'

const coordinatorSegments: { value: TaskSegment; label: string }[] = [
  { value: 'all', label: 'Barchasi' },
  { value: 'unassigned', label: 'Mas’ulsiz' },
  { value: 'soon', label: 'Muddati yaqin' },
  { value: 'overdue', label: 'Kechikkan' },
  { value: 'COMPLETED', label: 'Bajarilgan' },
  { value: 'CANCELLED', label: 'Bekor qilingan' },
]
const doctorSegments: { value: TaskSegment; label: string }[] = [
  { value: 'open', label: 'Ochiq' },
  { value: 'overdue', label: 'Kechikkan' },
  { value: 'COMPLETED', label: 'Bajarilgan' },
  { value: 'CANCELLED', label: 'Bekor qilingan' },
]

export function TaskDashboard({ coordinator }: { coordinator: boolean }) {
  const role = coordinator ? 'koordinator' : 'shifokor'
  const [filters, setFilters] = useState<TaskFilters>({ segment: coordinator ? 'all' : 'open', doctorId: '', organizationId: '' })
  const [page, setPage] = useState(1)
  const tasks = useQuery(taskListQuery(filters, page))
  const doctors = useQuery({ ...doctorsQuery(), enabled: coordinator })
  const organizations = useQuery({ ...organizationsQuery(), enabled: coordinator })
  const names = new Map(doctors.data?.map((doctor) => [doctor.id, doctorName(doctor)]))
  const segments = coordinator ? coordinatorSegments : doctorSegments

  function updateFilters(next: Partial<TaskFilters>) {
    setPage(1)
    setFilters({ ...filters, ...next })
  }

  return (
    <section aria-labelledby="workspace-title" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="workspace-title" className="text-3xl font-semibold tracking-tight">
          {coordinator ? 'Koordinator kabineti' : 'Mening chaqiruvlarim'}
        </h1>
        <button type="button" className={secondaryButton} disabled={tasks.isFetching} onClick={() => void tasks.refetch()}>
          <RefreshCw size={16} aria-hidden="true" />Yangilash
        </button>
      </div>
      {coordinator && <CoordinatorMetrics />}
      <section aria-label="Chaqiruvlar" className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="space-y-4 border-b border-line p-4 sm:p-5">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Chaqiruv holati">
            {segments.map((segment) => (
              <button
                key={segment.value}
                type="button"
                aria-pressed={filters.segment === segment.value}
                onClick={() => updateFilters({ segment: segment.value })}
                className={secondaryButton + (filters.segment === segment.value ? ' border-[#0b6155] bg-[#e4f0eb]' : '')}
              >
                {segment.label}
              </button>
            ))}
          </div>
          {filters.segment === 'soon' && <p className="text-sm text-muted">Keyingi 4 soatda muddati tugaydigan ochiq chaqiruvlar.</p>}
          {coordinator && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Shifokor">
                {(a11y) => (
                  <select {...a11y} className={inputStyle} value={filters.doctorId} onChange={(event) => updateFilters({ doctorId: event.currentTarget.value })}>
                    <option value="">Barcha shifokorlar</option>
                    {doctors.data?.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctorName(doctor)}</option>)}
                  </select>
                )}
              </Field>
              <Field label="Qabul qiluvchi muassasa">
                {(a11y) => (
                  <select {...a11y} className={inputStyle} value={filters.organizationId} onChange={(event) => updateFilters({ organizationId: event.currentTarget.value })}>
                    <option value="">Barcha muassasalar</option>
                    {organizations.data?.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                  </select>
                )}
              </Field>
            </div>
          )}
          {doctors.isError && coordinator && <RequestError error={doctors.error} retry={() => void doctors.refetch()} />}
          {organizations.isError && coordinator && <RequestError error={organizations.error} retry={() => void organizations.refetch()} />}
        </div>
        {tasks.isPending && <div className="p-4"><Notice>Chaqiruvlar yuklanmoqda…</Notice></div>}
        {tasks.isError && <div className="p-4"><RequestError error={tasks.error} retry={() => void tasks.refetch()} /></div>}
        {tasks.data && tasks.data.results.length === 0 && <div className="p-4"><Notice>Tanlangan filtrlarda chaqiruv yo‘q.</Notice></div>}
        {tasks.data && (
          <>
            <ul className="divide-y divide-line">
              {tasks.data.results.map((task) => (
                <li key={task.id}>
                  <Link
                    to="/kabinet/$role/chaqiruv/$taskId"
                    params={{ role, taskId: task.id }}
                    className="grid min-w-0 gap-x-5 gap-y-2 p-4 hover:bg-surface sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] sm:p-5"
                  >
                    <div className="min-w-0">
                      <span className="wrap-break-word font-semibold">{task.patient.full_name || 'Bemor'}</span>
                      <p className="mt-1 break-all font-mono text-xs text-muted">{task.id}</p>
                    </div>
                    <div className="min-w-0 sm:text-right">
                      <span className={'text-sm font-semibold ' + (task.overdue ? 'text-red-800' : 'text-action')}>
                        {taskStatusLabels[task.status]}{task.overdue ? ' · Muddati o‘tgan' : ''}
                      </span>
                      <p className="mt-1 text-sm text-muted">{formatTashkentDateTime(task.due_at)} (Toshkent)</p>
                      {coordinator && task.assigned_doctor && <p className="mt-1 wrap-break-word text-sm text-muted">{names.get(task.assigned_doctor) ?? task.assigned_doctor}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <nav aria-label="Chaqiruv sahifalari" className="flex flex-wrap items-center gap-3 border-t border-line p-4">
              <span className="mr-auto text-sm text-muted">{tasks.data.count} ta chaqiruv</span>
              <button type="button" className={secondaryButton} disabled={!tasks.data.hasPrevious} onClick={() => setPage(page - 1)}>Oldingi</button>
              <span className="text-sm text-muted">{page}</span>
              <button type="button" className={secondaryButton} disabled={!tasks.data.hasNext} onClick={() => setPage(page + 1)}>Keyingi</button>
            </nav>
          </>
        )}
      </section>
    </section>
  )
}

function CoordinatorMetrics() {
  const metrics = useQuery(metricsQuery())
  if (metrics.isPending) return <Notice>Hudud ko‘rsatkichlari yuklanmoqda…</Notice>
  if (metrics.isError) return <RequestError error={metrics.error} retry={() => void metrics.refetch()} />

  const data = metrics.data
  return (
    <section aria-labelledby="metrics-title" className="space-y-3">
      <h2 id="metrics-title" className="text-sm font-semibold text-muted">Hudud bo‘yicha ko‘rsatkichlar</h2>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Aktiv', value: data.active },
          { label: 'Kechikkan', value: data.overdue },
          { label: 'Mas’ulsiz', value: data.unassigned },
          { label: 'O‘z vaqtida bajarish', value: data.sla_percent === null ? 'Ma’lumot yo‘q' : data.sla_percent + '%' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-line bg-white p-4">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-2 wrap-break-word text-xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted">
        O‘z vaqtida bajarilgan {data.completed_on_time} / baholanadigan {data.assessed}.
        {' '}Bekor qilingan {data.cancelled}. Kech hujjatlashtirilgan {data.late_documented}.
      </p>
    </section>
  )
}
