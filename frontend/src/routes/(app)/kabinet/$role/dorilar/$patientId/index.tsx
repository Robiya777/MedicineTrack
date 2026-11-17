import { createFileRoute } from '@tanstack/react-router'
import { MedicationPage } from '../../../../../../features/medications/patient-medications'
export const Route = createFileRoute(
  '/(app)/kabinet/$role/dorilar/$patientId/',
)({ component: MedicationPage })
