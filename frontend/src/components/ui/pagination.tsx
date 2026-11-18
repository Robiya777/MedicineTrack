import { secondaryButton } from './button'

export interface PaginationProps {
  page: number
  onPageChange: (newPage: number) => void
  hasPrevious: boolean
  hasNext: boolean
  totalCount?: number
  label?: string
}

export function Pagination({
  page,
  onPageChange,
  hasPrevious,
  hasNext,
  totalCount,
  label = 'yozuv',
}: PaginationProps) {
  return (
    <nav
      aria-label="Sahifalar"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 bg-slate-50/30"
    >
      <span className="text-xs font-semibold text-muted">
        {totalCount !== undefined
          ? `Jami: ${totalCount} ta ${label} · Sahifa ${page}`
          : `Sahifa ${page}`}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={secondaryButton}
          disabled={!hasPrevious}
          onClick={() => onPageChange(page - 1)}
        >
          Oldingi
        </button>
        <span className="min-w-6 text-center text-xs font-bold text-ink">
          {page}
        </span>
        <button
          type="button"
          className={secondaryButton}
          disabled={!hasNext}
          onClick={() => onPageChange(page + 1)}
        >
          Keyingi
        </button>
      </div>
    </nav>
  )
}
