import { Link, useLocation } from '@tanstack/react-router'
import { LayoutDashboard } from 'lucide-react'
import type { UserRole } from '@/state/session'
import type { WorkspaceConfig } from '@/lib/workspaces'

export interface WorkspaceNavigationProps {
  role: UserRole
  workspace: WorkspaceConfig
  segment?: string
  onNavigate?: () => void
}

export function WorkspaceNavigation({
  role,
  workspace,
  segment,
  onNavigate,
}: WorkspaceNavigationProps) {
  const pathname = useLocation({ select: (location) => location.pathname })
  const home = '/kabinet/' + workspace.slug

  const navLinkClass = (isActive: boolean) =>
    `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition cursor-pointer ${
      isActive
        ? 'bg-mint text-primary-hover font-semibold'
        : 'text-muted hover:bg-page hover:text-ink'
    }`

  const isHomeActive =
    pathname.replace(/\/$/, '') === home &&
    (!segment || segment === 'all' || segment === 'open')

  return (
    <nav className="flex flex-col gap-1.5" aria-label="Kabinet menyusi">
      <Link
        to="/kabinet/$role"
        params={{ role: workspace.slug }}
        search={{}}
        className={navLinkClass(isHomeActive)}
        aria-current={isHomeActive ? 'page' : undefined}
        onClick={onNavigate}
      >
        <LayoutDashboard size={19} aria-hidden="true" />
        <span>{role === 'HOSPITAL' ? 'Chiqarishlar' : 'Ish stoli'}</span>
      </Link>

      {['PATIENT', 'DOCTOR', 'HOSPITAL'].includes(role) && (
        <Link
          to="/kabinet/$role/dorilar"
          params={{ role: workspace.slug }}
          search={{}}
          className={navLinkClass(pathname.includes('/dorilar'))}
          aria-current={pathname.includes('/dorilar') ? 'page' : undefined}
          onClick={onNavigate}
        >
          Dori jadvali
        </Link>
      )}

      {['PATIENT', 'DOCTOR'].includes(role) && (
        <Link
          to="/kabinet/$role/suhbat"
          params={{ role: workspace.slug }}
          search={{}}
          className={navLinkClass(pathname.includes('/suhbat'))}
          aria-current={pathname.includes('/suhbat') ? 'page' : undefined}
          onClick={onNavigate}
        >
          Suhbatlar
        </Link>
      )}

      {role === 'COORDINATOR' && (
        <>
          <Link
            to="/kabinet/$role/ish-jadvali"
            params={{ role: workspace.slug }}
            search={{}}
            className={navLinkClass(pathname.includes('/ish-jadvali'))}
            aria-current={pathname.includes('/ish-jadvali') ? 'page' : undefined}
            onClick={onNavigate}
          >
            Ish jadvali
          </Link>
          <Link
            to="/kabinet/$role/murojaatlar"
            params={{ role: workspace.slug }}
            search={{}}
            className={navLinkClass(pathname.includes('/murojaatlar'))}
            aria-current={pathname.includes('/murojaatlar') ? 'page' : undefined}
            onClick={onNavigate}
          >
            Javobsiz murojaatlar
          </Link>
          {[
            ['unassigned', 'Mas’ulsiz chaqiruvlar'],
            ['soon', 'Muddati yaqin'],
            ['overdue', 'Kechikkan chaqiruvlar'],
          ].map(([itemSegment, label]) => {
            const active = segment === itemSegment
            return (
              <Link
                key={itemSegment}
                to="/kabinet/$role"
                params={{ role: workspace.slug }}
                search={{ segment: itemSegment as 'unassigned' | 'soon' | 'overdue' }}
                className={navLinkClass(active)}
                aria-current={active ? 'true' : undefined}
                onClick={onNavigate}
              >
                {label}
              </Link>
            )
          })}
        </>
      )}
    </nav>
  )
}
