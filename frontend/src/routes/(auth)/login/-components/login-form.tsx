import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { HeartPulse } from 'lucide-react'
import { useState, type SubmitEvent } from 'react'
import { signIn } from '../../../../api/session'
import { workspaces } from '../../../../components/workspaces'

const inputClass = 'mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base'

function loginError(error: unknown) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  if (status === 401) return 'Login yoki parol noto‘g‘ri.'
  if (status === 429) return 'Urinishlar soni oshib ketdi. Birozdan keyin qayta urinib ko‘ring.'
  return 'Kirish amalga oshmadi. Ulanishni tekshirib, qayta urinib ko‘ring.'
}

const loginRoute = getRouteApi('/(auth)/login/')

export function LoginForm() {
  const { expired } = loginRoute.useSearch()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const form = new FormData(event.currentTarget)
    const username = String(form.get('username') ?? '').trim()
    const password = String(form.get('password') ?? '')
    if (!username) {
      setError('Loginni kiriting.')
      return
    }

    setPending(true)
    setError('')
    try {
      const user = await signIn(username, password)
      await navigate({
        to: '/kabinet/$role',
        params: { role: workspaces[user.role].slug },
        replace: true,
      })
    } catch (cause) {
      setError(loginError(cause))
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[#edf5f3] px-4 py-8 sm:py-12">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-[#c8dbd5] bg-white md:grid-cols-[2fr_3fr]">
        <div className="flex flex-col justify-between gap-8 bg-[#123e37] px-6 py-7 text-white md:px-9 md:py-10">
          <Link to="/" className="inline-flex w-fit items-center gap-3 rounded-sm text-lg font-semibold focus-visible:outline-white">
            <HeartPulse size={24} aria-hidden="true" />
            MedicineTrack
          </Link>
          <p className="max-w-64 text-lg leading-snug text-[#dceee7]">
            Statsionardan chiqarilgandan keyingi bemor kuzatuvi.
          </p>
        </div>

        <div className="p-6 sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight">Kabinetga kirish</h1>
          {expired && <p className="mt-3 text-sm text-warning" role="status">Sessiya tugadi. Qayta kiring.</p>}

          <form className="mt-6 space-y-5" onSubmit={handleSubmit} aria-busy={pending}>
            <div>
              <label htmlFor="username" className="text-sm font-medium">Login</label>
              <input id="username" name="username" className={inputClass} autoComplete="username" maxLength={150} required />
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-medium">Parol</label>
              <input id="password" name="password" className={inputClass} type="password" autoComplete="current-password" required />
            </div>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
            <button
              className="min-h-11 w-full rounded-lg bg-[#0b6155] px-4 py-2.5 font-semibold text-white hover:bg-[#094e45] disabled:opacity-60"
              type="submit"
              disabled={pending}
            >
              {pending ? 'Kirilmoqda…' : 'Kirish'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
