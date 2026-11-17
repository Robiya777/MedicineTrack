import { createFileRoute, Outlet, notFound, redirect } from '@tanstack/react-router'
import { isScreenId } from '@/routes/(app)/design/-components/catalog'

export const Route = createFileRoute('/(app)/design/$variant/$screen')({
  beforeLoad: ({ params, context }) => {
    if (context.designVariant === 'medicinetrack' && params.screen !== 'queue') {
      throw redirect({ to: '/design/$variant/$screen', params: { variant: 'medicinetrack', screen: 'queue' }, replace: true })
    }
    if (!isScreenId(params.screen)) throw notFound()
    return { designScreen: params.screen }
  },
  component: Outlet,
})
