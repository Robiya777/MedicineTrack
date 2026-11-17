import { createFileRoute } from '@tanstack/react-router'
import { SchedulePage } from '../../../../../features/messaging/coordinator'
export const Route = createFileRoute('/(app)/kabinet/$role/ish-jadvali/')({
  component: SchedulePage,
})
