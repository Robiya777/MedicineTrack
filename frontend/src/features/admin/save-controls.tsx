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
      <div className="flex flex-wrap gap-3">
        <button className={primaryButton} disabled={pending}>
          {pending ? 'Saqlanmoqda…' : label}
        </button>
        <button
          type="button"
          className={secondaryButton}
          disabled={pending}
          onClick={close}
        >
          Bekor qilish
        </button>
      </div>
    </>
  )
}
