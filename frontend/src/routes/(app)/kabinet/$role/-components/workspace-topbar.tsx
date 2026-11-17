import { Building2, Menu } from 'lucide-react'
import { NotificationBell } from '../../../../../components/notification-bell'
import { Avatar } from '../../../../../components/ui'
import type { WorkspaceConfig } from '../../../../../lib/workspaces'

export interface WorkspaceTopbarProps {
  workspace: WorkspaceConfig
  fullName: string
  drawerOpen: boolean
  onOpenDrawer: () => void
}

export function WorkspaceTopbar({
  workspace,
  fullName,
  drawerOpen,
  onOpenDrawer,
}: WorkspaceTopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-surface/80 px-6 backdrop-blur-md">
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink md:hidden hover:bg-page cursor-pointer"
        aria-label="Menyuni ochish"
        aria-expanded={drawerOpen}
        onClick={onOpenDrawer}
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
          <Avatar name={fullName} size="sm" />
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
  )
}
