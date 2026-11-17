import { create } from 'zustand'

export const demoTime = '2026-11-17T14:20'
export const facilities = ['Chilonzor oilaviy poliklinikasi', 'Yunusobod oilaviy poliklinikasi'] as const
export const doctors = ['Dilnoza Rahimova', 'Aziz Karimov'] as const

export type Patient = { id: string; name: string; birthDate: string; phone: string; district: string; address: string }
export type TaskStatus = 'UNASSIGNED' | 'NEW' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED'
export type Event = { label: string; detail: string; time: string }
export type Task = {
  id: string; patientId: string; facility: string; doctor: string; due: string; dueAt: string; recommendations: string;
  status: TaskStatus; overdue: boolean; history: Event[];
}

export type Discharge = {
  patientId: string; time: string; reason: string; recommendations: string; confirmed: boolean
}

export type Message = { from: 'patient' | 'doctor'; text: string; time: string }
export type Medication = {
  name: string; dose: string; route: string; time: string; from: string; until: string; source: string
}
export type DoseResult = 'Ichdim' | 'O‘tkazib yubordim'

export type Demo = {
  patients: Patient[]; tasks: Task[]; taskId: string;
  discharge: Discharge; messages: Message[]; statusUpdate: string;
  shift: { start: string; end: string };
  medication: Medication; medicationDraft: Medication | null; doseResult: DoseResult | null;
  notice: string;
}

export const statuses: Record<TaskStatus, string> = {
  UNASSIGNED: 'Mas’ulsiz', NEW: 'Yangi', ACCEPTED: 'Qabul qilingan',
  COMPLETED: 'Bajarilgan', CANCELLED: 'Bekor qilingan',
}

function initialDemo(): Demo {
  return {
    patients: [
      { id: 'B-001', name: 'Malika Ahmedova', birthDate: '1965-06-14', phone: '', district: 'Chilonzor', address: 'Demo ko‘cha, 12-uy' },
      { id: 'B-002', name: 'Otabek Rasulov', birthDate: '1978-02-19', phone: '', district: 'Yunusobod', address: 'Demo dahasi, 5-uy' },
      { id: 'B-003', name: 'Saida Yunusova', birthDate: '1958-11-21', phone: '', district: 'Chilonzor', address: 'Demo ko‘cha, 3-uy' },
    ],
    tasks: [
      { id: 'CH-1042', patientId: 'B-001', facility: facilities[0], doctor: '', due: '17 noy, 15:00', dueAt: '2026-11-17T15:00:00+05:00', recommendations: 'Oilaviy shifokor bilan nazorat rejasini kelishish.', status: 'UNASSIGNED', overdue: false, history: [{ label: 'Chaqiruv yaratildi', detail: 'Statsionardan chiqarish tasdiqlandi', time: '16 noy, 15:00' }] },
      { id: 'CH-1041', patientId: 'B-002', facility: facilities[1], doctor: doctors[0], due: '17 noy, 12:00', dueAt: '2026-11-17T12:00:00+05:00', recommendations: 'Oilaviy shifokor bilan nazorat rejasini kelishish.', status: 'ACCEPTED', overdue: true, history: [{ label: 'Chaqiruv qabul qilindi', detail: doctors[0], time: '17 noy, 09:10' }] },
      { id: 'CH-1040', patientId: 'B-003', facility: facilities[0], doctor: doctors[0], due: '18 noy, 09:30', dueAt: '2026-11-18T09:30:00+05:00', recommendations: 'Oilaviy shifokor bilan nazorat rejasini kelishish.', status: 'NEW', overdue: false, history: [{ label: 'Chaqiruv yaratildi', detail: 'Statsionardan chiqarish tasdiqlandi', time: '17 noy, 09:30' }] },
      { id: 'CH-1039', patientId: 'B-001', facility: facilities[0], doctor: doctors[0], due: '16 noy, 13:00', dueAt: '2026-11-16T13:00:00+05:00', recommendations: 'Oilaviy shifokor bilan nazorat rejasini kelishish.', status: 'COMPLETED', overdue: false, history: [{ label: 'Natija yuborildi', detail: 'Telefon orqali bemor holidan xabar olindi.', time: '16 noy, 11:45' }] },
    ],
    taskId: 'CH-1042',
    discharge: { patientId: 'B-001', time: demoTime, reason: 'Chiqarilgandan keyin nazorat', recommendations: 'Oilaviy shifokor bilan reja bo‘yicha bog‘lanish.', confirmed: false },
    messages: [
      { from: 'doctor', text: 'Assalomu alaykum. Holatingiz haqida shu yerda yozishingiz mumkin.', time: '09:10' },
      { from: 'patient', text: 'Assalomu alaykum. Qayta ko‘rik vaqtini bilmoqchi edim.', time: '11:05' },
    ],
    statusUpdate: '',
    shift: { start: '09:00', end: '18:00' },
    medication: { name: 'Demo preparat A', dose: 'Epikrizdagi ko‘rsatma', route: 'Og‘iz orqali', time: '13:00', from: '2026-11-16', until: '2026-11-23', source: 'Demo epikriz · 2-sahifa' },
    medicationDraft: null,
    doseResult: null,
    notice: '',
  }
}

export const useDemo = create<Demo>()(initialDemo)

export function resetDemo() {
  useDemo.setState(initialDemo(), true)
}

export function note(notice: string) {
  useDemo.setState({ notice })
}

export function patientOf(demo: Demo, id: string) {
  return demo.patients.find((patient) => patient.id === id)
}

export function selectTask(taskId: string) {
  useDemo.setState({ taskId, notice: '' })
}

export function recordTask(taskId: string, label: string, detail: string, changes: Partial<Pick<Task, 'status' | 'doctor' | 'overdue'>> = {}) {
  useDemo.setState((demo) => ({
    tasks: demo.tasks.map((task) => task.id === taskId
      ? { ...task, ...changes, history: [...task.history, { label, detail, time: '17 noy, 14:20' }] }
      : task),
    notice: label,
  }))
}

export function confirmDischarge() {
  useDemo.setState((demo) => {
    if (demo.discharge.confirmed) return demo

    const id = 'CH-' + (1043 + demo.tasks.length - 4)
    const patient = patientOf(demo, demo.discharge.patientId)
    const due = new Date(new Date(demo.discharge.time + '+05:00').getTime() + 86_400_000)
    const dueLabel = new Intl.DateTimeFormat('uz-Latn-UZ', {
      timeZone: 'Asia/Tashkent', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(due)
    const task: Task = {
      id, patientId: demo.discharge.patientId, facility: patient?.district === 'Yunusobod' ? facilities[1] : facilities[0],
      doctor: '', due: dueLabel, dueAt: due.toISOString(), recommendations: demo.discharge.recommendations,
      status: 'UNASSIGNED', overdue: due.getTime() < Date.parse(demoTime + '+05:00'),
      history: [{ label: 'Chaqiruv yaratildi', detail: demo.discharge.recommendations, time: '17 noy, 14:20' }],
    }
    return {
      discharge: { ...demo.discharge, confirmed: true }, tasks: [task, ...demo.tasks],
      taskId: id, notice: 'Chiqarish tasdiqlandi. ' + id + ' chaqiruvi yaratildi.',
    }
  })
}

export function needsReply(messages: Message[]) {
  return messages.at(-1)?.from === 'patient'
}
