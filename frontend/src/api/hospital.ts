import { queryOptions } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { z } from 'zod'
import { apiClient } from './client'

const dateTime = z.iso.datetime({ offset: true })
export const dischargeStatuses = ['DRAFT', 'CONFIRMED'] as const

const patientSchema = z.object({
  id: z.uuid(),
  full_name: z.string(),
  birth_date: z.iso.date(),
  address: z.string(),
  territory: z.uuid(),
  contact: z.string(),
  contact_is_representative: z.boolean(),
  no_phone_reason: z.string(),
})

const dischargeSchema = z.object({
  id: z.uuid(),
  patient: z.uuid(),
  discharged_at: dateTime,
  confirmed_at: dateTime.nullable(),
  recommendations: z.string(),
  follow_up_reason: z.string(),
  status: z.enum(dischargeStatuses),
  patient_snapshot: z.object({
    full_name: z.string().optional(),
    address: z.string().optional(),
    contact: z.string().optional(),
    no_phone_reason: z.string().optional(),
    contact_is_representative: z.boolean().optional(),
  }),
})

const taskSchema = z.object({
  id: z.uuid(),
  discharge: z.uuid(),
  assigned_doctor: z.uuid().nullable(),
  status: z.enum(['UNASSIGNED', 'NEW', 'ACCEPTED', 'COMPLETED', 'CANCELLED']),
  due_at: dateTime,
  overdue: z.boolean(),
})

const doctorSchema = z.object({
  username: z.string(),
  first_name: z.string(),
  last_name: z.string(),
})

function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    count: z.number(),
    previous: z.string().nullable(),
    next: z.string().nullable(),
    results: z.array(item),
  })
}

export type Discharge = z.infer<typeof dischargeSchema>
export type HospitalPatient = z.infer<typeof patientSchema>
export type HospitalTask = z.infer<typeof taskSchema>

export const hospitalQueryKeys = {
  discharges: ['hospital', 'discharges'] as const,
  discharge: (id: string) => ['hospital', 'discharge', id] as const,
  dischargeTask: (id: string) => ['hospital', 'task-by-discharge', id] as const,
}

export function dischargePageQuery(page: number) {
  return queryOptions({
    queryKey: [...hospitalQueryKeys.discharges, page],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get('/discharges', { params: { page }, signal })
      return pageSchema(dischargeSchema).parse(data)
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
        const { data } = await apiClient.get(`/reference/doctors/${id}`, { signal })
        const doctor = doctorSchema.parse(data)
        return [doctor.first_name, doctor.last_name].filter(Boolean).join(' ') || doctor.username
      } catch (error) {
        if (isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0)) return null
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
          params: { discharged_from: dischargedAt, discharged_to: dischargedAt, page },
        })
        const { results, next } = pageSchema(taskSchema).parse(data)
        const task = results.find((item) => item.discharge === discharge.id)
        if (task || !next) return task ?? null
      }
    },
  })
}

export function hospitalErrorMessage(error: unknown) {
  if (!isAxiosError(error)) return 'Server javobini o‘qib bo‘lmadi. Qayta urinib ko‘ring.'
  const status = error.response?.status
  if (status === 403) return 'Bu amal uchun ruxsatingiz yo‘q.'
  if (status === 404) return 'Yozuv topilmadi yoki uni ko‘rish uchun ruxsatingiz yo‘q.'
  if (status === 429) return 'So‘rovlar ko‘payib ketdi. Birozdan keyin qayta urinib ko‘ring.'
  if (status && status < 500 && typeof error.response?.data?.message === 'string') {
    return error.response.data.message as string
  }
  return 'Backendga ulanib bo‘lmadi. Qayta urinib ko‘ring.'
}
