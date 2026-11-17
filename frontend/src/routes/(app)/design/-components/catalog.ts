export const variants = {
  medicinetrack: {
    name: 'MedicineTrack',
    description: 'Kelishilgan teal va mint yo‘nalishi. Koordinator preview.',
    startScreen: 'queue',
  },
  clinical: {
    name: 'Klinik kabinet',
    description: 'Yon menyu va keng klinik jadvallar.',
    startScreen: 'queue',
  },
  operations: {
    name: 'Navbat markazi',
    description: 'Ixcham navbat va yonma-yon tafsilot.',
    startScreen: 'queue',
  },
  portal: {
    name: 'Bemor portali',
    description: 'Yuqori navigatsiya va yirik xizmat kartalari.',
    startScreen: 'patient-home',
  },
  night: {
    name: 'Qorong‘i panel',
    description: 'To‘q fon, katta KPI va muddatga urg‘u.',
    startScreen: 'queue',
  },
  guided: {
    name: 'Qadamli ish oqimi',
    description: 'Bosqichli formalar va tasdiqlash xulosasi.',
    startScreen: 'new-discharge',
  },
} as const

export type VariantId = keyof typeof variants
export const variantIds = Object.keys(variants) as VariantId[]

export const roles = {
  access: { name: 'Kirish', defaultScreen: 'login' },
  hospital: { name: 'Statsionar', defaultScreen: 'discharges' },
  coordinator: { name: 'Koordinator', defaultScreen: 'queue' },
  doctor: { name: 'Oilaviy shifokor', defaultScreen: 'doctor-tasks' },
  patient: { name: 'Bemor', defaultScreen: 'patient-home' },
  admin: { name: 'Texnik admin', defaultScreen: 'admin' },
} as const

export type Role = keyof typeof roles
export const roleIds = Object.keys(roles) as Role[]

export const screens = {
  login: { role: 'access', name: 'Kirish' },
  activation: { role: 'access', name: 'Kod bilan faollashtirish' },
  discharges: { role: 'hospital', name: 'Chiqarishlar' },
  patients: { role: 'hospital', name: 'Bemor qidiruvi' },
  'new-patient': { role: 'hospital', name: 'Yangi bemor' },
  'new-discharge': { role: 'hospital', name: 'Chiqarish formasi' },
  'ai-review': { role: 'hospital', name: 'Epikriz va AI' },
  'confirm-discharge': { role: 'hospital', name: 'Chiqarish xulosasi' },
  'hospital-task': { role: 'hospital', name: 'Chaqiruv tafsiloti' },
  'draft-medication': { role: 'hospital', name: 'Dori jadvalini kiritish' },
  queue: { role: 'coordinator', name: 'Chaqiruv navbati' },
  'coordinator-task': { role: 'coordinator', name: 'Chaqiruv tarixi' },
  unanswered: { role: 'coordinator', name: 'Javobsiz xabarlar' },
  'work-schedule': { role: 'coordinator', name: 'Ish jadvali' },
  'doctor-tasks': { role: 'doctor', name: 'Mening chaqiruvlarim' },
  'doctor-task': { role: 'doctor', name: 'Chaqiruv tafsiloti' },
  'contact-attempt': { role: 'doctor', name: 'Aloqa urinishi' },
  'visit-report': { role: 'doctor', name: 'Natijani yuborish' },
  'doctor-chat': { role: 'doctor', name: 'Bemor bilan suhbat' },
  'medication-review': { role: 'doctor', name: 'Dori jadvalini tasdiqlash' },
  'doctor-history': { role: 'doctor', name: 'Dori qabul tarixi' },
  'patient-home': { role: 'patient', name: 'Bemor kabineti' },
  'patient-chat': { role: 'patient', name: 'Shifokorga yozish' },
  'status-update': { role: 'patient', name: 'Holat yuborish' },
  medications: { role: 'patient', name: 'Bugungi dorilar' },
  'dose-history': { role: 'patient', name: 'Qabul tarixi' },
  admin: { role: 'admin', name: 'Texnik boshqaruv' },
} as const satisfies Record<string, { role: Role; name: string }>

export type ScreenId = keyof typeof screens
export const screenIds = Object.keys(screens) as ScreenId[]

export function isVariantId(id: string): id is VariantId {
  return Object.hasOwn(variants, id)
}

export function isScreenId(id: string): id is ScreenId {
  return Object.hasOwn(screens, id)
}

export function options(values: readonly string[]) {
  return values.map((value) => ({ value, label: value }))
}
