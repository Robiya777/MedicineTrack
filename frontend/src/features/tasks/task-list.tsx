import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  Activity,
  Clock3,
  RefreshCw,
  SlidersHorizontal,
  ShieldCheck,
  UserRoundX,
} from 'lucide-react'
import {
  doctorName,
  doctorsQuery,
  metricsQuery,
  organizationsQuery,
  taskListQuery,
  type TaskFilters,
  type TaskSegment,
} from '../../api/tasks'
import { TaskTable } from './task-table'
import {
  Field,
  inputStyle,
  Notice,
  RequestError,
  secondaryButton,
} from '../hospital/ui'

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

const workspaceRoute = getRouteApi('/(app)/kabinet/$role')

export function TaskDashboard({ coordinator }: { coordinator: boolean }) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersId = useId()
  const search = workspaceRoute.useSearch()
  const navigate = workspaceRoute.useNavigate()
  const segments = coordinator ? coordinatorSegments : doctorSegments
  const filters: TaskFilters = {
    segment: segments.some((item) => item.value === search.segment)
      ? search.segment!
      : coordinator
        ? 'all'
        : 'open',
    doctorId: coordinator ? search.doctorId || '' : '',
    organizationId: coordinator ? search.organizationId || '' : '',
  }
  const page = search.page || 1
  const setPage = (page: number) =>
    void navigate({ search: (prev) => ({ ...prev, page }) })
  const tasks = useQuery(taskListQuery(filters, page))
  const doctors = useQuery({ ...doctorsQuery(), enabled: coordinator })
  const organizations = useQuery({
    ...organizationsQuery(),
    enabled: coordinator,
  })
  const names = new Map(
    doctors.data?.map((doctor) => [doctor.id, doctorName(doctor)]),
  )
  const facilities = new Map(
    organizations.data?.map((org) => [org.id, org.name]),
  )

  function updateFilters(next: Partial<TaskFilters>) {
    const updated = { ...filters, ...next }
    void navigate({
      search: {
        segment: updated.segment,
        doctorId: updated.doctorId || undefined,
        organizationId: updated.organizationId || undefined,
        page: 1,
      },
    })
  }

  return (
    <section aria-labelledby="workspace-title" className="space-y-6">
      <div className="mt-page-heading">
        <div>
          <h1
            id="workspace-title"
            className="text-3xl font-semibold tracking-tight"
          >
            {coordinator ? 'Koordinator kabineti' : 'Mening chaqiruvlarim'}
          </h1>
          <p>
            {coordinator
              ? 'Hududdagi bemorlar kuzatuvi va patronaj nazorati.'
              : 'Biriktirilgan bemorlar bilan aloqa va patronaj hisoboti.'}
          </p>
        </div>
        <button
          type="button"
          className={secondaryButton}
          disabled={tasks.isFetching}
          onClick={() => void tasks.refetch()}
        >
          <RefreshCw size={16} className={tasks.isFetching ? 'mt-spin' : undefined} aria-hidden="true" />
          Yangilash
        </button>
      </div>
      {coordinator && <CoordinatorMetrics />}
      <section aria-label="Chaqiruvlar" aria-busy={tasks.isFetching} className="mt-card mt-queue">
        <div>
          <div className="mt-queue-summary">
            <h2 className="text-lg font-semibold">Chaqiruvlar</h2>
            {tasks.data && (
              <span className="mt-total-count">{tasks.data.count}</span>
            )}
          </div>
          <div
            className="mt-segments"
            role="group"
            aria-label="Chaqiruv holati"
          >
            {segments.map((segment) => (
              <button
                key={segment.value}
                type="button"
                aria-pressed={filters.segment === segment.value}
                onClick={() => updateFilters({ segment: segment.value })}
                className="mt-segment"
              >
                {segment.label}
              </button>
            ))}
          </div>
          {filters.segment === 'soon' && (
            <p className="px-5 pt-3 text-sm text-muted">
              Keyingi 4 soatda muddati tugaydigan ochiq chaqiruvlar.
            </p>
          )}
          {coordinator && (
            <div className="mt-filter-mobile-heading">
              <p>
                {Number(Boolean(filters.doctorId)) +
                  Number(Boolean(filters.organizationId))}{' '}
                ta faol filtr
              </p>
              <button
                type="button"
                className="mt-button"
                aria-expanded={filtersOpen}
                aria-controls={filtersId}
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <SlidersHorizontal size={16} aria-hidden="true" />
                Filtrlar
              </button>
            </div>
          )}
          {coordinator && (
            <div
              id={filtersId}
              className={
                'mt-filter-fields' +
                (filtersOpen ? ' mt-filter-fields-open' : '')
              }
            >
              <Field label="Shifokor">
                {(a11y) => (
                  <select
                    {...a11y}
                    className={inputStyle}
                    value={filters.doctorId}
                    onChange={(event) =>
                      updateFilters({ doctorId: event.currentTarget.value })
                    }
                  >
                    <option value="">Barcha shifokorlar</option>
                    {doctors.data?.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctorName(doctor)}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Qabul qiluvchi muassasa">
                {(a11y) => (
                  <select
                    {...a11y}
                    className={inputStyle}
                    value={filters.organizationId}
                    onChange={(event) =>
                      updateFilters({
                        organizationId: event.currentTarget.value,
                      })
                    }
                  >
                    <option value="">Barcha muassasalar</option>
                    {organizations.data?.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              {(filters.doctorId ||
                filters.organizationId ||
                filters.segment !== (coordinator ? 'all' : 'open')) && (
                <button
                  type="button"
                  className="mt-clear-filters"
                  onClick={() =>
                    updateFilters({
                      segment: coordinator ? 'all' : 'open',
                      doctorId: '',
                      organizationId: '',
                    })
                  }
                >
                  Filtrlarni tozalash
                </button>
              )}
            </div>
          )}
          {!coordinator && filters.segment !== 'open' && (
            <div className="px-5 pb-4">
              <button
                type="button"
                className="mt-clear-filters"
                onClick={() => updateFilters({ segment: 'open' })}
              >
                Filtrlarni tozalash
              </button>
            </div>
          )}
          {doctors.isError && coordinator && (
            <RequestError
              error={doctors.error}
              retry={() => void doctors.refetch()}
            />
          )}
          {organizations.isError && coordinator && (
            <RequestError
              error={organizations.error}
              retry={() => void organizations.refetch()}
            />
          )}
        </div>
        {tasks.isPending && (
          <div className="p-4">
            <Notice>Chaqiruvlar yuklanmoqda…</Notice>
          </div>
        )}
        {tasks.isError && (
          <div className="p-4">
            <RequestError
              error={tasks.error}
              retry={() => void tasks.refetch()}
            />
          </div>
        )}
        {tasks.data && tasks.data.results.length === 0 && (
          <div className="p-4">
            <Notice>Tanlangan filtrlarda chaqiruv yo‘q.</Notice>
            <button
              type="button"
              className="mt-button mt-3"
              onClick={() =>
                updateFilters({
                  segment: coordinator ? 'all' : 'open',
                  doctorId: '',
                  organizationId: '',
                })
              }
            >
              Barcha chaqiruvlarni ko‘rish
            </button>
          </div>
        )}
        {tasks.data && (
          <>
            {tasks.data.results.length > 0 && (
              <TaskTable
                tasks={tasks.data.results}
                coordinator={coordinator}
                names={names}
                facilities={facilities}
              />
            )}
            <nav
              aria-label="Chaqiruv sahifalari"
              className="mt-list-pagination"
            >
              <span className="mr-auto text-sm text-muted">
                {tasks.data.count} ta chaqiruv
              </span>
              <button
                type="button"
                className={secondaryButton}
                disabled={!tasks.data.hasPrevious}
                onClick={() => setPage(page - 1)}
              >
                Oldingi
              </button>
              <span className="text-sm text-muted">{page}</span>
              <button
                type="button"
                className={secondaryButton}
                disabled={!tasks.data.hasNext}
                onClick={() => setPage(page + 1)}
              >
                Keyingi
              </button>
            </nav>
          </>
        )}
      </section>
    </section>
  )
}

function CoordinatorMetrics() {
  const metrics = useQuery(metricsQuery())
  if (metrics.isPending)
    return <Notice>Hudud ko‘rsatkichlari yuklanmoqda…</Notice>
  if (metrics.isError)
    return (
      <RequestError
        error={metrics.error}
        retry={() => void metrics.refetch()}
      />
    )

  const data = metrics.data
  return (
    <section aria-labelledby="metrics-title" className="space-y-3">
      <h2 id="metrics-title" className="text-sm font-semibold text-muted">
        Hudud bo‘yicha ko‘rsatkichlar
      </h2>
      <dl className="mt-metrics">
        {[
          {
            label: 'Aktiv',
            value: data.active,
            Icon: Activity,
            tone: 'primary',
          },
          {
            label: 'Kechikkan',
            value: data.overdue,
            Icon: Clock3,
            tone: 'danger',
          },
          {
            label: 'Mas’ulsiz',
            value: data.unassigned,
            Icon: UserRoundX,
            tone: 'warning',
          },
          {
            label: 'O‘z vaqtida bajarish',
            value:
              data.sla_percent === null
                ? 'Ma’lumot yo‘q'
                : data.sla_percent + '%',
            Icon: ShieldCheck,
            tone: 'primary',
          },
        ].map(({ label, value, Icon, tone }) => (
          <div key={label} className="mt-card mt-metric">
            <dt className="mt-metric-top">
              <span>{label}</span>
              <span className={'mt-metric-icon mt-metric-icon-' + tone}>
                <Icon size={19} aria-hidden="true" />
              </span>
            </dt>
            <dd className="mt-metric-value mt-numeric">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted">
        O‘z vaqtida bajarilgan {data.completed_on_time} / baholanadigan{' '}
        {data.assessed}. Bekor qilingan {data.cancelled}. Kech
        hujjatlashtirilgan {data.late_documented}.
      </p>
    </section>
  )
}
