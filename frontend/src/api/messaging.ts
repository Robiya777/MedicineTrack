import axios, { isAxiosError } from 'axios'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { apiClient } from './client'
import { assessmentSchema } from './assistant'
const date = z.iso.datetime({ offset: true })
export const intervalSchema = z.object({ start: z.string(), end: z.string() })
export const scheduleInputSchema = z.object({
  version: z.number().int().min(0),
  timezone: z.string().min(1),
  shifts: z.array(
    intervalSchema.extend({ weekday: z.number().int().min(0).max(6) }),
  ),
  exceptions: z.record(z.string(), z.array(intervalSchema)),
})
const snapshot = scheduleInputSchema.extend({
  id: z.uuid(),
  version: z.number(),
})
export const teamDoctorSchema = z.object({ id: z.uuid(), name: z.string(), online: z.boolean(), primary: z.boolean() })
export const conversationSchema = z.object({
  id: z.uuid(),
  patient: z.uuid(),
  doctor: z.uuid().nullable(),
  status: z.enum(['OPEN', 'CLOSED']),
  response_due_at: date.nullable(),
  first_unanswered_at: date.nullable(),
  work_schedule: z.union([snapshot, z.object({}).strict()]),
  response_policy: z.string(),
  created_at: date,
  patient_name: z.string(),
  team: z.array(teamDoctorSchema),
  can_manage_team: z.boolean(),
  assistant_enabled: z.boolean().default(false),
})
const messageSchema = z.object({
  id: z.uuid(),
  conversation: z.uuid(),
  sender: z.uuid(),
  text: z.string(),
  sent_at: date,
  read_at: date.nullable(),
  kind: z.string(),
  delivery_status: z.enum(['SENT', 'READ', 'ANSWERED']),
  answered_at: date.nullable(),
  assistant: assessmentSchema.nullable().optional(),
  assistant_status: z.enum(['WAITING', 'REPLIED', 'CANCELLED']).nullable(),
  assistant_due_at: date.nullable(),
  sender_name: z.string(),
  sender_role: z.enum(['DOCTOR', 'PATIENT']),
})
export const states = {
  IMPROVED: 'Yaxshilandi',
  UNCHANGED: 'O‘zgarmadi',
  WORSENED: 'Yomonlashdi',
} as const
export const statusInputSchema = z.object({
  self_reported_state: z.enum(['IMPROVED', 'UNCHANGED', 'WORSENED']),
  note: z.string().trim().min(1).max(4000),
  observed_at: date,
})
const statusSchema = statusInputSchema.extend({
  id: z.uuid(),
  conversation: z.uuid(),
  message: z.uuid(),
  received_at: date,
  patient_reported: z.boolean(),
})
export type Conversation = z.infer<typeof conversationSchema>
export type ScheduleInput = z.infer<typeof scheduleInputSchema>
export type StatusInput = z.infer<typeof statusInputSchema>
function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    count: z.number(),
    next: z.string().nullable(),
    previous: z.string().nullable(),
    results: z.array(item),
  })
}
// Follow numeric pages on the same endpoint, never a server-supplied next URL.
async function allPages<T extends z.ZodType>(
  path: string,
  schema: T,
  signal: AbortSignal,
) {
  const rows: z.infer<T>[] = []
  for (let page = 1; ; page++) {
    const { data } = await apiClient.get(path, {
      signal,
      params: { page, page_size: 100 },
    })
    const result = pageSchema(schema).parse(data)
    rows.push(...result.results)
    if (!result.next) return rows
  }
}
export const messagingKeys = {
  all: ['messaging'] as const,
  conversations: ['messaging', 'conversations'] as const,
}
export function conversationsQuery() {
  return queryOptions({
    queryKey: messagingKeys.conversations,
    queryFn: ({ signal }) =>
      allPages('/conversations', conversationSchema, signal),
    refetchInterval: 5000,
    retry: false,
  })
}
export function conversationQuery(id: string) {
  return queryOptions({
    queryKey: ['messaging', 'conversation', id],
    queryFn: async ({ signal }) =>
      conversationSchema.parse(
        (await apiClient.get(`/conversations/${id}`, { signal })).data,
      ),
    refetchInterval: 5000,
    retry: false,
  })
}
export function messagesQuery(id: string) {
  return queryOptions({
    queryKey: ['messaging', 'messages', id],
    queryFn: ({ signal }) =>
      allPages(`/conversations/${id}/messages`, messageSchema, signal),
    refetchInterval: 2000,
    retry: false,
  })
}
export function statusesQuery(id: string) {
  return queryOptions({
    queryKey: ['messaging', 'statuses', id],
    queryFn: ({ signal }) =>
      allPages(`/conversations/${id}/status-updates`, statusSchema, signal),
    refetchInterval: 15000,
    retry: false,
  })
}
export async function sendMessage(id: string, text: string, key: string, responseTo?: string) {
  return messageSchema.parse(
    (
      await apiClient.post(
        `/conversations/${id}/messages`,
        { text, ...(responseTo ? { assistant_response_to: responseTo } : {}) },
        { headers: { 'Idempotency-Key': key } },
      )
    ).data,
  )
}
export async function sendStatus(id: string, input: StatusInput, key: string) {
  return statusSchema.parse(
    (
      await apiClient.post(`/conversations/${id}/status-updates`, input, {
        headers: { 'Idempotency-Key': key },
      })
    ).data,
  )
}
export async function markRead(id: string) {
  await apiClient.post(
    `/conversations/${id}/read`,
    {},
    { headers: { 'Idempotency-Key': crypto.randomUUID() } },
  )
}
export function scheduleQuery(id: string) {
  return queryOptions({
    queryKey: ['messaging', 'schedule', id],
    queryFn: async ({ signal }) => {
      try {
        return scheduleInputSchema
          .extend({ version: z.number() })
          .parse(
            (await apiClient.get(`/doctors/${id}/work-schedule`, { signal }))
              .data,
          )
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 404) return null
        throw error
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
  })
}
export async function saveSchedule(
  id: string,
  input: ScheduleInput,
  key: string,
) {
  return scheduleInputSchema
    .extend({ version: z.number() })
    .parse(
      (
        await apiClient.put(`/doctors/${id}/work-schedule`, input, {
          headers: { 'Idempotency-Key': key },
        })
      ).data,
    )
}
const unansweredSchema = z.object({
  episode_id: z.uuid(),
  conversation_id: z.uuid(),
  patient_id: z.uuid(),
  doctor_id: z.uuid().nullable(),
  first_unanswered_at: date,
  response_due_at: date.nullable(),
  overdue: z.boolean(),
  schedule_missing: z.boolean(),
  priority: z.enum(['WORSENED', 'NORMAL']),
})
export function unansweredQuery() {
  return queryOptions({
    queryKey: ['messaging', 'unanswered'],
    queryFn: ({ signal }) =>
      allPages('/dashboard/unanswered', unansweredSchema, signal),
    refetchInterval: 15000,
    retry: false,
  })
}
export async function issueActivation(id: string) {
  return z
    .object({ patient_id: z.uuid(), code: z.string(), expires_at: date })
    .parse(
      (
        await apiClient.post(`/patients/${id}/activation`, {
          phone_verified: true,
        })
      ).data,
    )
}
export async function activatePatient(input: {
  patient_id: string
  code: string
  password: string
}) {
  const { data } = await axios.post('/api/v1/auth/patient-activate', input, {
    timeout: 10000,
  })
  return z.object({ username: z.string() }).parse(data)
}
