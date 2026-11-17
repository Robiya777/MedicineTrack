import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/kabinet/$role/chaqiruv')({
  beforeLoad: ({ params }) => {
    if (!['koordinator', 'shifokor'].includes(params.role)) {
      throw redirect({ to: '/kabinet/$role', params: { role: params.role }, replace: true })
    }
  },
  component: Outlet,
})
