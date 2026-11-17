import { createRootRoute } from '@tanstack/react-router'
import { NotFoundPage, RootLayout } from '@/components/root-layout'

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
})
