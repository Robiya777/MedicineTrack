import { PatientDashboard } from '../../../../../features/messaging/conversations'
import { workspaces } from '../../../../../lib/workspaces'
import { useSessionStore } from '../../../../../state/session'
import { TaskDashboard } from '../../../../../features/tasks/task-list'
import { HospitalDashboard } from './hospital-dashboard'

export function WorkspacePage() {
  const user = useSessionStore((state) => state.user)
  if (!user) return null
  if (user.role === 'PATIENT' && user.patient) return <PatientDashboard />
  if (user.role === 'HOSPITAL') return <HospitalDashboard />
  if (user.role === 'COORDINATOR' || user.role === 'DOCTOR') {
    return <TaskDashboard key={user.role} coordinator={user.role === 'COORDINATOR'} />
  }

  const workspace = workspaces[user.role]
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ')
  return (
    <section aria-labelledby="workspace-title">
      <h1 id="workspace-title" className="text-3xl font-semibold tracking-tight">{workspace.title}</h1>
      <dl className="mt-6 grid max-w-lg gap-4 mt-card p-5 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-sm text-muted">Akkaunt</dt>
          <dd className="mt-1 font-medium wrap-break-word">{fullName || user.username}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Rol</dt>
          <dd className="mt-1 font-medium">{workspace.label}</dd>
        </div>
      </dl>
    </section>
  )
}
