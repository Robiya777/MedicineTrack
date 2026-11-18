import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { apiClient } from './client'
import { occurrence, planSchema, recordSchema, type ItemInput, type Occurrence, type Plan, type RecordInput } from './medication-schemas'
export { itemInput, occurrence, planSchema } from './medication-schemas'
export type { ItemInput, Occurrence, Plan, RecordInput } from './medication-schemas'
const date = z.iso.datetime({ offset: true })
const keys = ['medications'] as const
export { keys as medicationKeys }
async function pages<T extends z.ZodType>(
  path: string,
  schema: T,
  signal: AbortSignal,
  params: Record<string, string | number> = {},
) {
  const rows: z.infer<T>[] = []
  for (let page = 1; ; page++) {
    const response = await apiClient.get(path, {
      signal,
      params: { ...params, page, page_size: 100 },
    })
    const data = z
      .object({
        results: z.array(schema),
        next: z.string().nullable(),
        server_time: date,
      })
      .parse(response.data)
    rows.push(...data.results)
    const serverTime = data.server_time
    if (!data.next) return { rows, serverTime }
  }
}
export function plansQuery(patient: string) {
  return queryOptions({
    queryKey: [...keys, 'plans', patient],
    queryFn: ({ signal }) =>
      pages(`/patients/${patient}/medication-plans`, planSchema, signal),
    retry: false,
    refetchInterval: 30000,
  })
}
export function planQuery(id: string) {
  return queryOptions({
    queryKey: [...keys, 'plan', id],
    queryFn: async ({ signal }) =>
      planSchema.parse(
        (await apiClient.get(`/medication-plans/${id}`, { signal })).data,
      ),
    retry: false,
  })
}
export function occurrencesQuery(plan: Plan, day: string) {
  return queryOptions({
    queryKey: [...keys, 'occurrences', plan.id, plan.version, day],
    queryFn: ({ signal }) =>
      pages(`/medication-plans/${plan.id}/occurrences`, occurrence, signal, {
        plan_version: plan.version,
        ...(day ? { date_from: day, date_to: day } : {}),
      }),
    retry: false,
    refetchInterval: 30000,
  })
}
export function historyQuery(patient: string, day: string) {
  return queryOptions({
    queryKey: [...keys, 'history', patient, day],
    queryFn: ({ signal }) =>
      pages(
        `/patients/${patient}/medication-history`,
        occurrence,
        signal,
        day ? { date_from: day, date_to: day } : {},
      ),
    retry: false,
    refetchInterval: 30000,
  })
}
export async function createPlan(
  patient: string,
  discharge: string,
  items: ItemInput[],
  key: string,
) {
  return planSchema.parse(
    (
      await apiClient.post(
        `/patients/${patient}/medication-plans`,
        { discharge_id: discharge, items },
        { headers: { 'Idempotency-Key': key } },
      )
    ).data,
  )
}
export async function changePlan(
  plan: Plan,
  action: 'edit' | 'approve' | 'revisions' | 'stop',
  input: { items?: ItemInput[]; reason?: string },
  key: string,
) {
  const payload = {
      version: plan.version,
      lock_version: plan.lock_version,
      ...input,
    },
    config = { headers: { 'Idempotency-Key': key } }
  const response =
    action === 'edit'
      ? await apiClient.patch(`/medication-plans/${plan.id}`, payload, config)
      : await apiClient.post(
          `/medication-plans/${plan.id}/${action}`,
          payload,
          config,
        )
  return planSchema.parse(response.data)
}
export async function saveRecord(
  item: Occurrence,
  input: RecordInput,
  reason: string | undefined,
  key: string,
) {
  const response = item.record
    ? await apiClient.post(
        `/dose-records/${item.record.id}/corrections`,
        { ...input, version: item.record.version, reason },
        { headers: { 'Idempotency-Key': key } },
      )
    : await apiClient.post(`/dose-occurrences/${item.id}/record`, input, {
        headers: { 'Idempotency-Key': key },
      })
  return recordSchema.parse(response.data)
}
