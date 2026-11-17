import { createFileRoute, Outlet, notFound } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/design')({
  beforeLoad: () => {
    if (!import.meta.env.DEV && import.meta.env.VITE_ENABLE_DESIGN_PREVIEW !== 'true') {
      throw notFound()
    }
  },
  component: Outlet,
})
