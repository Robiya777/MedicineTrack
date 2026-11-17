import { createFileRoute, notFound, Outlet } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute('/(app)/kabinet/$role/chiqarish/$dischargeId')({
  beforeLoad: ({ params }) => {
    if (!z.uuid().safeParse(params.dischargeId).success) throw notFound()
  },
  component: Outlet,
})
