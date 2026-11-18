import { Navigate, Outlet, getRouteApi, useRouter } from '@tanstack/react-router'
import { LogOut, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { getWorkspace } from '@/lib/workspaces'
import { Dialog, secondaryButton } from '@/components/ui'
import { useSessionStore } from '@/state/session'
import { useLogout } from '@/hooks/use-logout'
import { useDoctorPresence } from '@/hooks/use-doctor-presence'
import { WorkspaceNavigation } from './workspace-navigation'
import { WorkspaceSidebar } from './workspace-sidebar'
import { WorkspaceTopbar } from './workspace-topbar'

const workspaceRoute = getRouteApi('/(app)/kabinet/$role')

export function WorkspaceLayout() {
  useDoctorPresence()
  const user = useSessionStore((state) => state.user)
  const search = workspaceRoute.useSearch()
  const [drawer, setDrawer] = useState(false)
  const { handleLogout, pending, error } = useLogout()

  if (!user) {
    return pending ? null : (
      <Navigate to="/login" search={{ expired: true }} replace />
    )
  }

  const workspace = getWorkspace(user)
  const fullName =
    [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username

  return (
    <div className="min-h-screen bg-page font-sans text-ink">
      <a
        href="#workspace-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-md focus:outline-primary"
      >
        Asosiy mazmunga o‘tish
      </a>

      {/* Desktop Sidebar */}
      <WorkspaceSidebar
        role={user.role}
        workspace={workspace}
        segment={search.segment}
        pendingLogout={pending}
        onLogout={() => void handleLogout()}
      />

      {/* Main Content Area */}
      <div className="min-h-screen md:pl-64 flex flex-col">
        <WorkspaceTopbar
          workspace={workspace}
          fullName={fullName}
          drawerOpen={drawer}
          onOpenDrawer={() => setDrawer(true)}
        />

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
            <WorkspaceNavigation
              role={user.role}
              workspace={workspace}
              segment={search.segment}
              onNavigate={() => setDrawer(false)}
            />
            <div className="border-t border-line pt-4 space-y-3">
              <span className="block text-xs font-bold text-ink">{fullName}</span>
              <button
                type="button"
                className={secondaryButton}
                onClick={() => void handleLogout()}
                disabled={pending}
              >
                <LogOut size={17} aria-hidden="true" />
                {pending ? 'Chiqilmoqda…' : 'Chiqish'}
              </button>
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
