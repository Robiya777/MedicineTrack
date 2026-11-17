import { useNavigate } from '@tanstack/react-router'
import { Check, CircleCheck, Clock3, Pill } from 'lucide-react'
import type { VariantId } from './catalog'
import { demoTime, doctors, useDemo } from './demo'
import type { Medication } from './demo'
import { DemoForm, Facts, Panel, ScreenLink } from './ui'

function planFacts(medication: Medication) {
  return [
    { label: 'Nomi', value: medication.name },
    { label: 'Yozilgan doza matni', value: medication.dose },
    { label: 'Qabul yo‘li', value: medication.route },
    { label: 'Qabul vaqti', value: medication.time + ' · Asia/Tashkent' },
    { label: 'Kurs', value: medication.from + ' — ' + medication.until },
    { label: 'Ko‘rsatma manbasi', value: medication.source },
  ]
}

export function MedicationDraft({ variant }: { variant: VariantId }) {
  const { medication, medicationDraft } = useDemo()
  const draft = medicationDraft ?? medication
  const navigate = useNavigate()
  return <Panel title="Epikrizdagi ko‘rsatma" className="dp-form-panel">
    <DemoForm guided={variant === 'guided'} summary submit="Jadval loyihasini saqlash" cancel={<ScreenLink to="new-discharge">Chiqarish formasiga qaytish</ScreenLink>}
      steps={[
        { title: 'Yozilgan ko‘rsatma', fields: [
          { name: 'name', label: 'Dori nomi', initial: draft.name, max: '100' },
          { name: 'dose', label: 'Yozilgan doza matni', initial: draft.dose, max: '200' },
          { name: 'route', label: 'Qabul yo‘li', initial: draft.route, max: '100' },
          { name: 'source', label: 'Ko‘rsatma manbasi', initial: draft.source, max: '200' },
        ] },
        { title: 'Vaqt va kurs', fields: [
          { name: 'time', label: 'Qabul vaqti (Asia/Tashkent)', type: 'time', initial: draft.time },
          { name: 'from', label: 'Kurs boshlanishi', type: 'date', initial: draft.from },
          { name: 'until', label: 'Kurs tugashi', type: 'date', initial: draft.until },
        ] },
      ]} check={({ from, until }) => until < from ? { until: 'Kurs tugashi boshlanishidan oldin bo‘lmasin.' } : {}}
      onSubmit={({ name, dose, route, source, time, from, until }) => {
        useDemo.setState({
          medicationDraft: { name, dose, route, source, time, from, until },
          notice: 'Jadval loyihasi saqlandi. Shifokor tasdig‘i kutilmoqda.',
        })
        void navigate({ to: '/design/$variant/$screen', params: { variant, screen: 'discharges' } })
      }} />
  </Panel>
}

export function MedicationReview() {
  const { medication, medicationDraft } = useDemo()
  return <Panel title={medicationDraft ? 'Tasdiqlash kutilmoqda' : 'Amaldagi jadval'}>
    <Facts items={[
      ...planFacts(medicationDraft ?? medication),
      { label: 'Tasdiqlovchi shifokor', value: doctors[0] },
    ]} />
    <div className="dp-actions">
      {medicationDraft && <button type="button" className="dp-button dp-primary" onClick={() => useDemo.setState({
        medication: medicationDraft, medicationDraft: null, doseResult: null, notice: 'Dori jadvali tasdiqlandi.',
      })}><Check size={18} aria-hidden /> Jadvalni tasdiqlash</button>}
      <ScreenLink to="doctor-history">Qabul tarixi</ScreenLink>
    </div>
  </Panel>
}

export function Medications() {
  const { medication, doseResult } = useDemo()
  const today = demoTime.slice(0, 10)
  const inCourse = medication.from <= today && today <= medication.until
  const canRecord = inCourse && !doseResult && medication.time <= demoTime.slice(11)
  return <Panel title="Tasdiqlangan dori jadvali" action={<ScreenLink to="dose-history">Qabul tarixi</ScreenLink>}>
    <div className="dp-identity">
      <span className="dp-avatar"><Pill size={25} aria-hidden /></span>
      <div><h2>{medication.name}</h2><p>{medication.dose}</p></div>
      <span className="dp-status" data-status={doseResult === 'Ichdim' ? 'COMPLETED' : 'ACCEPTED'}><Clock3 size={16} aria-hidden /> {medication.time}</span>
    </div>
    <Facts items={[
      ...planFacts(medication).slice(2),
      { label: 'Bugungi qayd', value: !inCourse ? 'Bugun jadvalda qabul yo‘q' : doseResult || 'Qayd kiritilmagan' },
    ]} />
    {canRecord && <div className="dp-actions">
      <button className="dp-button dp-primary" type="button" onClick={() => useDemo.setState({ doseResult: 'Ichdim', notice: 'Qabul qaydi saqlandi.' })}><CircleCheck size={18} aria-hidden /> Ichdim</button>
      <button className="dp-button dp-secondary" type="button" onClick={() => useDemo.setState({ doseResult: 'O‘tkazib yubordim', notice: 'Qabul qaydi saqlandi.' })}>O‘tkazib yubordim</button>
    </div>}
  </Panel>
}

export function DoseHistory({ doctor = false }: { doctor?: boolean }) {
  const { medication, doseResult } = useDemo()
  const today = demoTime.slice(0, 10)
  const inCourse = medication.from <= today && today <= medication.until
  return <Panel title="Bemor qayd etgan qabul" action={<ScreenLink to={doctor ? 'medication-review' : 'medications'}>Jadvalni ko‘rish</ScreenLink>}>
    <ul className="dp-simple-list">
      {inCourse && <li><div><strong>{medication.name}</strong><small>17 noy · {medication.time}</small></div><span>{doseResult || 'Qayd kiritilmagan'}</span></li>}
      <li><div><strong>Demo preparat A</strong><small>16 noy · 13:00</small></div><span className="dp-status" data-status="COMPLETED"><CircleCheck size={16} aria-hidden /> Ichdim</span></li>
    </ul>
  </Panel>
}
