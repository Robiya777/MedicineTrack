import { options } from './catalog'
import { useNavigate } from '@tanstack/react-router'
import { Activity, ArrowRight, CalendarClock, CircleHelp, ClipboardList, Clock3, MessageSquare, Pill, Send, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { VariantId } from './catalog'
import { demoTime, doctors, needsReply, useDemo } from './demo'
import { DemoForm, Empty, Facts, Panel, ScreenLink } from './ui'

export function PatientHome() {
  const { patients, messages, statusUpdate, medication } = useDemo()
  return <>
    <div className="dp-patient-intro">
      <div><p>Assalomu alaykum, {patients[0].name.split(' ')[0]}.</p><h2>Bugungi kuzatuv</h2></div>
      <span><CalendarClock size={18} aria-hidden /> 17 noyabr, seshanba</span>
    </div>
    <div className="dp-service-grid">
      <Panel title="Shifokor bilan aloqa" className="dp-service"><MessageSquare aria-hidden />
        <p>{doctors[0]} · {needsReply(messages) ? 'Javob kutilmoqda' : 'Suhbat faol'}</p>
        <ScreenLink to="patient-chat" className="dp-button dp-primary">Suhbatni ochish <ArrowRight size={16} aria-hidden /></ScreenLink>
      </Panel>
      <Panel title="Holatim" className="dp-service"><Activity aria-hidden />
        <p>{statusUpdate || 'Yangi holat xabari yuborishingiz mumkin.'}</p>
        <ScreenLink to="status-update">Holat yuborish</ScreenLink>
      </Panel>
      <Panel title="Bugungi dorilar" className="dp-service"><Pill aria-hidden />
        <p>{medication.name} · {medication.time}</p>
        <ScreenLink to="medications">Jadvalni ko‘rish</ScreenLink>
      </Panel>
    </div>
  </>
}

export function Chat({ role }: { role: 'patient' | 'doctor' }) {
  const demo = useDemo()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const replyPending = needsReply(demo.messages)
  const author = role === 'patient' ? 'Shifokor' : 'Bemor'
  const person = role === 'patient' ? doctors[0] : demo.patients[0].name

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = text.trim()
    if (!message) {
      setError('Xabar matnini kiriting.')
      event.currentTarget.querySelector('textarea')?.focus()
      return
    }
    useDemo.setState((state) => ({
      messages: [...state.messages, { from: role, text: message, time: '14:20' }],
      notice: role === 'patient' ? 'Xabar yuborildi.' : 'Javob yuborildi.',
    }))
    setText('')
    setError('')
  }

  return <div className="dp-detail-grid dp-chat-grid">
    <Panel title={person} className="dp-chat-panel">
      <ol className="dp-chat-list" aria-label="Suhbat xabarlari">
        {demo.messages.map((message, index) => <li key={index} data-own={message.from === role}>
          <strong>{message.from === role ? 'Siz' : author}</strong><p>{message.text}</p><time>{message.time}</time>
        </li>)}
      </ol>
      <form className="dp-chat-form" onSubmit={send} noValidate>
        <label htmlFor="demo-message">{role === 'doctor' ? 'Javob matni' : 'Xabar matni'}</label>
        <textarea id="demo-message" rows={3} maxLength={4000} value={text} onChange={(event) => {
          setText(event.target.value)
          if (error) setError('')
        }} aria-invalid={Boolean(error)} aria-describedby={error ? 'message-error' : undefined} />
        {error && <p id="message-error" className="dp-error" role="alert">{error}</p>}
        <button className="dp-button dp-primary" type="submit"><Send size={16} aria-hidden />{role === 'doctor' ? 'Javob yuborish' : 'Xabar yuborish'}</button>
      </form>
    </Panel>
    <Panel title="Aloqa ma’lumoti">
      <Facts items={[
        { label: 'Ish vaqti', value: demo.shift.start + '–' + demo.shift.end + ' · Asia/Tashkent' },
        { label: 'Javob holati', value: replyPending ? 'Javob kutilmoqda' : 'Javob berildi' },
        { label: 'Kutilayotgan javob muddati', value: replyPending ? '17 noy, 15:05' : '—' },
        { label: 'Bemor bildirgan holat', value: demo.statusUpdate || 'Yuborilmagan' },
      ]} />
      {role === 'patient' && <>
        <p className="dp-message dp-warning"><TriangleAlert size={19} aria-hidden />Shoshilinch yordam kerak bo‘lsa, chat javobini kutmay, mahalliy shoshilinch yordam xizmatiga murojaat qiling.</p>
        <ScreenLink to="status-update">Holatimni yuborish</ScreenLink>
      </>}
    </Panel>
  </div>
}

export function StatusUpdate({ variant }: { variant: VariantId }) {
  const navigate = useNavigate()
  return <Panel title="Kuzatuv ma’lumoti" className="dp-form-panel">
    <p className="dp-message dp-warning"><TriangleAlert size={19} aria-hidden />Shoshilinch yordam kerak bo‘lsa, chat javobini kutmang.</p>
    <DemoForm guided={variant === 'guided'} submit="Holatni yuborish" cancel={<ScreenLink to="patient-home">Kabinetga qaytish</ScreenLink>}
      steps={[
        { title: 'Holat', fields: [
          { name: 'state', label: 'O‘zingizni qanday his qilyapsiz?', type: 'select', options: options(['Yaxshilandi', 'O‘zgarmadi', 'Yomonlashdi']) },
          { name: 'time', label: 'Kuzatuv vaqti', type: 'datetime-local', initial: demoTime, max: demoTime },
        ] },
        { title: 'Izoh', fields: [{ name: 'comment', label: 'Shifokorga izoh', type: 'textarea', max: '4000' }] },
      ]} onSubmit={({ state, comment }) => {
        useDemo.setState((demo) => ({
          statusUpdate: state,
          messages: [...demo.messages, { from: 'patient', text: 'Bemor bildirgan holat — ' + state + '. ' + comment, time: '14:20' }],
          notice: 'Holat shifokorga yuborildi.',
        }))
        void navigate({ to: '/design/$variant/$screen', params: { variant, screen: 'patient-chat' } })
      }} />
  </Panel>
}

export function Unanswered() {
  const { messages, statusUpdate, patients } = useDemo()
  return <Panel title="Javob kutilayotgan suhbatlar" action={<ScreenLink to="work-schedule">Ish jadvali</ScreenLink>}>
    {needsReply(messages) ? <ul className="dp-simple-list"><li>
      <div><strong>{patients[0].name}</strong><small>{patients[0].id} · {doctors[0]}</small></div>
      <div className="dp-unanswered-status">
        {statusUpdate === 'Yomonlashdi' && <span className="dp-status" data-status="overdue"><TriangleAlert size={15} aria-hidden /> Ustuvor</span>}
        <span><Clock3 size={17} aria-hidden /> 17 noy, 15:05</span>
      </div>
    </li></ul> : <Empty label="Javobsiz suhbat qolmadi." />}
  </Panel>
}

export function WorkSchedule() {
  const shift = useDemo((demo) => demo.shift)
  return <Panel title={doctors[0]} className="dp-form-panel">
    <p className="dp-message"><CalendarClock size={18} aria-hidden /> Dushanba–juma · Asia/Tashkent</p>
    <DemoForm steps={[{ title: 'Ish soatlari', fields: [
      { name: 'start', label: 'Boshlanish vaqti', type: 'time', initial: shift.start },
      { name: 'end', label: 'Tugash vaqti', type: 'time', initial: shift.end },
    ] }]} submit="Jadvalni saqlash" check={({ start, end }) => end <= start ? { end: 'Tugash vaqti boshlanishidan keyin bo‘lsin.' } : {}}
      cancel={<ScreenLink to="unanswered">Navbatga qaytish</ScreenLink>}
      onSubmit={({ start, end }) => useDemo.setState({ shift: { start, end }, notice: 'Ish jadvali saqlandi.' })} />
  </Panel>
}

export function Admin() {
  return <>
    <div className="dp-service-grid">
      <Panel title="Akkauntlar" className="dp-service"><CircleHelp aria-hidden /><strong className="dp-numeric">5</strong><p>Demo rollari faol</p></Panel>
      <Panel title="Muassasalar" className="dp-service"><ClipboardList aria-hidden /><strong className="dp-numeric">2</strong><p>Ma’lumotnomada</p></Panel>
      <Panel title="Texnik holat" className="dp-service"><Activity aria-hidden /><strong>Demo</strong><p>Oxirgi sinov · 14:20</p></Panel>
    </div>
    <div className="dp-detail-grid">
      <Panel title="Demo akkauntlar">
        <ul className="dp-simple-list">
          {['Statsionar', 'Koordinator', 'Oilaviy shifokor', 'Bemor', 'Texnik admin'].map((role) => <li key={role}><strong>{role}</strong><small>Faol</small></li>)}
        </ul>
      </Panel>
      <Panel title="Ma’lumotnomalar va texnik metrikalar">
        <Facts items={[
          { label: 'Hududlar', value: 'Chilonzor, Yunusobod' },
          { label: 'Ma’lumotnomalar', value: 'Muassasalar, shifokorlar, hududlar' },
          { label: 'Demo xizmatlari', value: 'Frontend, API proksi, bildirishnoma navbati' },
        ]} />
      </Panel>
    </div>
  </>
}
