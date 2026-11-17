export type PreviewStatus = 'UNASSIGNED' | 'NEW' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED'
export type PreviewSegment = 'all' | 'unassigned' | 'soon' | 'overdue' | 'completed' | 'cancelled'
export type PreviewTask = {
  id: string
  shortId: string
  patient: string
  age: number
  doctorId: string | null
  facilityId: string
  status: PreviewStatus
  dueAt: number
  dischargedAt: number
  completedAt: number | null
}

export const previewDoctors = [
  { id: 'rahimova', name: 'Dilnoza Rahimova', initials: 'DR' },
  { id: 'karimov', name: 'Aziz Karimov', initials: 'AK' },
  { id: 'usmonova', name: 'Madina Usmonova', initials: 'MU' },
]
export const previewFacilities = [
  { id: 'clinic-12', name: '12-oilaviy poliklinika' },
  { id: 'clinic-18', name: '18-oilaviy poliklinika' },
  { id: 'clinic-central', name: 'Markaziy oilaviy poliklinika' },
]

export const statusLabels: Record<PreviewStatus, string> = {
  UNASSIGNED: 'Mas’ulsiz',
  NEW: 'Yangi',
  ACCEPTED: 'Qabul qilingan',
  COMPLETED: 'Bajarilgan',
  CANCELLED: 'Bekor qilingan',
}

export const segments: { id: PreviewSegment; label: string }[] = [
  { id: 'all', label: 'Barchasi' },
  { id: 'unassigned', label: 'Mas’ulsiz' },
  { id: 'soon', label: 'Muddati yaqin' },
  { id: 'overdue', label: 'Kechikkan' },
  { id: 'completed', label: 'Bajarilgan' },
  { id: 'cancelled', label: 'Bekor qilingan' },
]

export function createPreviewTasks(now: number): PreviewTask[] {
  const entries: [string, number, PreviewStatus, number][] = [
    ['Saida Ismoilova', 64, 'ACCEPTED', -95],
    ['Anvar Abdullayev', 58, 'NEW', -35],
    ['Malika Ahmedova', 61, 'UNASSIGNED', 42],
    ['Rustam Qodirov', 47, 'ACCEPTED', 85],
    ['Dilbar Tursunova', 55, 'NEW', 140],
    ['Otabek Rasulov', 48, 'NEW', 195],
    ['Zulfiya Mirzayeva', 68, 'UNASSIGNED', 330],
    ['Shavkat Olimov', 52, 'ACCEPTED', 460],
    ['Nargiza Saidova', 39, 'NEW', 510],
    ['Bahrom Ergashev', 63, 'UNASSIGNED', 620],
    ['Gulnora Sobirova', 57, 'ACCEPTED', 730],
    ['Akmal Yo‘ldoshev', 45, 'NEW', 890],
    ['Farida Rahmonova', 66, 'NEW', 1020],
    ['Jamshid Usmonov', 43, 'ACCEPTED', 1150],
    ['Mavluda Karimova', 59, 'COMPLETED', -20],
    ['Sherzod Nabiyev', 51, 'COMPLETED', 120],
    ['Shoira Xoliqova', 62, 'COMPLETED', 180],
    ['Azamat Sodiqov', 46, 'COMPLETED', 240],
    ['Lola G‘aniyeva', 54, 'COMPLETED', 300],
    ['Dilshod Nosirov', 49, 'COMPLETED', 120],
    ['Nasiba Hamidova', 60, 'COMPLETED', 180],
    ['Sardor Bekmurodov', 38, 'COMPLETED', 240],
    ['Munira Aliyeva', 56, 'CANCELLED', 500],
    ['Ulug‘bek Islomov', 44, 'CANCELLED', 360],
  ]
  return entries.map(([patient, age, status, minutes], index) => {
    const dueAt = now + minutes * 60_000
    return {
      id: '48b9a710-e3c4-4a6d-8f21-' + String(index + 1048).padStart(12, '0'),
      shortId: 'CH-' + String(index + 1048),
      patient,
      age,
      status,
      doctorId: status === 'UNASSIGNED' ? null : previewDoctors[index % previewDoctors.length].id,
      facilityId: previewFacilities[index % previewFacilities.length].id,
      dueAt,
      dischargedAt: dueAt - 24 * 3_600_000,
      completedAt: status === 'COMPLETED' ? Math.min(now, dueAt + (index === 14 ? 45 : -90) * 60_000) : null,
    }
  })
}

export function isOpen(task: PreviewTask) {
  return ['UNASSIGNED', 'NEW', 'ACCEPTED'].includes(task.status)
}

export function isOverdue(task: PreviewTask, now: number) {
  return isOpen(task) && task.dueAt < now
}

export function matchesSegment(task: PreviewTask, segment: PreviewSegment, now: number) {
  switch (segment) {
    case 'all': return true
    case 'unassigned': return task.status === 'UNASSIGNED'
    case 'soon': return isOpen(task) && task.dueAt >= now && task.dueAt <= now + 4 * 3_600_000
    case 'overdue': return isOverdue(task, now)
    case 'completed': return task.status === 'COMPLETED'
    case 'cancelled': return task.status === 'CANCELLED'
  }
}

const months = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
const dateParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tashkent', day: '2-digit', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

export function previewDate(value: number, full = false) {
  const parts = Object.fromEntries(dateParts.formatToParts(value).map((part) => [part.type, part.value]))
  const day = Number(parts.day) + ' ' + months[Number(parts.month) - 1]
  return full ? day + ', ' + parts.year : day + ', ' + parts.hour + ':' + parts.minute
}

export function timeRemaining(task: PreviewTask, now: number) {
  if (task.status === 'COMPLETED') return task.completedAt! <= task.dueAt ? 'O‘z vaqtida bajarilgan' : 'Kech bajarilgan'
  if (task.status === 'CANCELLED') return 'Kuzatuv bekor qilingan'
  const minutes = Math.max(1, Math.ceil(Math.abs(task.dueAt - now) / 60_000))
  const hours = Math.floor(minutes / 60)
  const duration = (hours ? hours + ' soat ' : '') + (minutes % 60 ? minutes % 60 + ' daq' : '')
  return duration.trim() + (task.dueAt < now ? ' kechikkan' : ' qoldi')
}

export function initials(name: string) {
  return name.split(' ').slice(0, 2).map((part) => part[0]).join('')
}
