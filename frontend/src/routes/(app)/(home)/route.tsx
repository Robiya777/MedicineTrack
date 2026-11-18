import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { restoreSession } from '@/api/session'
import { workspaces } from '@/lib/workspaces'

export const Route = createFileRoute('/(app)/(home)')({
  beforeLoad: async () => {
    const user = await restoreSession()
    if (user) throw redirect({ to: '/kabinet/$role', params: { role: workspaces[user.role].slug }, replace: true })
  },
  component: Outlet,
})
