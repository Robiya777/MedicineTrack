import { createFileRoute, Outlet, notFound } from '@tanstack/react-router'
import { isScreenId } from '../../-components/catalog'

export const Route = createFileRoute('/(app)/design/$variant/$screen')({
  beforeLoad: ({ params }) => {
    if (!isScreenId(params.screen)) throw notFound()
    return { designScreen: params.screen }
  },
  component: Outlet,
})
