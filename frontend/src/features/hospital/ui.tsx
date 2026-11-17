import type { ReactNode } from 'react'
import { hospitalErrorMessage } from '../../api/hospital'

export const primaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#0b6155] px-4 py-2 text-sm font-semibold text-white hover:bg-[#094e45] disabled:opacity-60'

export const secondaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-action hover:bg-surface disabled:opacity-60'

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-xl border border-line bg-white px-4 py-5 text-muted">
      {children}
    </p>
  )
}

export function RequestError({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
      <p role="alert" className="min-w-0 wrap-break-word text-sm text-red-900">{hospitalErrorMessage(error)}</p>
      {retry && <button type="button" className={secondaryButton} onClick={retry}>Qayta tekshirish</button>}
    </div>
  )
}

export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      {items.map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="mt-1 whitespace-pre-wrap wrap-break-word font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
