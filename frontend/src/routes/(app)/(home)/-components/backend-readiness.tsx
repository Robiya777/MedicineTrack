import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { CircleAlert, CircleCheck, CloudOff, LoaderCircle } from 'lucide-react'
import { checkBackendReadiness } from '../../../../api/client'

const connectionStatus = {
  checking: { label: 'Tekshirilmoqda…', Icon: LoaderCircle, color: 'text-muted' },
  ready: { label: 'Backend tayyor', Icon: CircleCheck, color: 'text-ready' },
  unavailable: {
    label: 'Backend javob berdi, tayyorlik tekshiruvi o‘tmadi',
    Icon: CircleAlert,
    color: 'text-warning',
  },
  disconnected: { label: 'Backendga ulanib bo‘lmadi', Icon: CloudOff, color: 'text-warning' },
}

export function BackendReadiness() {
  const { isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['backend', 'readiness'],
    queryFn: ({ signal }) => checkBackendReadiness(signal),
    networkMode: 'always',
    retry: false,
    refetchOnWindowFocus: false,
  })

  let status: keyof typeof connectionStatus = 'ready'
  if (isPending || isFetching) {
    status = 'checking'
  } else if (isError) {
    status = isAxiosError(error) && error.response?.status === 503 ? 'unavailable' : 'disconnected'
  }

  const { label, Icon, color } = connectionStatus[status]

  return (
    <section aria-labelledby="readiness-title" className="max-w-2xl">
      <h1 id="readiness-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Backend holati
      </h1>
      <div className="mt-6 flex flex-col items-start gap-4 rounded-xl border border-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <p role="status" className={`flex items-center gap-3 text-sm font-medium ${color}`}>
          <Icon
            aria-hidden="true"
            size={20}
            className={status === 'checking' ? 'shrink-0 motion-safe:animate-spin' : 'shrink-0'}
          />
          {label}
        </p>
        <button
          type="button"
          disabled={isFetching}
          onClick={() => void refetch()}
          className="min-h-11 shrink-0 rounded-md border border-line px-4 text-sm font-semibold text-action hover:bg-surface disabled:opacity-60"
        >
          Qayta tekshirish
        </button>
      </div>
    </section>
  )
}
