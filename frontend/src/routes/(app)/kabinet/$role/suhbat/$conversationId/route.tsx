import { createFileRoute, Outlet } from '@tanstack/react-router'
export const Route = createFileRoute(
  '/(app)/kabinet/$role/suhbat/$conversationId',
)({ component: Outlet })
