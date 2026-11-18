import { Save, X } from 'lucide-react'
import {primaryButton,secondaryButton,RequestError} from '@/components/ui'
export function SaveControls({
  pending,
  error,
  close,
  label,
}: {
  pending: boolean
  error: unknown
  close: () => void
  label: string
}) {
  return (
    <>
      {error ? <RequestError error={error} /> : null}
      <div className="flex flex-wrap gap-3 border-t border-line pt-5">
        <button className={primaryButton} disabled={pending}>
          <Save size={17} aria-hidden="true"/>{pending ? 'Saqlanmoqda…' : label}
        </button>
        <button
          type="button"
          className={secondaryButton}
          disabled={pending}
          onClick={close}
        >
          <X size={16} aria-hidden="true"/>Bekor qilish
        </button>
      </div>
    </>
  )
}
