import { createFileRoute } from '@tanstack/react-router'
import { WorkspacePage } from './-components/workspace-page'

export const Route = createFileRoute('/(app)/kabinet/$role/')({
  component: WorkspacePage,
})
