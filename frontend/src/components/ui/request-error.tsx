import { extractApiErrorMessage } from '@/lib/errors'
import { secondaryButton } from './button'

export function RequestError({
  error,
  retry,
}: {
  error: unknown
  retry?: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/20 bg-danger-wash p-4">
      <p role="alert" className="min-w-0 wrap-break-word text-sm font-medium text-danger">
        {extractApiErrorMessage(error)}
      </p>
      {retry && (
        <button type="button" className={secondaryButton} onClick={retry}>
          Qayta tekshirish
        </button>
      )}
    </div>
  )
}
