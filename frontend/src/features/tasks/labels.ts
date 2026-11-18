import type { CareTask } from '@/api/tasks'

export const taskStatusLabels: Record<CareTask['status'], string> = {
  UNASSIGNED: 'Mas’ul biriktirilmagan',
  NEW: 'Yangi',
  ACCEPTED: 'Qabul qilingan',
  COMPLETED: 'Bajarilgan',
  CANCELLED: 'Bekor qilingan',
}

export const channelLabels = { PHONE: 'Telefon', HOME_VISIT: 'Uyga tashrif' }
export const contactResultLabels = {
  CONTACTED: 'Bog‘lanildi',
  NO_ANSWER: 'Javob bo‘lmadi',
  WRONG_NUMBER: 'Noto‘g‘ri raqam',
  ADDRESS_NOT_FOUND: 'Manzil topilmadi',
  REFUSED: 'Rad etdi',
}

export const eventLabels: Record<string, string> = {
  TASK_CREATED: 'Chaqiruv yaratildi',
  TASK_ACCEPTED: 'Shifokor qabul qildi',
  TASK_REASSIGNED: 'Shifokor qayta tayinlandi',
  CONTACT_ATTEMPT_RECORDED: 'Aloqa urinishi qayd etildi',
  TASK_COMPLETED: 'Natija yuborildi',
  TASK_CANCELLED: 'Chaqiruv bekor qilindi',
  REPORT_CORRECTED: 'Natijaga tuzatish qo‘shildi',
  DISCHARGE_DRAFT_CREATED: 'Chiqarish loyihasi yaratildi',
  DISCHARGE_DRAFT_UPDATED: 'Chiqarish loyihasi tahrirlandi',
}

export function taskIsOpen(task: CareTask) {
  return ['UNASSIGNED', 'NEW', 'ACCEPTED'].includes(task.status)
}

