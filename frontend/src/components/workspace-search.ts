import { z } from 'zod'

// Individual invalid URL values fall back to the default queue.
export const workspaceSearch = z.object({
  segment: z
    .enum([
      'all',
      'open',
      'unassigned',
      'soon',
      'overdue',
      'COMPLETED',
      'CANCELLED',
    ])
    .optional()
    .catch(undefined),
  doctorId: z.uuid().optional().catch(undefined),
  organizationId: z.uuid().optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
})
