import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Clock3,
  ShieldCheck,
  UserRoundX,
} from 'lucide-react'
import { metricsQuery } from '../../api/tasks'
import { Notice, RequestError } from '../../components/ui'

export function CoordinatorMetrics() {
  const metrics = useQuery(metricsQuery())

  if (metrics.isPending) {
    return <Notice>Hudud ko‘rsatkichlari yuklanmoqda…</Notice>
  }
  if (metrics.isError) {
    return (
      <RequestError
        error={metrics.error}
        retry={() => void metrics.refetch()}
      />
    )
  }

  const data = metrics.data
  const toneStyles: Record<string, string> = {
    primary: 'bg-teal-50 text-teal-700 border-teal-200/60',
    danger: 'bg-red-50 text-red-600 border-red-200/60',
    warning: 'bg-amber-50 text-amber-700 border-amber-200/60',
  }

  const metricCards = [
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
  ]

  return (
    <section aria-labelledby="metrics-title" className="space-y-3">
      <h2 id="metrics-title" className="text-xs font-bold uppercase tracking-wider text-muted">
        Hudud bo‘yicha ko‘rsatkichlar
      </h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map(({ label, value, Icon, tone }) => (
          <div
            key={label}
            className="rounded-2xl border border-line bg-surface p-5 shadow-xs transition hover:shadow-sm"
          >
            <dt className="flex items-center justify-between text-xs font-semibold text-muted">
              <span>{label}</span>
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl border ${toneStyles[tone]}`}
              >
                <Icon size={19} aria-hidden="true" />
              </span>
            </dt>
            <dd className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted">
        O‘z vaqtida bajarilgan: <strong className="text-ink">{data.completed_on_time}</strong> / baholanadigan:{' '}
        <strong className="text-ink">{data.assessed}</strong>. Bekor qilingan:{' '}
        <strong className="text-ink">{data.cancelled}</strong>. Kech
        hujjatlashtirilgan: <strong className="text-ink">{data.late_documented}</strong>.
      </p>
    </section>
  )
}
