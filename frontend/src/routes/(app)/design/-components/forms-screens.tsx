import { options } from './catalog'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, Check, FileText, LockKeyhole, ShieldCheck, Upload } from 'lucide-react'
import { useId, useState } from 'react'
import { roles } from './catalog'
import type { Role, VariantId } from './catalog'
import { confirmDischarge, demoTime, note, patientOf, useDemo } from './demo'
import { DemoForm, Facts, Panel, ScreenLink } from './ui'

type ScreenProps = { variant: VariantId }

const demoRoles = ['hospital', 'coordinator', 'doctor', 'patient', 'admin'] as const satisfies Role[]

export function Login({ variant }: ScreenProps) {
  const navigate = useNavigate()
  const [expired, setExpired] = useState(false)
  return <div className="dp-login">
    <aside className="dp-login-aside">
      <LockKeyhole size={34} aria-hidden="true" />
      <h2>MedicineTrack</h2>
      <p>Statsionardan uyga qaytgandan keyingi kuzatuv.</p>
      <ScreenLink to="activation">Bemor kodini faollashtirish <ArrowRight size={16} aria-hidden /></ScreenLink>
    </aside>
    <Panel title="Kabinetga kirish">
      {expired && <p role="alert" className="dp-message dp-warning">Sessiya tugadi. Qayta kiring.</p>}
      <DemoForm steps={[{ title: 'Demo akkaunt', fields: [
        { name: 'role', label: 'Rol', type: 'select', initial: 'hospital', options: demoRoles.map((role) => ({ value: role, label: roles[role].name })) },
        { name: 'username', label: 'Demo login', initial: 'demo' },
        { name: 'password', label: 'Demo parol', type: 'password', initial: 'demo123', hint: 'Demo parol: demo123' },
      ] }]} submit="Kirish" check={({ username, password }) => ({
        ...(username !== 'demo' ? { username: 'Demo login uchun demo yozing.' } : {}),
        ...(password !== 'demo123' ? { password: 'Demo parol noto‘g‘ri.' } : {}),
      })} onSubmit={({ role }) => {
        const selected = demoRoles.find((item) => item === role)
        if (!selected) return
        note('')
        void navigate({ to: '/design/$variant/$screen', params: { variant, screen: roles[selected].defaultScreen } })
      }} />
      <button className="dp-button dp-text-button" type="button" onClick={() => setExpired(true)}>Sessiya tugashini sinash</button>
    </Panel>
  </div>
}

export function Activation({ variant }: ScreenProps) {
  const navigate = useNavigate()
  return <Panel title="Bemor akkauntini faollashtirish" className="dp-form-panel">
    <DemoForm steps={[{ title: 'Faollashtirish ma’lumoti', fields: [
      { name: 'code', label: 'Faollashtirish kodi', hint: 'Sinov kodi: DEMO24', max: '12' },
      { name: 'password', label: 'Yangi demo parol', type: 'password', hint: 'Kamida 8 ta belgi. Demo uchun o‘ylab topilgan parol kiriting.' },
    ] }]} submit="Faollashtirish" cancel={<ScreenLink to="login">Kirishga qaytish</ScreenLink>}
      check={({ code, password }) => ({
        ...(code !== 'DEMO24' ? { code: 'Kod noto‘g‘ri. DEMO24 kodidan foydalaning.' } : {}),
        ...(password.length < 8 ? { password: 'Kamida 8 ta belgi kiriting.' } : {}),
      })}
      onSubmit={() => {
        note('Demo akkaunt faollashtirildi.')
        void navigate({ to: '/design/$variant/$screen', params: { variant, screen: 'patient-home' } })
      }} />
  </Panel>
}

const districts = ['Chilonzor', 'Yunusobod']

export function NewPatient({ variant }: ScreenProps) {
  const navigate = useNavigate()
  return <Panel title="Bemor kartasi" className="dp-form-panel">
    <DemoForm guided={variant === 'guided'} submit="Bemorni saqlash" cancel={<ScreenLink to="patients">Qidiruvga qaytish</ScreenLink>}
      steps={[
        { title: 'Shaxsiy ma’lumot', fields: [
          { name: 'name', label: 'Ism va familiya', max: '100' },
          { name: 'birthDate', label: 'Tug‘ilgan sana', type: 'date', max: demoTime.slice(0, 10) },
        ] },
        { title: 'Manzil va aloqa', fields: [
          { name: 'district', label: 'Tuman', type: 'select', options: options(districts) },
          { name: 'address', label: 'Manzil', max: '200' },
          { name: 'phone', label: 'Telefon', type: 'tel', optional: true, hint: 'Sinov raqami kiriting yoki bo‘sh qoldiring.' },
          { name: 'noPhone', label: 'Telefon yo‘qligi sababi', optional: true },
        ] },
      ]} check={(values) => !values.phone && !values.noPhone ? { noPhone: 'Telefon bo‘lmasa, sababini yozing.' } : {}}
      onSubmit={({ name, birthDate, phone, district, address }) => {
        useDemo.setState((demo) => {
          const id = 'B-' + String(demo.patients.length + 1).padStart(3, '0')
          return {
            patients: [...demo.patients, { id, name, birthDate, phone, district, address }],
            discharge: { ...demo.discharge, patientId: id, confirmed: false },
            notice: 'Bemor kartasi saqlandi.',
          }
        })
        void navigate({ to: '/design/$variant/$screen', params: { variant, screen: 'new-discharge' } })
      }} />
  </Panel>
}

export function DischargeForm({ variant }: ScreenProps) {
  const demo = useDemo()
  const navigate = useNavigate()
  return <Panel title="Chiqarish ma’lumotlari" className="dp-form-panel">
    <DemoForm guided={variant === 'guided'} submit="Xulosaga o‘tish" cancel={<ScreenLink to="discharges">Chiqarishlarga qaytish</ScreenLink>}
      steps={[
        { title: 'Bemor va vaqt', fields: [
          { name: 'patientId', label: 'Bemor', type: 'select', initial: demo.discharge.patientId, options: demo.patients.map(({ id, name }) => ({ value: id, label: name + ' · ' + id })) },
          { name: 'time', label: 'Haqiqiy chiqarish vaqti', type: 'datetime-local', initial: demo.discharge.time, max: demoTime, hint: 'Asia/Tashkent. 24 soat shu vaqtdan boshlanadi.' },
        ] },
        { title: 'Kuzatuv ma’lumoti', fields: [
          { name: 'reason', label: 'Kuzatuvga olish asosi', initial: demo.discharge.reason, max: '300' },
          { name: 'recommendations', label: 'Shifokor tavsiyasi', type: 'textarea', initial: demo.discharge.recommendations, max: '1000' },
        ] },
      ]} onSubmit={({ patientId, time, reason, recommendations }) => {
        useDemo.setState({ discharge: { patientId, time, reason, recommendations, confirmed: false }, notice: '' })
        void navigate({ to: '/design/$variant/$screen', params: { variant, screen: 'confirm-discharge' } })
      }} />
    <ScreenLink to="ai-review"><FileText size={17} aria-hidden /> Epikriz va AI taklifi</ScreenLink>
    <ScreenLink to="draft-medication">Dori jadvalini kiritish</ScreenLink>
  </Panel>
}

export function DischargeSummary({ variant }: ScreenProps) {
  const demo = useDemo()
  const navigate = useNavigate()
  const discharge = demo.discharge
  return <Panel title="Tasdiqlashdan oldin tekshiring" className="dp-form-panel">
    <Facts items={[
      { label: 'Bemor', value: patientOf(demo, discharge.patientId)?.name },
      { label: 'Chiqarish vaqti', value: discharge.time.replace('T', ', ') + ' (Toshkent)' },
      { label: 'Asos', value: discharge.reason },
      { label: 'Shifokor tavsiyasi', value: discharge.recommendations },
      { label: 'Patronaj muddati', value: 'Chiqarilgan vaqtdan boshlab 24 soat' },
    ]} />
    <div className="dp-actions">
      {!discharge.confirmed && <>
        <ScreenLink to="new-discharge">Tahrirlash</ScreenLink>
        <button className="dp-button dp-primary" type="button" onClick={() => {
          confirmDischarge()
          void navigate({ to: '/design/$variant/$screen', params: { variant, screen: 'hospital-task' } })
        }}><Check aria-hidden size={18} /> Chiqarishni tasdiqlash</button>
      </>}
      {discharge.confirmed && <ScreenLink to="hospital-task">Yaratilgan chaqiruvni ko‘rish</ScreenLink>}
    </div>
  </Panel>
}

export function AiReview() {
  const inputId = useId()
  const [file, setFile] = useState('')
  const [error, setError] = useState('')
  return <div className="dp-detail-grid">
    <Panel title="Epikriz PDF">
      <div className="dp-upload">
        <Upload size={24} aria-hidden />
        <label htmlFor={inputId}>PDF tanlash</label>
        <input id={inputId} type="file" accept=".pdf,application/pdf" aria-invalid={Boolean(error)}
          aria-describedby={error ? inputId + '-error' : undefined} onChange={(event) => {
            const selected = event.target.files?.[0]
            if (!selected) return
            if (!selected.name.toLowerCase().endsWith('.pdf') || selected.size > 10 * 1024 * 1024) {
              setError('10 MB dan kichik PDF tanlang.')
              setFile('')
              return
            }
            setError('')
            setFile(selected.name)
          }} />
        <p><FileText size={16} aria-hidden /> {file || 'Namuna epikriz.pdf'}</p>
        {error && <p id={inputId + '-error'} className="dp-error" role="alert">{error}</p>}
      </div>
      <div className="dp-source"><span>Demo manba · 2-sahifa</span><p>“Bemorga oilaviy shifokor bilan nazorat rejasini kelishish tavsiya etiladi.”</p></div>
    </Panel>
    <Panel title="AI taklifini tekshirish">
      <p className="dp-message"><ShieldCheck size={18} aria-hidden /> Demo taklifi. Saqlashdan oldin manbani tekshiring.</p>
      <DemoForm steps={[{ title: 'Ajratilgan maydonlar', fields: [
        { name: 'recommendation', label: 'Tavsiya matni', type: 'textarea', initial: 'Oilaviy shifokor bilan nazorat rejasini kelishish.', hint: 'Manba · 2-sahifa', max: '1000' },
      ] }]} submit="Taklifni qabul qilish" cancel={<ScreenLink to="new-discharge">Formaga qaytish</ScreenLink>}
        onSubmit={({ recommendation }) => {
          useDemo.setState((demo) => ({
            discharge: { ...demo.discharge, confirmed: false, recommendations: recommendation },
            notice: 'Taklif chiqarish loyihasiga qo‘shildi.',
          }))
        }} />
    </Panel>
  </div>
}
