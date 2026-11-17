import { createFileRoute, notFound, Outlet } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute('/(app)/kabinet/$role/chaqiruv/$taskId')({
  beforeLoad: ({ params }) => {
    if (!z.uuid().safeParse(params.taskId).success) throw notFound()
  },
  component: Outlet,
})
