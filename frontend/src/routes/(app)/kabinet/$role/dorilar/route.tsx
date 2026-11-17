import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/(app)/kabinet/$role/dorilar')({
  beforeLoad: ({ params }) => {
    if (!['bemor', 'shifokor', 'statsionar'].includes(params.role))
      throw redirect({
        to: '/kabinet/$role',
        params: { role: params.role },
        search: {},
      })
  },
  component: Outlet,
})
