import { queryOptions } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { z } from 'zod'
import { apiClient } from './client'
import { taskSchema, type HospitalTask } from './tasks'
import {
  createPaginatedResponseSchema,
  isoDateSchema,
  isoDateTimeSchema,
  patientSnapshotSchema,
} from './types'
import { extractApiErrorMessage } from '@/lib/errors'

export const dischargeStatuses = ['DRAFT', 'CONFIRMED'] as const

const patientSchema = z.object({
  id: z.uuid(),
  full_name: z.string(),
  birth_date: isoDateSchema,
  address: z.string(),
  territory: z.uuid(),
  contact: z.string(),
  contact_is_representative: z.boolean(),
  no_phone_reason: z.string(),
})

const dischargeSchema = z.object({
  id: z.uuid(),
  patient: z.uuid(),
  discharged_at: isoDateTimeSchema,
  confirmed_at: isoDateTimeSchema.nullable(),
  recommendations: z.string(),
  follow_up_reason: z.string(),
  status: z.enum(dischargeStatuses),
  patient_snapshot: patientSnapshotSchema,
})

const doctorSummarySchema = z.object({
  username: z.string(),
  first_name: z.string(),
  last_name: z.string(),
})

export type Discharge = z.infer<typeof dischargeSchema>
export type HospitalPatient = z.infer<typeof patientSchema>
export { type HospitalTask, taskSchema }
export type PatientInput = Omit<HospitalPatient, 'id'>
export type DischargeInput = Pick<
  Discharge,
  'discharged_at' | 'recommendations' | 'follow_up_reason'
>

export const hospitalQueryKeys = {
  discharges: ['hospital', 'discharges'] as const,
  discharge: (id: string) => ['hospital', 'discharge', id] as const,
  dischargeTask: (id: string) => ['hospital', 'task-by-discharge', id] as const,
}

export function dischargePageQuery(page: number) {
  return queryOptions({
    queryKey: [...hospitalQueryKeys.discharges, page],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get('/discharges', {
        params: { page },
        signal,
      })
      return createPaginatedResponseSchema(dischargeSchema).parse(data)
    },
  })
}

export function dischargeQuery(id: string) {
  return queryOptions({
    queryKey: hospitalQueryKeys.discharge(id),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get(`/discharges/${id}`, { signal })
      return dischargeSchema.parse(data)
    },
  })
}

export function hospitalPatientQuery(id: string) {
  return queryOptions({
    queryKey: ['hospital', 'patient', id],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get(`/patients/${id}`, { signal })
      return patientSchema.parse(data)
    },
  })
}

export function doctorNameQuery(id: string | null) {
  return queryOptions({
    queryKey: ['hospital', 'doctor-name', id],
    enabled: id !== null,
    queryFn: async ({ signal }) => {
      try {
        const { data } = await apiClient.get(`/reference/doctors/${id}`, {
          signal,
        })
        const doctor = doctorSummarySchema.parse(data)
        return (
          [doctor.first_name, doctor.last_name].filter(Boolean).join(' ') ||
          doctor.username
        )
      } catch (error) {
        if (
          isAxiosError(error) &&
          [403, 404].includes(error.response?.status ?? 0)
        )
          return null
        throw error
      }
    },
  })
}

export function dischargeTaskQuery(discharge: Discharge) {
  return queryOptions({
    queryKey: hospitalQueryKeys.dischargeTask(discharge.id),
    enabled: discharge.status === 'CONFIRMED',
    queryFn: async ({ signal }) => {
      // Discharge responses do not expose a task ID. Limit the scoped search to the exact discharge time.
      const dischargedAt = discharge.discharged_at
      for (let page = 1; ; page += 1) {
        const { data } = await apiClient.get('/tasks', {
          signal,
          params: {
            discharged_from: dischargedAt,
            discharged_to: dischargedAt,
            page,
          },
        })
        const { results, next } = createPaginatedResponseSchema(
          taskSchema,
        ).parse(data)
        const task = results.find((item) => item.discharge === discharge.id)
        if (task || !next) return task ?? null
      }
    },
  })
}

export function territoriesQuery() {
  return queryOptions({
    queryKey: ['hospital', 'territories'],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get('/reference/territories', {
        signal,
      })
      return createPaginatedResponseSchema(
        z.object({ id: z.uuid(), name: z.string() }),
      ).parse(data).results
    },
  })
}

export async function createPatient(input: PatientInput, key: string) {
  const { data } = await apiClient.post('/patients', input, {
    headers: { 'Idempotency-Key': key },
  })
  return patientSchema.parse(data)
}

export async function saveDischarge(
  input: DischargeInput,
  resource: { patient: string } | { id: string },
  key: string,
) {
  const headers = { 'Idempotency-Key': key }
  const { data } =
    'id' in resource
      ? await apiClient.patch(`/discharges/${resource.id}`, input, { headers })
      : await apiClient.post(
          '/discharges',
          { ...input, patient: resource.patient },
          { headers },
        )
  return dischargeSchema.parse(data)
}

export async function confirmDischarge(id: string, key: string) {
  const { data } = await apiClient.post(
    `/discharges/${id}/confirm`,
    {},
    {
      headers: { 'Idempotency-Key': key },
    },
  )
  return taskSchema.parse(data)
}

export function hospitalErrorMessage(error: unknown) {
  return extractApiErrorMessage(error)
}
