import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { restoreSession } from '@/api/session'
import { workspaces } from '@/lib/workspaces'

export const Route = createFileRoute('/(auth)/login')({
  validateSearch: (search: Record<string, unknown>): { expired?: true } => (
    search.expired === true ? { expired: true } : {}
  ),
  beforeLoad: async () => {
    const user = await restoreSession().catch(() => null)
    if (user) {
      throw redirect({ to: '/kabinet/$role', params: { role: workspaces[user.role].slug } })
    }
  },
  component: Outlet,
})
