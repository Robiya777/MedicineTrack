import { Building2, CalendarClock, FileText, MapPin, Phone, Stethoscope, UserRound } from 'lucide-react'
import type { Discharge } from '@/api/hospital'
import { formatTashkentDateTime } from '@/lib/date'
export function DischargeRecord({discharge,name,phone,address,hospital}:{discharge:Discharge;name:string;phone:string;address:string;hospital:string}) {
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-mint/60 p-4 sm:p-5">
      <div className="flex min-w-0 items-center gap-3"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-primary"><UserRound size={24} aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs text-muted">Bemor</p><h3 className="break-words text-lg font-semibold tracking-tight sm:text-xl">{name}</h3></div></div>
      <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${discharge.status==='CONFIRMED' ? 'bg-success-wash text-success' : 'bg-warning-wash text-warning'}`}>{discharge.status==='CONFIRMED'?'Tasdiqlangan':'Loyiha'}</span>
    </div>
    <dl className="grid gap-4 sm:grid-cols-2">{[
      {label:'Chiqaruvchi kasalxona',value:hospital,Icon:Building2},
      {label:'Chiqarilgan vaqt · Toshkent',value:formatTashkentDateTime(discharge.discharged_at),Icon:CalendarClock},
      {label:'Telefon',value:phone,Icon:Phone},
      {label:'Manzil',value:address,Icon:MapPin},
    ].map(({label,value,Icon})=><div key={label} className="flex min-w-0 items-start gap-3 rounded-xl border border-line/70 p-4"><Icon size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div></div>)}</dl>
    <div className="grid gap-4 lg:grid-cols-2">{[{label:'Kuzatuvga olish asosi',value:discharge.follow_up_reason,Icon:FileText},{label:'Shifokor tavsiyasi',value:discharge.recommendations,Icon:Stethoscope}].map(({label,value,Icon})=><section key={label} className="min-w-0 rounded-xl bg-page p-4"><h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Icon size={17} className="text-primary" aria-hidden="true" />{label}</h3><p className="whitespace-pre-wrap break-words text-sm leading-7">{value}</p></section>)}</div>
    <details className="text-xs text-muted"><summary className="w-fit cursor-pointer py-2">Bemor identifikatori</summary><p className="break-all py-2 font-mono">{discharge.patient}</p></details>
  </div>
}
