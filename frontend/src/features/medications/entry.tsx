import { useQueries, useQuery } from '@tanstack/react-query'
import { dischargePageQuery, dischargeQuery, hospitalPatientQuery } from '@/api/hospital'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Pill, Search, UserRound } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { useSessionStore } from '@/state/session'
import { formatTashkentDateTime } from '@/lib/date'
import { Field, inputStyle, primaryButton, Notice, RequestError, Pagination } from '@/components/ui'
import { MedicationPanel } from './patient-medications'
export function MedicationEntry() {
  const user = useSessionStore(s=>s.user)!
  if(user.role==='PATIENT' && user.patient) return <MedicationPanel patientId={user.patient}/>
  return <MedicationPatients />
}
function MedicationPatients() {
  const user=useSessionStore(s=>s.user)!,role=user.role==='COORDINATOR'?'koordinator':'shifokor'
  const [page,setPage]=useState(1),[search,setSearch]=useState(''),[id,setId]=useState('')
  const query=useQuery(dischargePageQuery(page)),rows=query.data?.results || []
  const missing=[...new Set(rows.filter(r=>!r.patient_snapshot.full_name).map(r=>r.patient))]
  const patients=useQueries({queries:missing.map(id=>({...hospitalPatientQuery(id),retry:false}))})
  const names=new Map(patients.flatMap(q=>q.data?[[q.data.id,q.data.full_name] as const]:[]))
  const visible=rows.filter(row=>(row.patient_snapshot.full_name || names.get(row.patient) || '').toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  return <section className="space-y-5">
    <header className="flex items-start gap-3"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-mint text-primary"><Pill size={24} aria-hidden="true" /></span><div><h1 className="text-2xl font-semibold tracking-tight">Dori jadvali</h1><p className="mt-1 text-sm leading-6 text-muted">Bemorni tanlang, dorilar va qabul rejasini oching.</p></div></header>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4"><div className="w-full sm:max-w-md"><Field label="Joriy sahifadan bemor qidirish">{a=><div className="relative"><Search size={17} className="absolute left-3 top-3 text-muted" aria-hidden="true" /><input {...a} type="search" className={inputStyle+' pl-10'} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ism yoki familiya" /></div>}</Field></div><span className="text-xs text-muted">{query.data?.count ?? '—'} ta chiqarish</span></div>
    {query.isPending && <Notice>Bemorlar yuklanmoqda…</Notice>}{query.isError && <RequestError error={query.error} retry={()=>void query.refetch()}/>}
    {!query.isPending && !query.isError && !visible.length && <Notice>Mos bemor topilmadi. Boshqa sahifani yoki bemor identifikatorini tekshiring.</Notice>}
    <div className="grid gap-4 lg:grid-cols-2">{visible.map(row=><article key={row.id} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-xs"><div className="flex items-center gap-3"><UserRound size={21} className="shrink-0 text-primary" aria-hidden="true" /><h2 className="min-w-0 break-words font-semibold">{row.patient_snapshot.full_name || names.get(row.patient) || 'Bemor yuklanmoqda…'}</h2><span className={`ml-auto shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${row.status==='DRAFT'?'bg-warning-wash text-warning':'bg-success-wash text-success'}`}>{row.status==='DRAFT'?'Loyiha':'Tasdiqlangan'}</span></div><p className="text-xs text-muted">Chiqarilgan: {formatTashkentDateTime(row.discharged_at)} · Toshkent</p><Link to="/kabinet/$role/dorilar/$patientId" params={{role,patientId:row.patient}} search={{dischargeId:row.id}} className={primaryButton+' self-start'}>Jadvalni ochish<ArrowRight size={16} aria-hidden="true" /></Link></article>)}</div>
    {query.data && <Pagination page={page} onPageChange={setPage} hasPrevious={Boolean(query.data.previous)} hasNext={Boolean(query.data.next)} totalCount={query.data.count} label="chiqarish"/>}
    <details className="rounded-xl border border-line bg-surface p-4 text-sm"><summary className="cursor-pointer text-muted">Bemor UUIDsi bilan ochish</summary><div className="mt-3 flex flex-wrap items-end gap-3"><Field label="Bemor UUIDsi">{a=><input {...a} className={inputStyle} value={id} onChange={e=>setId(e.target.value.trim())}/>}</Field>{z.uuid().safeParse(id).success && <Link to="/kabinet/$role/dorilar/$patientId" params={{role,patientId:id}} search={{}} className={primaryButton}>Ochish</Link>}</div></details>
  </section>
}
export function MedicationTaskLink({dischargeId}:{dischargeId:string}) {
  const discharge=useQuery(dischargeQuery(dischargeId))
  return discharge.data && !discharge.isError ? <Link to="/kabinet/$role/dorilar/$patientId" params={{role:'shifokor',patientId:discharge.data.patient}} search={{dischargeId}} className="inline-flex min-h-11 items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><Pill size={18} aria-hidden="true" />Dori jadvali<ArrowRight size={16} aria-hidden="true" /></Link>:null
}
