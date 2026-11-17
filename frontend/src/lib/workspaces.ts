import type { UserRole } from '../state/session'

export const workspaces = {
  HOSPITAL: { slug: 'statsionar', title: 'Statsionar kabineti', label: 'Statsionar xodimi' },
  COORDINATOR: { slug: 'koordinator', title: 'Koordinator kabineti', label: 'Koordinator' },
  DOCTOR: { slug: 'shifokor', title: 'Shifokor kabineti', label: 'Oilaviy shifokor' },
  PATIENT: { slug: 'bemor', title: 'Bemor kabineti', label: 'Bemor' },
  ADMIN: { slug: 'admin', title: 'Texnik kabinet', label: 'Texnik administrator' },
} as const satisfies Record<UserRole, { slug: string; title: string; label: string }>

export type WorkspaceConfig = typeof workspaces[keyof typeof workspaces]
