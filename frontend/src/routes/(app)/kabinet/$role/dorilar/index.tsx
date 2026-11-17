import { createFileRoute } from '@tanstack/react-router'
import { MedicationEntry } from '../../../../../features/medications/entry'
export const Route = createFileRoute('/(app)/kabinet/$role/dorilar/')({
  component: MedicationEntry,
})
