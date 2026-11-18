import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useSessionStore } from '@/state/session'
export const Route = createFileRoute('/(app)/kabinet/$role/dorilar/$patientId')(
  {
    beforeLoad: ({ params }) => {
      const u = useSessionStore.getState().user
      if (u?.role === 'PATIENT' && u.patient !== params.patientId)
        throw redirect({
          to: '/kabinet/$role',
          params: { role: params.role },
          search: {},
        })
    },
    component: Outlet,
  },
)
