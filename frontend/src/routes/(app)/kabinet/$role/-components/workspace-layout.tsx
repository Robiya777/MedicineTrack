import { NotificationBell } from '../../../../../components/notification-bell'
import {
  Link,
  Navigate,
  Outlet,
  getRouteApi,
  useNavigate,
  useRouter,
  useLocation,
} from '@tanstack/react-router'
import {
  Building2,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'
import { signOut } from '../../../../../api/session'
import { workspaces } from '../../../../../lib/workspaces'
import { Dialog, secondaryButton } from '../../../../../components/ui'
import { useSessionStore } from '../../../../../state/session'

const workspaceRoute = getRouteApi('/(app)/kabinet/$role')

export function WorkspaceLayout() {
  const user = useSessionStore((state) => state.user)
  const navigate = useNavigate()
  const search = workspaceRoute.useSearch()
  const pathname = useLocation({ select: (location) => location.pathname })
  const [drawer, setDrawer] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function handleLogout() {
    setPending(true)
    setError('')
    try {
      await signOut()
      await navigate({ to: '/login', search: {}, replace: true })
    } catch {
      setError(
        'Chiqish amalga oshmadi. Ulanishni tekshirib, qayta urinib ko‘ring.',
      )
    } finally {
      setPending(false)
    }
  }

  if (!user)
    return pending ? null : (
      <Navigate to="/login" search={{ expired: true }} replace />
    )
  const workspace = workspaces[user.role]
  const fullName =
    [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
  const initials = fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
  const home = '/kabinet/' + workspace.slug

  const navLinkClass = (isActive: boolean) =>
    `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition cursor-pointer ${
      isActive
        ? 'bg-mint text-primary-hover font-semibold'
        : 'text-muted hover:bg-page hover:text-ink'
    }`

  const isHomeActive =
    pathname.replace(/\/$/, '') === home &&
    (!search.segment || search.segment === 'all' || search.segment === 'open')

  const navigation = (
    <nav className="flex flex-col gap-1.5" aria-label="Kabinet menyusi">
      <Link
        to="/kabinet/$role"
        params={{ role: workspace.slug }}
        search={{}}
        className={navLinkClass(isHomeActive)}
        aria-current={isHomeActive ? 'page' : undefined}
        onClick={() => setDrawer(false)}
      >
        <LayoutDashboard size={19} aria-hidden="true" />
        <span>{user.role === 'HOSPITAL' ? 'Chiqarishlar' : 'Ish stoli'}</span>
      </Link>
      {['PATIENT', 'DOCTOR', 'HOSPITAL'].includes(user.role) && (
        <Link
          to="/kabinet/$role/dorilar"
          params={{ role: workspace.slug }}
          search={{}}
          className={navLinkClass(pathname.includes('/dorilar'))}
          aria-current={pathname.includes('/dorilar') ? 'page' : undefined}
          onClick={() => setDrawer(false)}
        >
          Dori jadvali
        </Link>
      )}
      {['PATIENT', 'DOCTOR'].includes(user.role) && (
        <Link
          to="/kabinet/$role/suhbat"
          params={{ role: workspace.slug }}
          search={{}}
          className={navLinkClass(pathname.includes('/suhbat'))}
          aria-current={pathname.includes('/suhbat') ? 'page' : undefined}
          onClick={() => setDrawer(false)}
        >
          Suhbatlar
        </Link>
      )}
      {user.role === 'COORDINATOR' && (
        <>
          <Link
            to="/kabinet/$role/ish-jadvali"
            params={{ role: workspace.slug }}
            search={{}}
            className={navLinkClass(pathname.includes('/ish-jadvali'))}
            aria-current={pathname.includes('/ish-jadvali') ? 'page' : undefined}
            onClick={() => setDrawer(false)}
          >
            Ish jadvali
          </Link>
          <Link
            to="/kabinet/$role/murojaatlar"
            params={{ role: workspace.slug }}
            search={{}}
            className={navLinkClass(pathname.includes('/murojaatlar'))}
            aria-current={pathname.includes('/murojaatlar') ? 'page' : undefined}
            onClick={() => setDrawer(false)}
          >
            Javobsiz murojaatlar
          </Link>
        </>
      )}
      {user.role === 'COORDINATOR' &&
        [
          ['unassigned', 'Mas’ulsiz chaqiruvlar'],
          ['soon', 'Muddati yaqin'],
          ['overdue', 'Kechikkan chaqiruvlar'],
        ].map(([segment, label]) => {
          const active = search.segment === segment
          return (
            <Link
              key={segment}
              to="/kabinet/$role"
              params={{ role: workspace.slug }}
              search={{ segment: segment as 'unassigned' | 'soon' | 'overdue' }}
              className={navLinkClass(active)}
              aria-current={active ? 'true' : undefined}
              onClick={() => setDrawer(false)}
            >
              {label}
            </Link>
          )
        })}
    </nav>
  )

  const logout = (
    <button
      type="button"
      className={secondaryButton}
      onClick={() => void handleLogout()}
      disabled={pending}
    >
      <LogOut size={17} aria-hidden="true" />
      {pending ? 'Chiqilmoqda…' : 'Chiqish'}
    </button>
  )

  return (
    <div className="min-h-screen bg-page font-sans text-ink">
      <a
        href="#workspace-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-md focus:outline-primary"
      >
        Asosiy mazmunga o‘tish
      </a>

      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col justify-between border-r border-line bg-surface p-6 md:flex">
        <div className="space-y-6">
          <Link
            to="/kabinet/$role"
            params={{ role: workspace.slug }}
            search={{}}
            className="flex items-center gap-3 text-ink font-bold text-lg tracking-tight"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-primary border border-teal-200/60">
              <HeartPulse size={22} aria-hidden="true" />
            </span>
            <strong>MedicineTrack</strong>
          </Link>
          {navigation}
        </div>

        <div className="border-t border-line pt-5 space-y-4">
          <div className="rounded-xl bg-slate-50 p-3 border border-line/60">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <ShieldCheck size={14} aria-hidden="true" />
              Ishchi kabinet
            </span>
            <strong className="block text-xs font-bold text-ink mt-0.5">
              {workspace.label}
            </strong>
          </div>
          {logout}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="min-h-screen md:pl-64 flex flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-surface/80 px-6 backdrop-blur-md">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink md:hidden hover:bg-page cursor-pointer"
            aria-label="Menyuni ochish"
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>

          <div className="hidden sm:flex items-center gap-2 text-sm font-semibold text-muted">
            <Building2 size={18} aria-hidden="true" />
            <span>{workspace.title}</span>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-primary border border-teal-200/60"
                aria-hidden="true"
              >
                {initials}
              </span>
              <div className="hidden text-left lg:block">
                <strong className="block text-xs font-bold text-ink leading-tight">
                  {fullName}
                </strong>
                <span className="text-[11px] text-muted leading-tight">
                  {workspace.label}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main id="workspace-content" tabIndex={-1} className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">
          {error && (
            <p
              className="mb-5 rounded-xl border border-danger/20 bg-danger-wash px-4 py-3 text-sm font-medium text-danger"
              role="alert"
            >
              {error}
            </p>
          )}
          <Outlet />
          <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-xs text-muted">
            <p className="flex items-center gap-1.5 font-medium">
              <ShieldCheck size={14} aria-hidden="true" />
              Bemor kuzatuvi
            </p>
            <p>Vaqtlar Toshkent vaqtida</p>
          </footer>
        </main>
      </div>

      {drawer && (
        <Dialog title="MedicineTrack" close={() => setDrawer(false)} drawer>
          <div className="space-y-6">
            {navigation}
            <div className="border-t border-line pt-4 space-y-3">
              <span className="block text-xs font-bold text-ink">{fullName}</span>
              {logout}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}

export function SessionError({ reset }: { reset: () => void }) {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-page font-sans text-ink flex items-center justify-center p-4">
      <main className="w-full max-w-md space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-xs">
        <h1 className="text-xl font-bold tracking-tight text-ink">
          Kabinet ochilmadi
        </h1>
        <p className="text-sm text-muted" role="alert">
          Sessiyani tekshirib bo‘lmadi. Ulanishni tekshirib, qayta urinib
          ko‘ring.
        </p>
        <button
          type="button"
          className={secondaryButton}
          onClick={() => {
            reset()
            void router.invalidate()
          }}
        >
          Qayta tekshirish
        </button>
      </main>
    </div>
  )
}
