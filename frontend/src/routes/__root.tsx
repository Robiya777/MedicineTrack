import { createRootRoute, redirect } from '@tanstack/react-router'
import { restoreSession } from '@/api/session'
import { NotFoundPage, RootLayout } from '@/components/root-layout'

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    const pathname = location.pathname.replace(/\/$/, '')
    if (pathname === '/login' || pathname === '/faollashtirish') return
    const user = await restoreSession().catch(() => null)
    if (!user) throw redirect({ to: '/login', search: {}, replace: true })
  },
  component: RootLayout,
  notFoundComponent: NotFoundPage,
})
