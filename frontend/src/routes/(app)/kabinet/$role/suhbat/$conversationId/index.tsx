import { createFileRoute } from '@tanstack/react-router'
import { ConversationPage } from '@/features/messaging/conversations'
export const Route = createFileRoute(
  '/(app)/kabinet/$role/suhbat/$conversationId/',
)({ component: ConversationPage })
