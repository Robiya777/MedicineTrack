import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import {
  dischargePageQuery,
  hospitalPatientQuery,
} from '@/api/hospital'
import {
  Notice,
  PageHeader,
  Pagination,
  RequestError,
  primaryButton,
} from '@/components/ui'
import { DischargeTable } from './hospital/discharge-table'
import { DischargeCardList } from './hospital/discharge-card-list'

export function HospitalDashboard() {
  const [page, setPage] = useState(1)
  const discharges = useQuery(dischargePageQuery(page))
  const rows = discharges.data?.results ?? []

  const missingPatientIds = [
    ...new Set(
      rows
        .filter((row) => !row.patient_snapshot.full_name)
        .map((row) => row.patient),
    ),
  ]
  const patients = useQueries({
    queries: missingPatientIds.map((id) => hospitalPatientQuery(id)),
  })
  const names = new Map(
    patients.flatMap((patient) =>
      patient.data ? [[patient.data.id, patient.data.full_name] as const] : [],
    ),
  )

  const newDischargeButton = (
    <Link
      to="/kabinet/$role/chiqarish/yangi"
      params={{ role: 'statsionar' }}
      className={primaryButton}
    >
      <Plus size={18} aria-hidden="true" />
      Yangi chiqarish
    </Link>
  )

  return (
    <section aria-labelledby="workspace-title" className="space-y-6">
      <PageHeader
        title="Statsionar kabineti"
        description="Chiqarish yozuvlari va bemorni kuzatuvga topshirish."
        action={newDischargeButton}
      />

      <section
        aria-labelledby="discharges-title"
        className="rounded-2xl border border-line bg-surface shadow-xs overflow-hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
          <h2 id="discharges-title" className="text-base font-bold text-ink">
            Chiqarishlar
          </h2>
          {discharges.data && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-muted">
              {discharges.data.count} ta yozuv
            </span>
          )}
        </div>

        {discharges.isPending && (
          <div className="p-8">
            <Notice>Chiqarishlar yuklanmoqda…</Notice>
          </div>
        )}
        {discharges.isError && (
          <div className="p-5">
            <RequestError
              error={discharges.error}
              retry={() => void discharges.refetch()}
            />
          </div>
        )}
        {discharges.data && rows.length === 0 && (
          <div className="p-8">
            <Notice>Chiqarish yozuvlari hali yo‘q.</Notice>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <DischargeTable rows={rows} names={names} />
            <DischargeCardList rows={rows} names={names} />
          </>
        )}

        {discharges.data &&
          (discharges.data.previous || discharges.data.next) && (
            <Pagination
              page={page}
              onPageChange={setPage}
              hasPrevious={Boolean(discharges.data.previous)}
              hasNext={Boolean(discharges.data.next)}
              totalCount={discharges.data.count}
              label="yozuv"
            />
          )}
      </section>
    </section>
  )
}
