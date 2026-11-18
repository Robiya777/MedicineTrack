import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { Eye, EyeOff, HeartPulse, ShieldCheck } from 'lucide-react'
import { useState, type SubmitEvent } from 'react'
import { signIn } from '@/api/session'
import { inputStyle, primaryButton } from '@/components/ui'
import { workspaces } from '@/lib/workspaces'

const inputClass = `${inputStyle} min-h-12 border-input-line text-base`

function loginError(error: unknown) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  if (status === 401) return 'Login yoki parol noto‘g‘ri.'
  if (status === 429)
    return 'Urinishlar soni oshib ketdi. Birozdan keyin qayta urinib ko‘ring.'
  return 'Kirish amalga oshmadi. Ulanishni tekshirib, qayta urinib ko‘ring.'
}

const loginRoute = getRouteApi('/(auth)/login/')

export function LoginForm() {
  const { expired } = loginRoute.useSearch()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
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
    <main className="flex min-h-svh items-center justify-center bg-page p-4 sm:p-8 lg:p-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-line bg-surface shadow-xl shadow-primary/5 md:grid-cols-2">
        <div className="flex flex-col justify-between gap-10 bg-primary p-7 text-white sm:p-10 lg:p-12">
          <Link to="/" className="inline-flex w-fit items-center gap-3 rounded-lg text-xl font-semibold tracking-tight focus-visible:outline-white">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white/15">
              <HeartPulse size={29} aria-hidden="true" />
            </span>
            <strong>MedicineTrack</strong>
          </Link>
          <div>
            <h2 className="max-w-xs text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Har bir bemor e’tiborda.</h2>
            <p className="mt-5 max-w-sm text-base leading-7 text-white/90">
              Statsionardan chiqarilgandan keyingi bemor kuzatuvi va o‘z vaqtida
              patronaj.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm leading-6 text-white/90">
            <ShieldCheck size={19} aria-hidden="true" />
            Bemorlar va tibbiyot xodimlari uchun
          </div>
        </div>
        <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Kabinetga kirish</h1>
          <p className="mt-3 text-sm leading-6 text-muted">Hisobingiz orqali tizimga kiring.</p>
          {expired && (
            <p className="mt-3 text-sm text-warning" role="status">
              Sessiya tugadi. Qayta kiring.
            </p>
          )}

          <form
            className="mt-6 space-y-5"
            onSubmit={handleSubmit}
            aria-busy={pending}
          >
            <div>
              <label htmlFor="username" className="text-sm font-medium">
                Login
              </label>
              <input
                id="username"
                name="username"
                className={inputClass}
                autoComplete="username"
                maxLength={150}
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-medium">
                Parol
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  name="password"
                  className={`${inputClass} pr-14`}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-1 my-auto inline-flex size-11 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-page hover:text-ink"
                  aria-label={
                    showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'
                  }
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={19} aria-hidden="true" />
                  ) : (
                    <Eye size={19} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            {error && (
              <p
                className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"
                role="alert"
              >
                {error}
              </p>
            )}
            <button
              className={`${primaryButton} min-h-12 w-full text-base`}
              type="submit"
              disabled={pending}
            >
              {pending ? 'Kirilmoqda…' : 'Kirish'}
            </button>
          </form>
          <Link to="/faollashtirish" className="mt-5 inline-flex min-h-11 items-center self-start rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover">Bemor hisobini faollashtirish</Link>
        </div>
      </div>
    </main>
  )
}
