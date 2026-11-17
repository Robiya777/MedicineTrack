import { Link } from '@tanstack/react-router'
import { HeartPulse, LogOut, ShieldCheck } from 'lucide-react'
import type { UserRole } from '../../../../../state/session'
import type { WorkspaceConfig } from '../../../../../lib/workspaces'
import { secondaryButton } from '../../../../../components/ui'
import { WorkspaceNavigation } from './workspace-navigation'

export interface WorkspaceSidebarProps {
  role: UserRole
  workspace: WorkspaceConfig
  segment?: string
  pendingLogout: boolean
  onLogout: () => void
}

export function WorkspaceSidebar({
  role,
  workspace,
  segment,
  pendingLogout,
  onLogout,
}: WorkspaceSidebarProps) {
  return (
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
        <WorkspaceNavigation
          role={role}
          workspace={workspace}
          segment={segment}
        />
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
        <button
          type="button"
          className={secondaryButton}
          onClick={onLogout}
          disabled={pendingLogout}
        >
          <LogOut size={17} aria-hidden="true" />
          {pendingLogout ? 'Chiqilmoqda…' : 'Chiqish'}
        </button>
      </div>
    </aside>
  )
}
