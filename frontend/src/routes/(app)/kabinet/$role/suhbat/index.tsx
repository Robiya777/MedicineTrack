import { createFileRoute } from '@tanstack/react-router'
import { ConversationList } from '@/features/messaging/conversations'
export const Route = createFileRoute('/(app)/kabinet/$role/suhbat/')({
  component: ConversationList,
})
