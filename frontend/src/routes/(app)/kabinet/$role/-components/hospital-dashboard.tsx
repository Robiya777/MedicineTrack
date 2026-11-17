import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import {
  dischargePageQuery,
  hospitalPatientQuery,
} from '../../../../../api/hospital'
import {
  dischargeStatusLabels,
  formatTashkentDateTime,
} from '../../../../../features/hospital/format'
import {
  Notice,
  primaryButton,
  RequestError,
  secondaryButton,
} from '../../../../../features/hospital/ui'

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

  return (
    <section aria-labelledby="workspace-title" className="space-y-6">
      <div className="mt-page-heading">
        <div>
          <h1 id="workspace-title">Statsionar kabineti</h1>
          <p>Chiqarish yozuvlari va bemorni kuzatuvga topshirish.</p>
        </div>
        <Link
          to="/kabinet/$role/chiqarish/yangi"
          params={{ role: 'statsionar' }}
          className={primaryButton}
        >
          <Plus size={18} aria-hidden="true" />
          Yangi chiqarish
        </Link>
      </div>
      <section
        aria-labelledby="discharges-title"
        className="mt-card overflow-hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-4 sm:px-6">
          <h2 id="discharges-title" className="text-xl font-semibold">
            Chiqarishlar
          </h2>
          {discharges.data && (
            <span className="text-sm text-muted">
              {discharges.data.count} ta yozuv
            </span>
          )}
        </div>
        {discharges.isPending && (
          <div className="p-4">
            <Notice>Chiqarishlar yuklanmoqda…</Notice>
          </div>
        )}
        {discharges.isError && (
          <div className="p-4">
            <RequestError
              error={discharges.error}
              retry={() => void discharges.refetch()}
            />
          </div>
        )}
        {discharges.data && rows.length === 0 && (
          <div className="p-4">
            <Notice>Chiqarish yozuvlari hali yo‘q.</Notice>
          </div>
        )}
        {rows.length > 0 && (
          <>
            <div className="mt-table-wrap">
              <table className="mt-table mt-live-table">
                <caption className="mt-sr-only">Chiqarishlar ro‘yxati</caption>
                <thead>
                  <tr>
                    <th scope="col">Bemor</th>
                    <th scope="col">Chiqarilgan vaqt (Toshkent)</th>
                    <th scope="col">Holat</th>
                    <th scope="col">
                      <span className="mt-sr-only">Amal</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span className="mt-patient-name">
                          {row.patient_snapshot.full_name ??
                            names.get(row.patient) ??
                            'Bemor'}
                        </span>
                        <p className="mt-cell-meta">#{row.id.slice(0, 8)}</p>
                      </td>
                      <td>
                        <time
                          className="mt-due-date"
                          dateTime={row.discharged_at}
                        >
                          {formatTashkentDateTime(row.discharged_at)}
                        </time>
                      </td>
                      <td>
                        <span
                          className={
                            'mt-status mt-status-' +
                            (row.status === 'DRAFT'
                              ? 'unassigned'
                              : 'completed')
                          }
                        >
                          {dischargeStatusLabels[row.status]}
                        </span>
                      </td>
                      <td>
                        <Link
                          to="/kabinet/$role/chiqarish/$dischargeId"
                          params={{ role: 'statsionar', dischargeId: row.id }}
                          className="mt-row-action"
                          aria-label={
                            (row.patient_snapshot.full_name ??
                              names.get(row.patient) ??
                              'Bemor') + ' — chiqarishni ko‘rish'
                          }
                        >
                          <span>Ko‘rish</span>
                          <ChevronRight size={18} aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="mt-mobile-tasks" aria-label="Chiqarishlar ro‘yxati">
              {rows.map((row) => (
                <li key={row.id} className="mt-mobile-task">
                  <div className="mt-mobile-task-heading">
                    <div>
                      <h3>
                        {row.patient_snapshot.full_name ??
                          names.get(row.patient) ??
                          'Bemor'}
                      </h3>
                      <p className="mt-cell-meta">#{row.id.slice(0, 8)}</p>
                    </div>
                    <span
                      className={
                        'mt-status mt-status-' +
                        (row.status === 'DRAFT' ? 'unassigned' : 'completed')
                      }
                    >
                      {dischargeStatusLabels[row.status]}
                    </span>
                  </div>
                  <dl className="mt-mobile-task-facts">
                    <div>
                      <dt>Chiqarilgan vaqt</dt>
                      <dd>{formatTashkentDateTime(row.discharged_at)}</dd>
                    </div>
                  </dl>
                  <Link
                    to="/kabinet/$role/chiqarish/$dischargeId"
                    params={{ role: 'statsionar', dischargeId: row.id }}
                    className="mt-link"
                    aria-label={
                      (row.patient_snapshot.full_name ??
                        names.get(row.patient) ??
                        'Bemor') + ' — chiqarishni ko‘rish'
                    }
                  >
                    Chiqarishni ko‘rish
                    <ChevronRight size={18} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
        {discharges.data &&
          (discharges.data.previous || discharges.data.next) && (
            <nav
              aria-label="Chiqarish sahifalari"
              className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3"
            >
              <button
                type="button"
                className={secondaryButton}
                disabled={!discharges.data.previous}
                onClick={() => setPage(page - 1)}
              >
                Oldingi
              </button>
              <span className="text-sm text-muted">Sahifa {page}</span>
              <button
                type="button"
                className={secondaryButton}
                disabled={!discharges.data.next}
                onClick={() => setPage(page + 1)}
              >
                Keyingi
              </button>
            </nav>
          )}
      </section>
    </section>
  )
}
