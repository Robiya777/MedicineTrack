const tashkentDateTime = new Intl.DateTimeFormat('uz-Latn-UZ', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Asia/Tashkent',
})

export function formatTashkentDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return tashkentDateTime.format(date)
}

const tashkentInput = new Intl.DateTimeFormat('sv-SE', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'Asia/Tashkent',
})

export function tashkentInputValue(date: Date): string {
  return tashkentInput.format(date).replace(' ', 'T')
}

export function parseTashkentInput(value: string): Date {
  // O'zbekistonning doimiy UTC+05:00 vaqt mintaqasi formati
  return new Date(value + '+05:00')
}
