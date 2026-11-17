import { dischargeStatusLabels } from './format'

export interface DischargeStatusBadgeProps {
  status: 'DRAFT' | 'CONFIRMED'
}

export function DischargeStatusBadge({ status }: DischargeStatusBadgeProps) {
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
