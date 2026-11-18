import type { Discharge, HospitalTask } from '@/api/hospital'

export {
  formatTashkentDateTime,
  parseTashkentInput,
  tashkentInputValue,
} from '@/lib/date'

export const dischargeStatusLabels: Record<Discharge['status'], string> = {
  DRAFT: 'Loyiha',
  CONFIRMED: 'Tasdiqlangan',
}

export const taskStatusLabels: Record<HospitalTask['status'], string> = {
  UNASSIGNED: 'Mas’ul biriktirilmagan',
  NEW: 'Yangi',
  ACCEPTED: 'Qabul qilingan',
  COMPLETED: 'Bajarilgan',
  CANCELLED: 'Bekor qilingan',
}
