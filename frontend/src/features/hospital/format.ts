import type { Discharge, HospitalTask } from '../../api/hospital'

const tashkentDateTime = new Intl.DateTimeFormat('uz-Latn-UZ', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
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

const tashkentInput = new Intl.DateTimeFormat('sv-SE', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'Asia/Tashkent',
})

export function tashkentInputValue(date: Date) {
  return tashkentInput.format(date).replace(' ', 'T')
}

export function parseTashkentInput(value: string) {
  // The current local discharge workflow uses Uzbekistan's fixed UTC+05:00 offset.
  return new Date(value + '+05:00')
}
