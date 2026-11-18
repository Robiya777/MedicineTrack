import { createFileRoute, redirect } from '@tanstack/react-router'
import { workspaceSearch } from '@/lib/workspace-search'
import { restoreSession } from '@/api/session'
import { getWorkspace } from '@/lib/workspaces'
import { SessionError, WorkspaceLayout } from './-components/workspace-layout'

export const Route = createFileRoute('/(app)/kabinet/$role')({
  validateSearch: (search) => workspaceSearch.parse(search),
  beforeLoad: async ({ params, location }) => {
    const user = await restoreSession()
    if (!user) throw redirect({ to: '/login', search: {}, replace: true })

    const { slug } = getWorkspace(user)
    if (params.role === 'statsionar' && user.role === 'COORDINATOR') {
      throw redirect({href: location.href.replace('/kabinet/statsionar', '/kabinet/koordinator'), replace:true})
    }
    if (params.role !== slug) {
      throw redirect({
        to: '/kabinet/$role',
        params: { role: slug },
        replace: true,
      })
    }
  },
  component: WorkspaceLayout,
  errorComponent: SessionError,
})
