import { createFileRoute } from '@tanstack/react-router'
import { UnansweredPage } from '@/features/messaging/coordinator'
export const Route = createFileRoute('/(app)/kabinet/$role/murojaatlar/')({
  component: UnansweredPage,
})
