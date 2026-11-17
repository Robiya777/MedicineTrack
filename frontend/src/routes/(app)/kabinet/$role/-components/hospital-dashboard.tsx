import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import {
  dischargePageQuery,
  hospitalPatientQuery,
} from '../../../../../api/hospital'
import { formatTashkentDateTime } from '../../../../../lib/date'
import { dischargeStatusLabels } from '../../../../../features/hospital/format'
import {
  Notice,
  primaryButton,
  RequestError,
  secondaryButton,
} from '../../../../../components/ui'

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

  const statusBadge = (status: 'DRAFT' | 'CONFIRMED') => {
    const isDraft = status === 'DRAFT'
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
          isDraft
            ? 'border-amber-200 bg-amber-50 text-amber-800'
            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isDraft ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          aria-hidden="true"
        />
        {dischargeStatusLabels[status]}
      </span>
    )
  }

  return (
    <section aria-labelledby="workspace-title" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1
            id="workspace-title"
            className="text-2xl sm:text-3xl font-bold tracking-tight text-ink"
          >
            Statsionar kabineti
          </h1>
          <p className="mt-1 text-sm text-muted">
            Chiqarish yozuvlari va bemorni kuzatuvga topshirish.
          </p>
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
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">Chiqarishlar ro‘yxati</caption>
                <thead>
                  <tr className="border-b border-line bg-slate-50/60">
                    <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted">
                      Bemor
                    </th>
                    <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted">
                      Chiqarilgan vaqt (Toshkent)
                    </th>
                    <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted">
                      Holat
                    </th>
                    <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted text-right">
                      <span className="sr-only">Amal</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {rows.map((row) => (
                    <tr key={row.id} className="transition hover:bg-page/50">
                      <td className="px-5 py-4 align-middle">
                        <span className="block font-semibold text-ink text-sm">
                          {row.patient_snapshot.full_name ??
                            names.get(row.patient) ??
                            'Bemor'}
                        </span>
                        <p className="text-xs text-muted">#{row.id.slice(0, 8)}</p>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <time
                          className="font-medium text-ink text-sm"
                          dateTime={row.discharged_at}
                        >
                          {formatTashkentDateTime(row.discharged_at)}
                        </time>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        {statusBadge(row.status)}
                      </td>
                      <td className="px-5 py-4 align-middle text-right">
                        <Link
                          to="/kabinet/$role/chiqarish/$dischargeId"
                          params={{ role: 'statsionar', dischargeId: row.id }}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-semibold text-primary hover:bg-teal-50 transition cursor-pointer"
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

            <ul className="space-y-4 p-4 md:hidden" aria-label="Chiqarishlar ro‘yxati">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-ink text-sm">
                        {row.patient_snapshot.full_name ??
                          names.get(row.patient) ??
                          'Bemor'}
                      </h3>
                      <p className="text-xs text-muted">#{row.id.slice(0, 8)}</p>
                    </div>
                    {statusBadge(row.status)}
                  </div>
                  <dl className="border-t border-line/60 pt-3 text-xs">
                    <div>
                      <dt className="font-medium text-muted">Chiqarilgan vaqt</dt>
                      <dd className="font-semibold text-ink mt-0.5">
                        {formatTashkentDateTime(row.discharged_at)}
                      </dd>
                    </div>
                  </dl>
                  <div className="border-t border-line/60 pt-3 text-right">
                    <Link
                      to="/kabinet/$role/chiqarish/$dischargeId"
                      params={{ role: 'statsionar', dischargeId: row.id }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                      aria-label={
                        (row.patient_snapshot.full_name ??
                          names.get(row.patient) ??
                          'Bemor') + ' — chiqarishni ko‘rish'
                      }
                    >
                      <span>Chiqarishni ko‘rish</span>
                      <ChevronRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {discharges.data &&
          (discharges.data.previous || discharges.data.next) && (
            <nav
              aria-label="Chiqarish sahifalari"
              className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 bg-slate-50/30"
            >
              <button
                type="button"
                className={secondaryButton}
                disabled={!discharges.data.previous}
                onClick={() => setPage(page - 1)}
              >
                Oldingi
              </button>
              <span className="text-xs font-semibold text-muted">
                Sahifa {page}
              </span>
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
