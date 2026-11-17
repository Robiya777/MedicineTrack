import { createFileRoute, Outlet, notFound } from '@tanstack/react-router'
import { isVariantId } from '../-components/catalog'

export const Route = createFileRoute('/(app)/design/$variant')({
  beforeLoad: ({ params }) => {
    if (!isVariantId(params.variant)) throw notFound()
    return { designVariant: params.variant }
  },
  component: Outlet,
})
