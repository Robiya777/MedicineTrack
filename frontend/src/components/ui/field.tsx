import { useId, type ReactNode } from 'react'

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: (props: {
    id: string
    'aria-invalid': boolean
    'aria-describedby': string | undefined
  }) => ReactNode
}) {
  const id = useId()
  const message = error || hint
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': message ? id + '-message' : undefined,
      })}
      {message && (
        <p
          id={id + '-message'}
          role={error ? 'alert' : undefined}
          className={`text-xs ${error ? 'font-medium text-danger' : 'text-muted'}`}
        >
          {message}
        </p>
      )}
    </div>
  )
}
