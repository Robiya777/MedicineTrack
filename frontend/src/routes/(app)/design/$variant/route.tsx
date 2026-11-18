import { createFileRoute, Outlet, notFound } from '@tanstack/react-router'
import { isVariantId } from '@/routes/(app)/design/-components/catalog'

export const Route = createFileRoute('/(app)/design/$variant')({
  beforeLoad: ({ params }) => {
    if (!isVariantId(params.variant)) throw notFound()
    return { designVariant: params.variant }
  },
  component: Outlet,
})
