import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { MedicationPage } from '@/features/medications/patient-medications'
export const Route = createFileRoute(
  '/(app)/kabinet/$role/dorilar/$patientId/',
)({ validateSearch: (value: Record<string, unknown>): {dischargeId?: string} => {const id=z.uuid().safeParse(value.dischargeId);return id.success?{dischargeId:id.data}:{}}, component: MedicationPage })
