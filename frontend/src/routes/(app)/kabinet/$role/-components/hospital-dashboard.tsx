import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { dischargePageQuery, hospitalPatientQuery } from '../../../../../api/hospital'
import { dischargeStatusLabels, formatTashkentDateTime } from '../../../../../features/hospital/format'
import { Notice, RequestError, secondaryButton } from '../../../../../features/hospital/ui'

export function HospitalDashboard() {
  const [page, setPage] = useState(1)
  const discharges = useQuery(dischargePageQuery(page))
  const rows = discharges.data?.results ?? []
  const missingPatientIds = [...new Set(rows.filter((row) => !row.patient_snapshot.full_name).map((row) => row.patient))]
  const patients = useQueries({
    queries: missingPatientIds.map((id) => hospitalPatientQuery(id)),
  })
  const names = new Map(patients.flatMap((patient) => patient.data
    ? [[patient.data.id, patient.data.full_name] as const]
    : []))

  return (
    <section aria-labelledby="workspace-title" className="space-y-6">
      <div>
        <h1 id="workspace-title" className="text-3xl font-semibold tracking-tight">Statsionar kabineti</h1>
      </div>
      <section aria-labelledby="discharges-title" className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-4 sm:px-6">
          <h2 id="discharges-title" className="text-xl font-semibold">Chiqarishlar</h2>
          {discharges.data && <span className="text-sm text-muted">{discharges.data.count} ta yozuv</span>}
        </div>
        {discharges.isPending && <div className="p-4"><Notice>Chiqarishlar yuklanmoqda…</Notice></div>}
        {discharges.isError && (
          <div className="p-4">
            <RequestError error={discharges.error} retry={() => void discharges.refetch()} />
          </div>
        )}
        {discharges.data && rows.length === 0 && (
          <div className="p-4"><Notice>Chiqarish yozuvlari hali yo‘q.</Notice></div>
        )}
        {rows.length > 0 && (
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  to="/kabinet/$role/chiqarish/$dischargeId"
                  params={{ role: 'statsionar', dischargeId: row.id }}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-4 hover:bg-surface focus-visible:-outline-offset-2 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_8rem_auto] sm:px-6"
                >
                  <span className="wrap-break-word font-semibold">
                    {row.patient_snapshot.full_name ?? names.get(row.patient) ?? row.patient}
                  </span>
                  <span className="col-start-1 text-sm text-muted sm:col-start-auto">
                    {formatTashkentDateTime(row.discharged_at)}
                  </span>
                  <span className="col-start-1 w-fit rounded-full bg-[#e4f0eb] px-2.5 py-1 text-xs font-semibold text-[#205747] sm:col-start-auto">
                    {dischargeStatusLabels[row.status]}
                  </span>
                  <ChevronRight aria-hidden="true" size={18} className="col-start-2 row-start-1 text-action sm:col-start-auto sm:row-start-auto" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {discharges.data && (discharges.data.previous || discharges.data.next) && (
          <nav aria-label="Chiqarish sahifalari" className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
            <button type="button" className={secondaryButton} disabled={!discharges.data.previous} onClick={() => setPage(page - 1)}>Oldingi</button>
            <span className="text-sm text-muted">Sahifa {page}</span>
            <button type="button" className={secondaryButton} disabled={!discharges.data.next} onClick={() => setPage(page + 1)}>Keyingi</button>
          </nav>
        )}
      </section>
    </section>
  )
}
