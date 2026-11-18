import { useQuery } from '@tanstack/react-query'
import { doctorNameQuery } from '@/api/hospital'
import type { CareTask } from '@/api/tasks'
import { formatTashkentDateTime } from '@/lib/date'
import { UserRound, Stethoscope, CalendarClock, Clock3, MapPin, Phone, FileText, TriangleAlert } from 'lucide-react'
import { TaskStatus } from '@/features/tasks/task-table'

export interface TaskFactsProps {
  task: CareTask
}

export function TaskFacts({ task }: TaskFactsProps) {
  const doctor = useQuery(doctorNameQuery(task.assigned_doctor))

  return (
    <section className="space-y-5 rounded-2xl border border-line bg-surface p-4 shadow-xs sm:p-6" aria-labelledby="patient-title">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-mint/60 p-4"><div className="flex min-w-0 items-center gap-3"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-primary"><UserRound size={24} aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs text-muted">Bemor</p><h2 id="patient-title" className="break-words text-lg font-semibold sm:text-xl">{task.patient.full_name || 'Bemor'}</h2></div></div><TaskStatus task={task}/></div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
        {label:'Mas’ul shifokor',value:task.assigned_doctor ? doctor.data || 'Yuklanmoqda…' : 'Mas’ul biriktirilmagan',Icon:Stethoscope},
        {label:'Patronaj muddati · Toshkent',value:formatTashkentDateTime(task.due_at),Icon:Clock3},
        {label:'Chiqarilgan vaqt · Toshkent',value:formatTashkentDateTime(task.discharged_at),Icon:CalendarClock},
        {label:'Manzil',value:task.patient.address || '—',Icon:MapPin},
        {label:'Telefon',value:task.patient.contact ? <a href={'tel:'+task.patient.contact} className="text-primary hover:underline">{task.patient.contact}{task.patient.contact_is_representative?' (vakil)':''}</a> : task.patient.no_phone_reason || 'Telefon yo‘q',Icon:Phone},
      ].map(({label,value,Icon})=><div key={label} className="flex min-w-0 items-start gap-3 rounded-xl border border-line/70 p-4"><Icon size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div></div>)}</dl>
      <section className="rounded-xl bg-page p-4"><h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><FileText size={17} className="text-primary" aria-hidden="true" />Shifokor tavsiyasi</h3><p className="whitespace-pre-wrap break-words text-sm leading-7">{task.recommendations || 'Tavsiya kiritilmagan'}</p></section>
      {task.overdue && <p className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger-wash p-3 text-sm text-danger"><TriangleAlert size={17} aria-hidden="true" />Patronaj muddati o‘tgan.</p>}
      <details className="text-xs text-muted"><summary className="w-fit cursor-pointer py-2">Chaqiruv identifikatori</summary><p className="break-all py-2 font-mono">{task.id}</p></details>
    </section>
  )
}
