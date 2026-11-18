import { ArrowRight, CalendarDays, Clock3, Stethoscope } from 'lucide-react'
import { doctorName, type Doctor } from '@/api/tasks'

export function ScheduleWelcome({doctors,select}:{doctors:Doctor[];select:(id:string)=>void}) {
  return <section className="overflow-hidden rounded-3xl border border-line bg-surface shadow-xs" aria-labelledby="schedule-welcome-title">
    <div className="grid md:grid-cols-[1fr_280px]">
      <div className="space-y-5 p-6 sm:p-8">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-mint text-primary"><CalendarDays size={28} aria-hidden="true" /></span>
        <div><h2 id="schedule-welcome-title" className="max-w-md text-xl font-semibold tracking-tight">{doctors.length ? 'Kimning jadvalini rejalashtiramiz?' : 'Shifokorlar hali mavjud emas'}</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted">{doctors.length ? 'Shifokorni tanlang — haftalik ish vaqti va istisno kunlari shu yerda ochiladi.' : 'Hududingizga faol shifokor qo‘shilgach, uning ish jadvalini shu yerda boshqarasiz.'}</p></div>
        {doctors.length>0 && <div className="flex items-center gap-2 text-xs text-muted"><Clock3 size={15} aria-hidden="true" />Vaqtni bosib yoki tortib ish oralig‘i qo‘shish mumkin.</div>}
      </div>
      <div className="hidden items-center justify-center border-l border-line bg-page p-6 md:flex" aria-hidden="true"><div className="w-full rotate-[-3deg] rounded-2xl border border-line bg-surface p-4 shadow-sm"><div className="mb-4 flex items-center justify-between text-primary"><CalendarDays size={18}/><span className="h-2 w-16 rounded-full bg-line"/></div><div className="grid grid-cols-5 gap-2">{Array.from({length:20},(_,i)=><div key={i} className={`h-7 rounded-md ${[5,6,8,10,11,13].includes(i)?'bg-mint border-l-2 border-primary/40':'bg-page'}`}/>)}</div></div></div>
    </div>
    {doctors.length>0 && <div className="border-t border-line p-4 sm:p-6"><h3 className="mb-3 text-xs font-medium text-muted">Tez tanlash</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{doctors.slice(0,6).map(doctor=><button type="button" key={doctor.id} onClick={()=>select(doctor.id)} className="group flex min-h-16 min-w-0 cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition hover:border-primary/40 hover:bg-mint/40"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-page text-primary"><Stethoscope size={20} aria-hidden="true"/></span><span className="min-w-0 flex-1"><strong className="block break-words text-sm font-semibold">{doctorName(doctor)}</strong><span className="mt-0.5 block text-xs text-muted">Ish jadvalini ochish</span></span><ArrowRight size={17} className="shrink-0 text-muted group-hover:text-primary" aria-hidden="true"/></button>)}</div></div>}
  </section>
}
