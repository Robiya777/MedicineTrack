import { createFileRoute } from '@tanstack/react-router'
import { DischargeDetail } from './-components/discharge-detail'

export const Route = createFileRoute('/(app)/kabinet/$role/chiqarish/$dischargeId/')({
  component: DischargeDetail,
})
