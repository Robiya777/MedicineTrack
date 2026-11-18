import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
  backTo?: {
    to: string
    params?: Record<string, string>
    search?: Record<string, unknown>
    label: string
  }
}

export function PageHeader({
  title,
  description,
  action,
  backTo,
}: PageHeaderProps) {
  return (
    <div className="space-y-4">
      {backTo && (
        <Link
          to={backTo.to}
          params={backTo.params}
          search={backTo.search}
          className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          {backTo.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted">{description}</p>
          )}
        </div>
        {action && <div className="flex items-center gap-3">{action}</div>}
      </div>
    </div>
  )
}
