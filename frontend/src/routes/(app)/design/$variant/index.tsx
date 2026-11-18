import { createFileRoute, redirect } from '@tanstack/react-router'
import { variants } from '@/routes/(app)/design/-components/catalog'

export const Route = createFileRoute('/(app)/design/$variant/')({
  beforeLoad: ({ context }) => {
    throw redirect({
      to: '/design/$variant/$screen',
      params: { variant: context.designVariant, screen: variants[context.designVariant].startScreen },
      replace: true,
    })
  },
})
