import { z } from 'zod'
import { apiClient } from '@/api/client'
import { isoDateTimeSchema } from '@/api/types'
export const correctionSchema = z.object({
  id: z.uuid(),
  field: z.string(),
  correction_text: z.string(),
  reason: z.string(),
  actor: z.uuid().nullable(),
  created_at: isoDateTimeSchema,
})
export type Correction = z.infer<typeof correctionSchema>
export type CorrectionInput = {
  field: string
  correction_text: string
  reason: string
}
export async function addCorrection(
  kind: 'discharge' | 'report',
  id: string,
  input: CorrectionInput,
  key: string,
) {
  const path =
    kind === 'discharge'
      ? `/discharges/${id}/corrections`
      : `/tasks/${id}/report-corrections`
  return correctionSchema.parse(
    (await apiClient.post(path, input, { headers: { 'Idempotency-Key': key } }))
      .data,
  )
}
export async function updatePatientContact(
  id: string,
  input: {
    address: string
    contact: string
    contact_is_representative: boolean
    no_phone_reason: string
  },
  key: string,
) {
  await apiClient.patch(`/patients/${id}`, input, {
    headers: { 'Idempotency-Key': key },
  })
}
