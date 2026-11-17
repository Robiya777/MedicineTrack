import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/kabinet/$role/chaqiruv/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/kabinet/$role', params: { role: params.role }, replace: true })
  },
})
