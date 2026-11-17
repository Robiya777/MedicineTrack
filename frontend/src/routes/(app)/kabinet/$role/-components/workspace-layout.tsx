import { Link, Navigate, Outlet, useNavigate, useRouter } from '@tanstack/react-router'
import { HeartPulse } from 'lucide-react'
import { useState } from 'react'
import { signOut } from '../../../../../api/session'
import { workspaces } from '../../../../../components/workspaces'
import { useSessionStore } from '../../../../../state/session'

export function WorkspaceLayout() {
  const user = useSessionStore((state) => state.user)
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function handleLogout() {
    setPending(true)
    setError('')
    try {
      await signOut()
      await navigate({ to: '/login', search: {}, replace: true })
    } catch {
      setError('Chiqish amalga oshmadi. Ulanishni tekshirib, qayta urinib ko‘ring.')
    } finally {
      setPending(false)
    }
  }

  if (!user) return pending ? null : <Navigate to="/login" search={{ expired: true }} replace />

  const patientPortal = user.role === 'PATIENT'
  const rail = patientPortal ? 'bg-[#fffdf5]' : 'bg-[#f7fcfa] md:border-b-0 md:border-r'
  const layout = patientPortal ? 'bg-[#f8f5ec]' : 'bg-[#edf5f3] md:grid md:grid-cols-[14rem_minmax(0,1fr)]'

  return (
    <div className={`min-h-dvh ${layout}`}>
      <header className={`flex flex-wrap justify-between gap-3 border-b border-line px-5 py-4 ${rail} ${patientPortal ? '' : 'md:flex-col md:justify-start md:gap-6 md:py-7'}`}>
        <Link
          to="/kabinet/$role"
          params={{ role: workspaces[user.role].slug }}
          className="inline-flex min-h-11 items-center gap-2 rounded-sm text-lg font-semibold text-[#123e37]"
        >
          <HeartPulse size={22} aria-hidden="true" />
          MedicineTrack
        </Link>
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={pending}
          className="min-h-11 rounded-lg border border-line bg-white px-4 text-sm font-medium text-action hover:bg-surface disabled:opacity-60"
        >
          {pending ? 'Chiqilmoqda…' : 'Chiqish'}
        </button>
      </header>
      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
        {error && <p className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
        <Outlet />
      </main>
    </div>
  )
}

export function SessionError({ reset }: { reset: () => void }) {
  const router = useRouter()
  return (
    <main className="mx-auto max-w-xl space-y-4 px-5 py-12">
      <h1 className="text-2xl font-semibold">Kabinet ochilmadi</h1>
      <p className="text-muted" role="alert">Sessiyani tekshirib bo‘lmadi. Ulanishni tekshirib, qayta urinib ko‘ring.</p>
      <button
        type="button"
        onClick={() => {
          reset()
          void router.invalidate()
        }}
        className="min-h-11 rounded-lg bg-action px-4 font-medium text-white"
      >
        Qayta tekshirish
      </button>
    </main>
  )
}
