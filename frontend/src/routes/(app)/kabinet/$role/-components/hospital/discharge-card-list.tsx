import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import type { Discharge } from '@/api/hospital'
import { formatTashkentDateTime } from '@/lib/date'
import { DischargeStatusBadge } from '@/features/hospital/discharge-status-badge'

export interface DischargeCardListProps {
  rows: Discharge[]
  names: Map<string, string>
}

export function DischargeCardList({ rows, names }: DischargeCardListProps) {
  return (
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
            <DischargeStatusBadge status={row.status} />
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
              params={{ role: 'koordinator', dischargeId: row.id }}
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
  )
}
