import type { ReactNode } from 'react'

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-muted shadow-xs"
    >
      {children}
    </p>
  )
}
