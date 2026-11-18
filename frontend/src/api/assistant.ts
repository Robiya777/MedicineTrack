import { queryOptions } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { z } from 'zod'
import { apiClient } from './client'

const date = z.iso.datetime({ offset: true })
const locationSchema = z.object({
  latitude: z.number(), longitude: z.number(), accuracy_m: z.number().nullable(),
  source: z.enum(['DEVICE', 'DEMO']), recorded_at: date, shared_at: date,
  consented: z.literal(true), map_url: z.url(),
})
export const emergencySchema = z.object({
  id: z.uuid(), reference: z.string(), state: z.literal('DEMO_SIMULATED'),
  demo: z.literal(true), emergency_number: z.literal('103'), patient: z.uuid(),
  patient_name: z.string(), contact: z.string(), registered_address: z.string(),
  conversation: z.uuid(), risk: z.literal('EMERGENCY'),
  reasons: z.array(z.object({ code: z.string(), label: z.string() })),
  location: locationSchema.nullable(), notice: z.string(), acknowledged_at: date.nullable(),
  created_at: date, events: z.array(z.object({ id: z.uuid(), kind: z.string(), detail: z.string(), created_at: date })),
})
export const assessmentSchema = z.object({
  id: z.uuid(), risk: z.enum(['EMERGENCY', 'DOCTOR_REVIEW', 'SELF_MONITOR', 'NEEDS_INFO']),
  reply: z.string(), reasons: z.array(z.object({ code: z.string(), label: z.string() })),
  question: z.object({ key: z.string().optional(), text: z.string().optional(), choices: z.array(z.string()).optional() }),
  mode: z.literal('DEMO'), engine_version: z.string(), emergency: emergencySchema.nullable(),
  disclaimer: z.string(), created_at: date,
})
const configSchema = z.object({
  enabled: z.boolean(), mode: z.enum(['DEMO', 'DISABLED']), external_model: z.literal(false),
  real_dispatch: z.literal(false), country: z.literal('UZ'), emergency_number: z.literal('103'),
})
export type Assessment = z.infer<typeof assessmentSchema>
export type Emergency = z.infer<typeof emergencySchema>
export type LocationInput = { consent: true; source: 'DEMO' } | {
  consent: true; source: 'DEVICE'; latitude: string; longitude: string; accuracy_m: number; recorded_at: string
}
export const assistantKeys = { all: ['assistant'] as const }
export function assistantConfigQuery() {
  return queryOptions({
    queryKey: ['assistant', 'config'], retry: false, staleTime: 60_000,
    queryFn: async ({ signal }) => {
      try { return configSchema.parse((await apiClient.get('/assistant/config', { signal })).data) }
      catch (error) {
        if (isAxiosError(error) && error.response?.status === 404) return null
        throw error
      }
    },
  })
}
export function emergenciesQuery(page: number) {
  return queryOptions({
    queryKey: ['assistant', 'emergencies', page], retry: false, refetchInterval: 10_000,
    queryFn: async ({ signal }) => z.object({
      count: z.number(), next: z.string().nullable(), previous: z.string().nullable(), results: z.array(emergencySchema),
    }).parse((await apiClient.get('/assistant/emergencies', { signal, params: { page, page_size: 10 } })).data),
  })
}
export async function shareEmergencyLocation(id: string, input: LocationInput, key: string) {
  return emergencySchema.parse((await apiClient.post(`/assistant/emergencies/${id}/location`, input, { headers: { 'Idempotency-Key': key } })).data)
}
export async function acknowledgeEmergency(id: string, key: string) {
  return emergencySchema.parse((await apiClient.post(`/assistant/emergencies/${id}/acknowledge`, {}, { headers: { 'Idempotency-Key': key } })).data)
}
