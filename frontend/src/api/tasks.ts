import {correctionSchema} from '@/api/corrections'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { apiClient } from './client'
import {
  createPaginatedResponseSchema,
  isoDateTimeSchema,
  patientSnapshotSchema,
  taskStatusSchema,
} from './types'

export const channelSchema = z.enum(['PHONE', 'HOME_VISIT'])
export const contactResultSchema = z.enum([
  'CONTACTED',
  'NO_ANSWER',
  'WRONG_NUMBER',
  'ADDRESS_NOT_FOUND',
  'REFUSED',
])

export const taskSchema = z.object({
  corrections: z.array(correctionSchema).default([]),
  id: z.uuid(),
  discharge: z.uuid(),
  patient: patientSnapshotSchema,
  assigned_doctor: z.uuid().nullable(),
  status: taskStatusSchema,
  due_at: isoDateTimeSchema,
  overdue: z.boolean(),
})

export type HospitalTask = z.infer<typeof taskSchema>

const reportSchema = z.object({
  author: z.uuid(),
  performed_at: isoDateTimeSchema,
  channel: channelSchema,
  observation: z.string(),
  actions: z.string(),
  follow_up: z.string(),
})

export const careTaskSchema = taskSchema.extend({
  patient: taskSchema.shape.patient.extend({
    id: z.uuid().optional(),
    birth_date: z.string().optional(),
  }),
  receiving_org: z.uuid().nullable(),
  discharged_at: isoDateTimeSchema,
  recommendations: z.string(),
  accepted_at: isoDateTimeSchema.nullable(),
  completed_at: isoDateTimeSchema.nullable(),
  version: z.number().int().positive(),
  late_documented: z.boolean(),
  report: reportSchema.nullish(),
  contact_attempts: z.array(
    z.object({
      id: z.uuid(),
      channel: channelSchema,
      result: contactResultSchema,
      attempted_at: isoDateTimeSchema,
      note: z.string(),
      next_action: z.string(),
      created_at: isoDateTimeSchema,
    }),
  ),
  timeline: z.array(
    z.object({
      id: z.uuid(),
      action: z.string(),
      actor: z.uuid().nullable(),
      created_at: isoDateTimeSchema,
    }),
  ),
  cancellation_note: z.string(),
  cancellation_code: z.string(),
  cancelled_at: isoDateTimeSchema.nullable(),
})

export const doctorSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  organization: z.uuid().nullable(),
  is_active: z.boolean(),
})

export type CareTask = z.infer<typeof careTaskSchema>
export type Doctor = z.infer<typeof doctorSchema>
export type TaskSegment =
  | 'all'
  | 'open'
  | 'unassigned'
  | 'soon'
  | 'overdue'
  | 'COMPLETED'
  | 'CANCELLED'
export type TaskFilters = {
  segment: TaskSegment
  doctorId: string
  organizationId: string
}

async function fetchAll<T extends z.ZodType>(
  path: string,
  schema: T,
  signal: AbortSignal,
  params: Record<string, string> = {},
) {
  const results: z.infer<T>[] = []
  for (let page = 1; ; page += 1) {
    const { data } = await apiClient.get(path, {
      signal,
      params: { ...params, page, page_size: 100 },
    })
    const response = createPaginatedResponseSchema(schema).parse(data)
    results.push(...response.results)
    if (!response.next) return results
  }
}

export const taskKeys = {
  lists: ['care', 'tasks'] as const,
  detail: (id: string) => ['care', 'task', id] as const,
  metrics: ['care', 'metrics'] as const,
}

export function taskListQuery(filters: TaskFilters, page: number) {
  return queryOptions({
    queryKey: [...taskKeys.lists, filters, page],
    refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      const params: Record<string, string> = {}
      if (filters.doctorId) params.doctor_id = filters.doctorId
      if (filters.organizationId) params.organization_id = filters.organizationId
      if (filters.segment === 'overdue') params.overdue = 'true'
      if (filters.segment === 'unassigned') params.status = 'UNASSIGNED'
      if (filters.segment === 'COMPLETED' || filters.segment === 'CANCELLED') {
        params.status = filters.segment
      }

      if (filters.segment === 'open' || filters.segment === 'soon') {
        if (filters.segment === 'soon') {
          params.due_before = new Date(Date.now() + 4 * 3_600_000).toISOString()
          params.overdue = 'false'
        }
        // The API supports one status per request. Merge every matching page before paginating.
        const groups = await Promise.all(
          ['UNASSIGNED', 'NEW', 'ACCEPTED'].map((status) =>
            fetchAll('/tasks', careTaskSchema, signal, { ...params, status }),
          ),
        )
        const byId = new Map<string, CareTask>()
        for (const task of groups.flat()) {
          const previous = byId.get(task.id)
          if (!previous || previous.version < task.version) byId.set(task.id, task)
        }
        const matching = [...byId.values()].sort(
          (a, b) =>
            Date.parse(a.due_at) - Date.parse(b.due_at) || a.id.localeCompare(b.id),
        )
        return {
          results: matching.slice((page - 1) * 20, page * 20),
          count: matching.length,
          hasNext: page * 20 < matching.length,
          hasPrevious: page > 1,
        }
      }

      const { data } = await apiClient.get('/tasks', {
        signal,
        params: { ...params, page },
      })
      const result = createPaginatedResponseSchema(careTaskSchema).parse(data)
      return {
        ...result,
        hasNext: Boolean(result.next),
        hasPrevious: Boolean(result.previous),
      }
    },
  })
}

export function taskDetailQuery(id: string) {
  return queryOptions({
    queryKey: taskKeys.detail(id),
    retry: false,
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get(`/tasks/${id}`, { signal })
      return careTaskSchema.parse(data)
    },
  })
}

export function doctorsQuery() {
  return queryOptions({
    queryKey: ['care', 'doctors'],
    queryFn: ({ signal }) => fetchAll('/reference/doctors', doctorSchema, signal),
  })
}

export function organizationsQuery() {
  return queryOptions({
    queryKey: ['care', 'organizations'],
    queryFn: ({ signal }) =>
      fetchAll(
        '/reference/organizations',
        z.object({
          id: z.uuid(),
          name: z.string(),
          active: z.boolean(),
        }),
        signal,
      ),
  })
}

export function metricsQuery() {
  return queryOptions({
    queryKey: taskKeys.metrics,
    refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get('/dashboard/metrics', { signal })
      return z
        .object({
          active: z.number(),
          overdue: z.number(),
          unassigned: z.number(),
          completed_on_time: z.number(),
          assessed: z.number(),
          sla_percent: z.number().nullable(),
          cancelled: z.number(),
          late_documented: z.number(),
        })
        .parse(data)
    },
  })
}

export function doctorName(doctor: Doctor) {
  return (
    [doctor.first_name, doctor.last_name].filter(Boolean).join(' ') ||
    doctor.username
  )
}

export type TaskCommand =
  | { action: 'accept'; version: number }
  | { action: 'reassign'; version: number; doctor_id: string; reason: string }
  | { action: 'cancel'; version: number; reason_code: string; reason: string }
  | {
      action: 'contact-attempts'
      version: number
      channel: z.infer<typeof channelSchema>
      result: z.infer<typeof contactResultSchema>
      attempted_at: string
      note: string
      next_action: string
    }
  | {
      action: 'complete'
      version: number
      performed_at: string
      channel: z.infer<typeof channelSchema>
      observation: string
      actions: string
      follow_up: string
    }

export async function sendTaskCommand(
  id: string,
  command: TaskCommand,
  key: string,
) {
  const { action, ...input } = command
  const { data } = await apiClient.post(`/tasks/${id}/${action}`, input, {
    headers: { 'Idempotency-Key': key },
  })
  return careTaskSchema.parse(data)
}
