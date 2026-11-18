import { isAxiosError } from 'axios'

export function extractApiErrorMessage(error: unknown): string {
  if (!isAxiosError(error)) {
    return 'Server javobini o‘qib bo‘lmadi. Qayta urinib ko‘ring.'
  }
  const status = error.response?.status
  if (status === 403) return 'Bu amal uchun ruxsatingiz yo‘q.'
  if (status === 404) return 'Yozuv topilmadi yoki uni ko‘rish uchun ruxsatingiz yo‘q.'
  if (status === 409) return 'Ma’lumot boshqa foydalanuvchi tomonidan yangilangan yoki ziddiyat mavjud.'
  if (status === 429) return 'So‘rovlar ko‘payib ketdi. Birozdan keyin qayta urinib ko‘ring.'
  if (status && status < 500 && typeof error.response?.data?.message === 'string') {
    return error.response.data.message as string
  }
  return 'Backendga ulanib bo‘lmadi. Qayta urinib ko‘ring.'
}

export function responseFieldErrors(error: unknown): Record<string, string> {
  if (!isAxiosError(error)) return {}
  const fields: unknown = error.response?.data?.fields
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {}

  const messages: Record<string, string> = {}
  for (const [field, value] of Object.entries(fields)) {
    const message = Array.isArray(value) ? value.find((item) => typeof item === 'string') : value
    if (typeof message === 'string') messages[field] = message
  }
  return messages
}
