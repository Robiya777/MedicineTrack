import { createFileRoute } from '@tanstack/react-router'
import { NewDischargePage } from './-components/new-discharge-page'

export const Route = createFileRoute('/(app)/kabinet/$role/chiqarish/yangi/')({
  component: NewDischargePage,
})
