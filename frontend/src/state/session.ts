import { create } from 'zustand'

export type UserRole = 'COORDINATOR' | 'DOCTOR' | 'PATIENT' | 'ADMIN'

export type SessionUser = {
  id: string
  username: string
  first_name: string
  last_name: string
  role: UserRole
  organization: string | null
  patient: string | null
  can_approve_medication_schedule: boolean
}

type SessionState = {
  accessToken: string | null
  user: SessionUser | null
  checked: boolean
  revision: number
}

export const useSessionStore = create<SessionState>()(() => ({
  accessToken: null,
  user: null,
  checked: false,
  revision: 0,
}))
