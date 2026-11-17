import { options } from './catalog'
import { ArrowRight, Building2, CalendarClock, CheckCircle2, ClipboardList, Clock3, FileText, Filter, Plus, Search, UserRound, Users } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { demoTime, doctors, facilities, patientOf, recordTask, selectTask, statuses, useDemo } from './demo'
import type { Demo, Task } from './demo'
import type { VariantId } from './catalog'
import { DemoForm, Dialog, Empty, Facts, History, Panel, ScreenLink, Status } from './ui'

type ScreenProps = { variant: VariantId }

export function TaskTable({ tasks, demo, to, variant }: {
  tasks: Task[]; demo: Demo; to: 'coordinator-task' | 'doctor-task' | 'hospital-task'; variant: VariantId;
}) {
  const [selection, setSelection] = useState<string | undefined>(undefined)
  if (!tasks.length) return <Empty label="Mos chaqiruv topilmadi." />
  if (variant === 'portal') {
    return <div className="dp-task-cards">{tasks.map((task) => (
      <article key={task.id} className="dp-record-card">
        <Status task={task} />
        <h3>{patientOf(demo, task.patientId)?.name}</h3>
        <p>{task.id} · {task.due}</p>
        <button className="dp-button dp-secondary" type="button" onClick={() => setSelection(task.id)}>Tafsilot</button>
        {selection === task.id && <TaskSummary task={task} demo={demo} to={to} />}
      </article>
    ))}</div>
  }
  const selected = tasks.find(({ id }) => id === selection) ?? tasks[0]
  if (variant === 'operations') {
    return <div className="dp-split-records">
      <ul className="dp-record-list" aria-label="Chaqiruvlar">{tasks.map((task) => <li key={task.id}>
        <button type="button" aria-pressed={task.id === selected.id} onClick={() => setSelection(task.id)}>
          <div><strong>{patientOf(demo, task.patientId)?.name}</strong><small>{task.id} · {task.due}</small></div>
          <Status task={task} />
        </button>
      </li>)}</ul>
      <TaskSummary task={selected} demo={demo} to={to} />
    </div>
  }

  return <table className="dp-table dp-task-table">
    <thead><tr><th scope="col">Bemor</th><th scope="col">Holat</th><th scope="col">Muddat</th><th scope="col">Mas’ul shifokor</th><th scope="col"><span className="sr-only">Tafsilot</span></th></tr></thead>
    <tbody>{tasks.map((task) => <tr key={task.id}>
      <th scope="row"><strong>{patientOf(demo, task.patientId)?.name}</strong><small>{task.id}</small></th>
      <td data-label="Holat"><Status task={task} /></td>
      <td data-label="Muddat" className="dp-numeric">{task.due}</td>
      <td data-label="Mas’ul">{task.doctor || 'Biriktirilmagan'}</td>
      <td><TaskLink task={task} to={to} /></td>
    </tr>)}</tbody>
  </table>
}

function TaskLink({ task, to }: { task: Task; to: 'coordinator-task' | 'doctor-task' | 'hospital-task' }) {
  const navigate = useNavigate()
  const variant = useVariantParam()
  return <button className="dp-button dp-text-button" type="button" onClick={() => {
    selectTask(task.id)
    void navigate({ to: '/design/$variant/$screen', params: { variant, screen: to } })
  }}>Ochish <ArrowRight aria-hidden="true" size={16} /><span className="sr-only"> {task.id}</span></button>
}


function useVariantParam() {
  return useParams({ from: '/(app)/design/$variant' }).variant
}

function TaskSummary({ task, demo, to }: { task: Task; demo: Demo; to: 'coordinator-task' | 'doctor-task' | 'hospital-task' }) {
  return <div className="dp-record-summary">
    <h3>{patientOf(demo, task.patientId)?.name}</h3>
    <Facts items={[{ label: 'Muddat', value: task.due }, { label: 'Mas’ul', value: task.doctor || 'Biriktirilmagan' }, { label: 'Muassasa', value: task.facility }]} />
    <TaskLink task={task} to={to} />
  </div>
}

export function Discharges({ variant }: ScreenProps) {
  const demo = useDemo()
  const [tab, setTab] = useState('all')
  const tasks = tab === 'draft' ? [] : demo.tasks
  return <>
    <div className="dp-metrics">
      <Metric icon={FileText} label="Loyihalar" value={demo.discharge.confirmed ? 0 : 1} />
      <Metric icon={CheckCircle2} label="Chiqarishlar" value={demo.tasks.length} />
      <Metric icon={Users} label="Bemor kartalari" value={demo.patients.length} />
    </div>
    <Panel title="Chiqarish yozuvlari" action={<ScreenLink className="dp-button dp-primary" to="new-discharge"><Plus aria-hidden size={17} /> Yangi chiqarish</ScreenLink>}>
      <div className="dp-filter-bar">
        <label>Ko‘rinish<select value={tab} onChange={(event) => setTab(event.target.value)}>
          <option value="all">Hammasi</option><option value="draft">Loyihalar</option><option value="confirmed">Tasdiqlanganlar</option>
        </select></label>
        <ScreenLink to="patients"><Search size={17} aria-hidden /> Bemor qidirish</ScreenLink>
      </div>
      {tab !== 'confirmed' && !demo.discharge.confirmed && <div className="dp-draft-row">
        <div><strong>{patientOf(demo, demo.discharge.patientId)?.name}</strong><p>Loyiha · Chiqarish tasdiqlanmagan</p></div>
        <ScreenLink to="new-discharge">Tahrirlash</ScreenLink>
      </div>}
      {tab !== 'draft' && <TaskTable tasks={tasks} demo={demo} to="hospital-task" variant={variant} />}
      {tab === 'draft' && demo.discharge.confirmed && <Empty label="Saqlangan loyiha yo‘q." />}
    </Panel>
  </>
}

export function Patients() {
  const patients = useDemo((demo) => demo.patients)
  const [search, setSearch] = useState('')
  const variant = useVariantParam()
  const navigate = useNavigate()
  const filtered = patients.filter(({ id }) => id.toLowerCase().includes(search.trim().toLowerCase()))
  return <Panel title="Bemor kartalari" action={<ScreenLink to="new-patient" className="dp-button dp-primary"><Plus size={17} aria-hidden /> Yangi bemor</ScreenLink>}>
    <div className="dp-filter-bar"><label>Bemor ID<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Masalan, B-001" /></label></div>
    {filtered.length ? <ul className="dp-simple-list">{filtered.map((patient) => (
      <li key={patient.id}><div><strong>{patient.name}</strong><small>{patient.id} · {patient.district}</small></div>
        <button className="dp-button dp-secondary" type="button" onClick={() => {
          useDemo.setState((demo) => ({ discharge: { ...demo.discharge, patientId: patient.id, confirmed: false }, notice: '' }))
          void navigate({ to: '/design/$variant/$screen', params: { variant, screen: 'new-discharge' } })
        }}>Bemorni tanlash</button>
      </li>
    ))}</ul> : <Empty label="Bu ID bo‘yicha bemor topilmadi." />}
  </Panel>
}

const filterOptions = ['Hammasi', 'Mas’ulsiz', 'Muddati yaqin', 'Kechikkan', 'Bajarilgan', 'Bekor qilingan'] as const
type QueueFilter = (typeof filterOptions)[number]

function matchesFilter(task: Task, filter: QueueFilter) {
  const active = task.status !== 'COMPLETED' && task.status !== 'CANCELLED'
  if (filter === 'Mas’ulsiz') return task.status === 'UNASSIGNED'
  if (filter === 'Kechikkan') return active && task.overdue
  if (filter === 'Muddati yaqin') return active && !task.overdue && Date.parse(task.dueAt) - Date.parse(demoTime + '+05:00') <= 14_400_000
  if (filter === 'Bajarilgan') return task.status === 'COMPLETED'
  if (filter === 'Bekor qilingan') return task.status === 'CANCELLED'
  return true
}

export function Queue({ variant }: ScreenProps) {
  const demo = useDemo()
  const [filter, setFilter] = useState<QueueFilter>('Hammasi')
  const [facility, setFacility] = useState('')
  const [doctor, setDoctor] = useState('')
  const active = demo.tasks.filter(({ status }) => status !== 'COMPLETED' && status !== 'CANCELLED')
  const scored = demo.tasks.filter((task) => task.status === 'COMPLETED' || (task.overdue && task.status !== 'CANCELLED'))
  const timely = scored.filter(({ status, overdue }) => status === 'COMPLETED' && !overdue).length
  const tasks = demo.tasks.filter((task) => matchesFilter(task, filter) && (!facility || task.facility === facility) && (!doctor || task.doctor === doctor))

  return <>
    <div className="dp-metrics">
      <Metric icon={ClipboardList} label="Faol chaqiruvlar" value={active.length} />
      <Metric icon={UserRound} label="Mas’ulsiz" value={demo.tasks.filter(({ status }) => status === 'UNASSIGNED').length} />
      <Metric icon={Clock3} label="Kechikkan" value={active.filter(({ overdue }) => overdue).length} tone="danger" />
      <Metric icon={CheckCircle2} label="O‘z vaqtida" value={scored.length ? Math.round(timely / scored.length * 100) + '%' : 'Ma’lumot yo‘q'} />
    </div>
    {variant === 'night' && active.some(({ overdue }) => overdue) && <div className="dp-priority">
      <Clock3 aria-hidden size={23} />
      <div><strong>Kechikkan chaqiruvlar</strong><p>Muddati o‘tgan vazifalar hali ochiq.</p></div>
      <button type="button" className="dp-button dp-secondary" onClick={() => setFilter('Kechikkan')}>Kechikkanlarni ko‘rish</button>
    </div>}
    <Panel title="Chaqiruvlar" action={<ScreenLink to="unanswered">Javobsiz xabarlar <ArrowRight aria-hidden size={16} /></ScreenLink>}>
      <div className="dp-tabs" aria-label="Chaqiruv holati">
        {filterOptions.map((item) => <button key={item} aria-pressed={item === filter} type="button" onClick={() => setFilter(item)}>{item}</button>)}
      </div>
      <div className="dp-filter-bar">
        <Filter aria-hidden size={17} className="dp-filter-icon" />
        <label>Muassasa<select value={facility} onChange={(event) => setFacility(event.target.value)}>
          <option value="">Barcha muassasalar</option>{facilities.map((item) => <option key={item}>{item}</option>)}
        </select></label>
        <label>Shifokor<select value={doctor} onChange={(event) => setDoctor(event.target.value)}>
          <option value="">Barcha shifokorlar</option>{doctors.map((item) => <option key={item}>{item}</option>)}
        </select></label>
      </div>
      <TaskTable tasks={tasks} demo={demo} to="coordinator-task" variant={variant} />
    </Panel>
  </>
}

function Metric({ icon: Icon, label, value, tone }: {
  icon: typeof Clock3; label: string; value: string | number; tone?: 'danger';
}) {
  return <div className="dp-metric" data-tone={tone}>
    <div><span>{label}</span><Icon size={18} aria-hidden /></div>
    <strong className="dp-numeric">{value}</strong>
  </div>
}

export function DoctorTasks({ variant }: ScreenProps) {
  const demo = useDemo()
  const [filter, setFilter] = useState('all')
  const tasks = demo.tasks.filter((task) => task.doctor === doctors[0] && (
    filter === 'all' || (filter === 'open' && ['NEW', 'ACCEPTED'].includes(task.status)) || (filter === 'completed' && task.status === 'COMPLETED')
  ))
  return <Panel title="Chaqiruvlarim" action={<ScreenLink to="doctor-chat">Bemor xabarlari</ScreenLink>}>
    <div className="dp-filter-bar"><label>Holat<select value={filter} onChange={(event) => setFilter(event.target.value)}>
      <option value="all">Hammasi</option><option value="open">Ochiq</option><option value="completed">Bajarilgan</option>
    </select></label></div>
    <TaskTable tasks={tasks} demo={demo} to="doctor-task" variant={variant} />
  </Panel>
}

function doctorTask(demo: Demo) {
  const assigned = demo.tasks.filter(({ doctor }) => doctor === doctors[0])
  return assigned.find(({ id }) => id === demo.taskId) ?? assigned.find(({ status }) => status === 'ACCEPTED') ?? assigned[0]
}

export function TaskDetail({ role }: { role: 'hospital' | 'coordinator' | 'doctor' }) {
  const demo = useDemo()
  const task = role === 'doctor' ? doctorTask(demo) : demo.tasks.find(({ id }) => id === demo.taskId)
  const [dialog, setDialog] = useState<'assign' | 'cancel' | null>(null)
  const dialogTrigger = useRef<HTMLButtonElement>(null)
  if (!task) return <Panel><Empty label="Ko‘rish uchun chaqiruv yo‘q." /></Panel>
  const patient = patientOf(demo, task.patientId)
  const active = task.status !== 'CANCELLED' && task.status !== 'COMPLETED'
  const back = role === 'hospital' ? 'discharges' : role === 'doctor' ? 'doctor-tasks' : 'queue'
  const closeDialog = () => {
    setDialog(null)
    requestAnimationFrame(() => dialogTrigger.current?.focus())
  }
  return <>
    <div className="dp-identity">
      <span className="dp-avatar"><UserRound aria-hidden size={25} /></span>
      <div><h2>{patient?.name}</h2><p>{task.id} · {patient?.district}</p></div>
      <Status task={task} />
    </div>
    <div className="dp-detail-grid">
      <Panel title="Chaqiruv ma’lumotlari">
        <Facts items={[
          { label: 'Muddat', value: <><CalendarClock size={16} aria-hidden /> {task.due}</> },
          { label: 'Muassasa', value: <><Building2 size={16} aria-hidden /> {task.facility}</> },
          { label: 'Mas’ul shifokor', value: task.doctor || 'Biriktirilmagan' },
          { label: 'Manzil', value: patient?.address ?? '—' },
          { label: 'Aloqa', value: patient?.phone || 'Demo telefon kiritilmagan' },
          { label: 'Ish jarayoni', value: statuses[task.status] },
          { label: 'Chiqarish tavsiyasi', value: task.recommendations },
        ]} />
        <div className="dp-actions">
          {role === 'coordinator' && active && <>
            <button className="dp-button dp-primary" type="button" ref={dialog === 'cancel' ? undefined : dialogTrigger} onClick={() => setDialog('assign')}>{task.doctor ? 'Qayta tayinlash' : 'Shifokor tayinlash'}</button>
            <button className="dp-button dp-danger-button" type="button" ref={dialog === 'cancel' ? dialogTrigger : undefined} onClick={() => setDialog('cancel')}>Bekor qilish</button>
          </>}
          {role === 'doctor' && task.status === 'NEW' && <button className="dp-button dp-primary" type="button" onClick={() => recordTask(task.id, 'Chaqiruv qabul qilindi', doctors[0], { status: 'ACCEPTED' })}>Qabul qilish</button>}
          {role === 'doctor' && task.status === 'ACCEPTED' && <>
            <ScreenLink to="contact-attempt">Aloqa urinishini qayd etish</ScreenLink>
            <ScreenLink to="visit-report" className="dp-button dp-primary">Natijani yuborish</ScreenLink>
          </>}
          <ScreenLink to={back}>Ro‘yxatga qaytish</ScreenLink>
        </div>
      </Panel>
      <Panel title="Hodisalar tarixi"><History events={task.history} /></Panel>
    </div>
    {dialog && <Dialog title={dialog === 'cancel' ? 'Chaqiruvni bekor qilish' : 'Shifokor tayinlash'} close={closeDialog}>
      <DemoForm steps={[{ title: 'Qaror tafsiloti', fields: [
        ...(dialog === 'assign' ? [{ name: 'doctor', label: 'Shifokor', type: 'select' as const, options: options(doctors.filter((doctor) => doctor !== task.doctor)) }] : []),
        { name: 'reason', label: 'Sabab', type: 'textarea', max: '500' },
      ] }]} submit={dialog === 'cancel' ? 'Bekor qilishni tasdiqlash' : 'Tayinlash'} onSubmit={({ doctor, reason }) => {
        if (dialog === 'cancel') recordTask(task.id, 'Chaqiruv bekor qilindi', reason, { status: 'CANCELLED' })
        else recordTask(task.id, 'Shifokor tayinlandi', doctor + ' · ' + reason, { status: 'NEW', doctor })
        closeDialog()
      }} />
    </Dialog>}
  </>
}

export function DoctorReport({ variant, contact }: ScreenProps & { contact?: boolean }) {
  const demo = useDemo()
  const navigate = useNavigate()
  const task = doctorTask(demo)
  if (!task || task.status !== 'ACCEPTED') return <Panel>
    <Empty label="Avval faol chaqiruvni qabul qiling." action={<ScreenLink to="doctor-task">Chaqiruv tafsiloti</ScreenLink>} />
  </Panel>
  return <Panel title={patientOf(demo, task.patientId)?.name} className="dp-form-panel">
    <DemoForm guided={variant === 'guided'} summary submit={contact ? 'Urinishni saqlash' : 'Natijani yuborish'}
      cancel={<ScreenLink to="doctor-task">Chaqiruvga qaytish</ScreenLink>}
      steps={[
        { title: 'Aloqa', fields: [
          { name: 'channel', label: 'Aloqa kanali', type: 'select', options: options(['Telefon', 'Uyga tashrif']), initial: 'Telefon' },
          { name: 'time', label: 'Aloqa vaqti', type: 'datetime-local', initial: demoTime, max: demoTime },
        ] },
        { title: contact ? 'Urinish natijasi' : 'Kuzatuv va keyingi reja', fields: contact ? [
          { name: 'result', label: 'Natija', type: 'select', options: options(['Javob bo‘lmadi', 'Raqam noto‘g‘ri', 'Bog‘lanildi']) },
          { name: 'observation', label: 'Izoh', type: 'textarea', optional: true },
        ] : [
          { name: 'observation', label: 'Bemor holati', type: 'textarea' },
          { name: 'actions', label: 'Bajarilgan ish', type: 'textarea' },
          { name: 'followup', label: 'Keyingi reja', type: 'textarea' },
        ] },
      ]}
      onSubmit={(values) => {
        const detail = contact ? [values.channel, values.result, values.observation].filter(Boolean)
          : [values.channel, values.observation, values.actions, values.followup]
        recordTask(task.id, contact ? 'Aloqa urinishi saqlandi' : 'Natija yuborildi', detail.join(' · '), contact ? {} : { status: 'COMPLETED' })
        void navigate({ to: '/design/$variant/$screen', params: { variant, screen: 'doctor-task' } })
      }}
    />
  </Panel>
}
