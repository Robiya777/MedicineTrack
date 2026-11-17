import { z } from 'zod'

export const isoDateTimeSchema = z.iso.datetime({ offset: true })
export const isoDateSchema = z.iso.date()

export const patientSnapshotSchema = z.object({
  full_name: z.string().optional(),
  address: z.string().optional(),
  contact: z.string().optional(),
  no_phone_reason: z.string().optional(),
  contact_is_representative: z.boolean().optional(),
})

export type PatientSnapshot = z.infer<typeof patientSnapshotSchema>

export const taskStatusSchema = z.enum([
  'UNASSIGNED',
  'NEW',
  'ACCEPTED',
  'COMPLETED',
  'CANCELLED',
])

export type TaskStatus = z.infer<typeof taskStatusSchema>

export function createPaginatedResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    count: z.number(),
    previous: z.string().nullable(),
    next: z.string().nullable(),
    results: z.array(itemSchema),
  })
}

export type PaginatedResponse<T> = {
  count: number
  previous: string | null
  next: string | null
  results: T[]
}
