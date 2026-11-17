import {NotificationBell} from '../../../../../components/notification-bell'
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
import { workspaces } from '../../../../../components/workspaces'
import { Dialog } from '../../../../../components/dialog'
import { useSessionStore } from '../../../../../state/session'
import { secondaryButton } from '../../../../../features/hospital/ui'

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
  const navigation = (
    <nav
      className="mt-navigation mt-live-navigation"
      aria-label="Kabinet menyusi"
    >
      <Link
        to="/kabinet/$role"
        params={{ role: workspace.slug }}
        search={{}}
        aria-current={
          pathname.replace(/\/$/, '') === home &&
          (!search.segment ||
            search.segment === 'all' ||
            search.segment === 'open')
            ? 'page'
            : undefined
        }
        onClick={() => setDrawer(false)}
      >
        <LayoutDashboard size={19} aria-hidden="true" />
        <span>{user.role === 'HOSPITAL' ? 'Chiqarishlar' : 'Ish stoli'}</span>
      </Link>
      {['PATIENT','DOCTOR','HOSPITAL'].includes(user.role)&&<Link to="/kabinet/$role/dorilar" params={{role:workspace.slug}} search={{}} onClick={()=>setDrawer(false)}>Dori jadvali</Link>}
      {['PATIENT','DOCTOR'].includes(user.role) && <Link to="/kabinet/$role/suhbat" aria-current={pathname.includes('/suhbat') ? 'page' : undefined} params={{role:workspace.slug}} search={{}} onClick={() => setDrawer(false)}>Suhbatlar</Link>}
      {user.role === 'COORDINATOR' && <><Link to="/kabinet/$role/ish-jadvali" aria-current={pathname.includes('/ish-jadvali') ? 'page' : undefined} params={{role:workspace.slug}} search={{}} onClick={() => setDrawer(false)}>Ish jadvali</Link><Link to="/kabinet/$role/murojaatlar" aria-current={pathname.includes('/murojaatlar') ? 'page' : undefined} params={{role:workspace.slug}} search={{}} onClick={() => setDrawer(false)}>Javobsiz murojaatlar</Link></>}
      {user.role === 'COORDINATOR' &&
        [
          ['unassigned', 'Mas’ulsiz chaqiruvlar'],
          ['soon', 'Muddati yaqin'],
          ['overdue', 'Kechikkan chaqiruvlar'],
        ].map(([segment, label]) => (
          <Link
            key={segment}
            to="/kabinet/$role"
            params={{ role: workspace.slug }}
            search={{ segment: segment as 'unassigned' | 'soon' | 'overdue' }}
            aria-current={search.segment === segment ? 'true' : undefined}
            onClick={() => setDrawer(false)}
          >
            {label}
          </Link>
        ))}
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
    <div className="mt-theme mt-live">
      <a href="#workspace-content" className="mt-skip">
        Asosiy mazmunga o‘tish
      </a>
      <aside className="mt-sidebar">
        <Link
          to="/kabinet/$role"
          params={{ role: workspace.slug }}
          search={{}}
          className="mt-brand"
        >
          <span>
            <HeartPulse size={29} aria-hidden="true" />
          </span>
          <strong>MedicineTrack</strong>
        </Link>
        {navigation}
        <div className="mt-sidebar-bottom">
          <div className="mt-territory">
            <span>
              <ShieldCheck size={16} aria-hidden="true" />
              Ishchi kabinet
            </span>
            <strong>{workspace.label}</strong>
          </div>
          {logout}
        </div>
      </aside>
      <div className="mt-workspace">
        <header className="mt-topbar">
          <button
            type="button"
            className="mt-button mt-button-quiet mt-icon-button mt-menu-trigger"
            aria-label="Menyuni ochish"
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
          <div className="mt-topbar-location">
            <Building2 size={18} aria-hidden="true" />
            <span>{workspace.title}</span>
          </div>
          <div className="flex items-center gap-3"><NotificationBell/><div className="mt-profile">
            <span className="mt-avatar" aria-hidden="true">
              {initials}
            </span>
            <div>
              <strong>{fullName}</strong>
              <span>{workspace.label}</span>
            </div>
          </div></div>
        </header>
        <main id="workspace-content" tabIndex={-1} className="mt-main">
          {error && (
            <p
              className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {error}
            </p>
          )}
          <Outlet />
          <footer className="mt-page-footer">
            <p>
              <ShieldCheck size={14} aria-hidden="true" />
              Bemor kuzatuvi
            </p>
            <p>Vaqtlar Toshkent vaqtida</p>
          </footer>
        </main>
      </div>
      {drawer && (
        <Dialog title="MedicineTrack" close={() => setDrawer(false)} drawer>
          {navigation}
          <div className="mt-drawer-bottom">
            <span>{fullName}</span>
            {logout}
          </div>
        </Dialog>
      )}
    </div>
  )
}

export function SessionError({ reset }: { reset: () => void }) {
  const router = useRouter()
  return (
    <div className="mt-theme">
      <main className="mx-auto max-w-xl space-y-4 px-5 py-12">
        <h1 className="text-2xl font-semibold">Kabinet ochilmadi</h1>
        <p className="text-muted" role="alert">
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
