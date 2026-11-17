import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/(app)/kabinet/$role/murojaatlar')({
  beforeLoad: ({ params }) => {
    if (params.role !== 'koordinator')
      throw redirect({
        to: '/kabinet/$role',
        params: { role: params.role },
        search: {},
      })
  },
  component: Outlet,
})
