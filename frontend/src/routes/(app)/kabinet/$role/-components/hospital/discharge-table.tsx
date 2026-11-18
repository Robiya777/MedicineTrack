import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import type { Discharge } from '@/api/hospital'
import { formatTashkentDateTime } from '@/lib/date'
import { DischargeStatusBadge } from '@/features/hospital/discharge-status-badge'

export interface DischargeTableProps {
  rows: Discharge[]
  names: Map<string, string>
}

export function DischargeTable({ rows, names }: DischargeTableProps) {
  return (
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
                <DischargeStatusBadge status={row.status} />
              </td>
              <td className="px-5 py-4 align-middle text-right">
                <Link
                  to="/kabinet/$role/chiqarish/$dischargeId"
                  params={{ role: 'koordinator', dischargeId: row.id }}
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
  )
}
