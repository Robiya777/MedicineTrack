import { createFileRoute, redirect } from '@tanstack/react-router'
import { restoreSession } from '../../../../api/session'
import { workspaces } from '../../../../components/workspaces'
import { SessionError, WorkspaceLayout } from './-components/workspace-layout'

export const Route = createFileRoute('/(app)/kabinet/$role')({
  beforeLoad: async ({ params }) => {
    const user = await restoreSession()
    if (!user) throw redirect({ to: '/login', search: {}, replace: true })

    const { slug } = workspaces[user.role]
    if (params.role !== slug) {
      throw redirect({ to: '/kabinet/$role', params: { role: slug }, replace: true })
    }
  },
  component: WorkspaceLayout,
  errorComponent: SessionError,
})
