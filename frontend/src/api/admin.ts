import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { apiClient } from '@/api/client'
import { createPaginatedResponseSchema } from '@/api/types'
export const roles = ['ADMIN', 'DOCTOR', 'COORDINATOR'] as const
export const accountSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  role: z.enum(roles),
  organization: z.uuid().nullable(),
  is_active: z.boolean(),
  can_approve_medication_schedule: z.boolean(),
})
export const organizationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: z.enum(['HOSPITAL', 'CLINIC']),
  territory: z.uuid(),
  active: z.boolean(),
})
export const territorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  parent: z.uuid().nullable(),
})
export type Account = z.infer<typeof accountSchema>
export type Organization = z.infer<typeof organizationSchema>
export type Territory = z.infer<typeof territorySchema>
export type AccountInput = Omit<Account, 'id'> & { password?: string }
export type OrganizationInput = Omit<Organization, 'id'>
export type TerritoryInput = Omit<Territory, 'id'>
export const adminKeys = ['admin'] as const
function listQuery<T extends z.ZodType>(path: string, schema: T) {
  return queryOptions({
    queryKey: [...adminKeys, path],
    queryFn: async ({ signal }) => {
      const rows: z.infer<T>[] = []
      for (let page = 1; ; page++) {
        const data = createPaginatedResponseSchema(schema).parse(
          (
            await apiClient.get(path, {
              signal,
              params: { page, page_size: 100 },
            })
          ).data,
        )
        rows.push(...data.results)
        if (!data.next) return rows
      }
    },
    retry: false,
  })
}
export const accountsQuery = () =>
  listQuery('/reference/accounts', accountSchema)
export const adminOrganizationsQuery = () =>
  listQuery('/reference/organizations', organizationSchema)
export const adminTerritoriesQuery = () =>
  listQuery('/reference/territories', territorySchema)
async function save<T extends z.ZodType>(
  path: string,
  schema: T,
  input: unknown,
  id: string | undefined,
  key: string,
) {
  const config = { headers: { 'Idempotency-Key': key } }
  return schema.parse(
    (id
      ? await apiClient.patch(`${path}/${id}`, input, config)
      : await apiClient.post(path, input, config)
    ).data,
  )
}
export const saveAccount = (
  input: AccountInput,
  id: string | undefined,
  key: string,
) => save('/reference/accounts', accountSchema, input, id, key)
export const saveOrganization = (
  input: OrganizationInput,
  id: string | undefined,
  key: string,
) => save('/reference/organizations', organizationSchema, input, id, key)
export const saveTerritory = (
  input: TerritoryInput,
  id: string | undefined,
  key: string,
) => save('/reference/territories', territorySchema, input, id, key)
