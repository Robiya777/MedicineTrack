import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { RefreshCw, SlidersHorizontal } from 'lucide-react'
import {
  doctorName,
  doctorsQuery,
  organizationsQuery,
  taskListQuery,
  type TaskFilters,
  type TaskSegment,
} from '@/api/tasks'
import { TaskTable } from './task-table'
import { CoordinatorMetrics } from './coordinator-metrics'
import { EmergencyBoard } from '@/features/messaging/assistant'
import {
  Field,
  Notice,
  PageHeader,
  Pagination,
  RequestError,
  inputStyle,
  secondaryButton,
} from '@/components/ui'

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

  const refreshAction = (
    <button
      type="button"
      className={secondaryButton}
      disabled={tasks.isFetching}
      onClick={() => void tasks.refetch()}
    >
      <RefreshCw
        size={16}
        className={tasks.isFetching ? 'animate-spin' : undefined}
        aria-hidden="true"
      />
      Yangilash
    </button>
  )

  return (
    <section aria-labelledby="workspace-title" className="space-y-6">
      <PageHeader
        title={coordinator ? 'Koordinator kabineti' : 'Mening chaqiruvlarim'}
        description={
          coordinator
            ? 'Hududdagi bemorlar kuzatuvi va patronaj nazorati.'
            : 'Biriktirilgan bemorlar bilan aloqa va patronaj hisoboti.'
        }
        action={refreshAction}
      />

      {coordinator && <CoordinatorMetrics />}
      <EmergencyBoard />

      <section
        aria-label="Chaqiruvlar"
        aria-busy={tasks.isFetching}
        className="rounded-2xl border border-line bg-surface shadow-xs overflow-hidden"
      >
        <div>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-base font-bold text-ink">Chaqiruvlar</h2>
            {tasks.data && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-muted">
                {tasks.data.count} ta
              </span>
            )}
          </div>
          <div
            className="flex flex-wrap gap-1.5 border-b border-line p-2.5 bg-slate-50/50"
            role="group"
            aria-label="Chaqiruv holati"
          >
            {segments.map((segment) => {
              const active = filters.segment === segment.value
              return (
                <button
                  key={segment.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => updateFilters({ segment: segment.value })}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                    active
                      ? 'bg-white text-primary font-semibold shadow-xs border border-line/60'
                      : 'text-muted hover:text-ink hover:bg-white/60'
                  }`}
                >
                  {segment.label}
                </button>
              )
            })}
          </div>

          {filters.segment === 'soon' && (
            <p className="px-5 pt-3 text-xs text-muted">
              Keyingi 4 soatda muddati tugaydigan ochiq chaqiruvlar.
            </p>
          )}

          {coordinator && (
            <div className="flex items-center justify-between p-4 border-b border-line md:hidden">
              <p className="text-xs text-muted">
                {Number(Boolean(filters.doctorId)) +
                  Number(Boolean(filters.organizationId))}{' '}
                ta faol filtr
              </p>
              <button
                type="button"
                className={secondaryButton}
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
              className={`p-5 grid-cols-1 md:grid-cols-3 gap-4 border-b border-line bg-slate-50/30 ${
                filtersOpen ? 'grid' : 'hidden md:grid'
              }`}
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
                <div className="flex items-end pb-1">
                  <button
                    type="button"
                    className="inline-flex items-center text-xs font-semibold text-primary hover:underline cursor-pointer"
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
                </div>
              )}
            </div>
          )}

          {!coordinator && filters.segment !== 'open' && (
            <div className="px-5 py-3 border-b border-line">
              <button
                type="button"
                className="inline-flex items-center text-xs font-semibold text-primary hover:underline cursor-pointer"
                onClick={() => updateFilters({ segment: 'open' })}
              >
                Filtrlarni tozalash
              </button>
            </div>
          )}

          {doctors.isError && coordinator && (
            <div className="p-5">
              <RequestError
                error={doctors.error}
                retry={() => void doctors.refetch()}
              />
            </div>
          )}
          {organizations.isError && coordinator && (
            <div className="p-5">
              <RequestError
                error={organizations.error}
                retry={() => void organizations.refetch()}
              />
            </div>
          )}
        </div>

        {tasks.isPending && (
          <div className="p-8">
            <Notice>Chaqiruvlar yuklanmoqda…</Notice>
          </div>
        )}
        {tasks.isError && (
          <div className="p-5">
            <RequestError
              error={tasks.error}
              retry={() => void tasks.refetch()}
            />
          </div>
        )}

        {tasks.data && tasks.data.results.length === 0 && (
          <div className="p-8">
            <Notice>
              {filters.segment === 'unassigned'
                ? 'Mas’ul biriktirilmagan chaqiruvlar yo‘q.'
                : filters.segment === 'overdue'
                  ? 'Kechikkan chaqiruvlar yo‘q.'
                  : filters.segment === 'soon'
                    ? 'Yaqin 4 soatda muddati tugaydigan chaqiruvlar yo‘q.'
                    : 'Chaqiruvlar topilmadi.'}
            </Notice>
          </div>
        )}

        {tasks.data && tasks.data.results.length > 0 && (
          <>
            <TaskTable
              tasks={tasks.data.results}
              coordinator={coordinator}
              names={names}
              facilities={facilities}
            />
            <Pagination
              page={page}
              onPageChange={setPage}
              hasPrevious={tasks.data.hasPrevious}
              hasNext={tasks.data.hasNext}
              totalCount={tasks.data.count}
              label="chaqiruv"
            />
          </>
        )}
      </section>
    </section>
  )
}
