import { z } from 'zod'

const date = z.iso.datetime({ offset: true })
export const itemInput = z.object({
  name: z.string(),
  prescribed_dose_text: z.string(),
  route: z.string(),
  instructions: z.string(),
  source_reference: z.string(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  timezone: z.string(),
  local_times: z.array(z.string()),
  schedule_type: z.literal('FIXED_TIMES'),
  needs_clarification: z.boolean(),
  clarification_reason: z.string(),
})
const draftText = z.string().nullable().transform((value) => value ?? '')
const item = itemInput.extend({
  name: draftText,
  prescribed_dose_text: draftText,
  route: draftText,
  id: z.uuid(),
  missing_fields: z.array(z.string()),
})
export const planSchema = z.object({
  id: z.uuid(),
  patient: z.uuid(),
  discharge: z.uuid(),
  series_id: z.uuid(),
  version: z.number(),
  lock_version: z.number(),
  status: z.enum(['DRAFT', 'ACTIVE', 'STOPPED', 'COMPLETED']),
  items: z.array(item),
  approved_at: date.nullable(),
  supersedes: z.uuid().nullable(),
  stop_reason: z.string(),
  created_at: date,
})
const values = z.object({
  result: z.enum(['TAKEN', 'SKIPPED']),
  reported_taken_at: date.nullable(),
  client_recorded_at: date,
  note: z.string(),
})
export const recordSchema = values.extend({
  id: z.uuid(),
  version: z.number(),
  patient_reported: z.boolean(),
  server_received_at: date,
  late_recorded: z.boolean(),
  recorded_against_inactive_plan: z.boolean(),
  original: values,
  corrections: z.array(
    values.extend({
      id: z.uuid(),
      version: z.number(),
      reason: z.string(),
      created_at: date,
    }),
  ),
})
export const occurrence = z.object({
  id: z.uuid(),
  item_details: item,
  plan_id: z.uuid(),
  plan_version: z.number(),
  plan_status: z.string(),
  scheduled_at: date,
  cancelled_at: date.nullable(),
  status: z.enum([
    'UPCOMING',
    'UNRECORDED',
    'CANCELLED',
    'TAKEN',
    'SKIPPED',
    'NOT_AVAILABLE',
  ]),
  record: recordSchema.nullable().optional(),
})
export type Plan = z.infer<typeof planSchema>
export type ItemInput = z.infer<typeof itemInput>
export type Occurrence = z.infer<typeof occurrence>
export type RecordInput = z.infer<typeof values> & { plan_version: number }
