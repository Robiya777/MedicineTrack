import type { ReactNode } from 'react'

export function Facts({
  items,
}: {
  items: { label: string; value: ReactNode }[]
}) {
  return (
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      {items.map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <dt className="text-sm font-medium text-muted">{label}</dt>
          <dd className="mt-1 whitespace-pre-wrap wrap-break-word text-sm font-semibold text-ink">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
