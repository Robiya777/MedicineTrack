import type { Discharge, HospitalTask } from '../../api/hospital'

const tashkentDateTime = new Intl.DateTimeFormat('uz-Latn-UZ', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Tashkent',
})

export function formatTashkentDateTime(value: string) {
  return tashkentDateTime.format(new Date(value))
}

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
