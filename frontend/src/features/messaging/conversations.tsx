import './chat.css'
import {DischargeCorrections} from '@/features/records/corrections'
import { AssistantReply, EmergencyPhone } from './assistant'
import { ChatTeam } from './chat-team'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, getRouteApi } from '@tanstack/react-router'
import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { ArrowLeft, MessageCircle, RefreshCw, Search, Send, CheckCheck, CalendarClock, ChevronDown, LoaderCircle, HeartPulse, History, UserRound, Stethoscope } from 'lucide-react'
import {
  conversationQuery,
  conversationsQuery,
  markRead,
  messagesQuery,
  messagingKeys,
  sendMessage,
  sendStatus,
  states,
  statusesQuery,
  type Conversation,
  type StatusInput,
} from '@/api/messaging'
import {
  dischargePageQuery,
  doctorNameQuery,
  hospitalPatientQuery,
} from '@/api/hospital'
import { useSessionStore } from '@/state/session'
import {
  formatTashkentDateTime,
  parseTashkentInput,
  tashkentInputValue,
} from '@/lib/date'
import {
  responseFieldErrors,
} from '@/lib/errors'
import {
  useIdempotentMutation,
} from '@/hooks/use-idempotent-mutation'
import {
  Facts,
  Dialog,
  Field,
  inputStyle,
  Notice,
  primaryButton,
  RequestError,
  secondaryButton,
} from '@/components/ui'

const route = getRouteApi('/(app)/kabinet/$role/suhbat/$conversationId/')
const delivery = {
  SENT: 'Yuborildi',
  READ: 'O‘qildi',
  ANSWERED: 'Javob berildi',
}
export function PatientDashboard() {
  const user = useSessionStore((s) => s.user)!
  const patient = useQuery(hospitalPatientQuery(user.patient!))
  const [page, setPage] = useState(1)
  const discharges = useQuery(dischargePageQuery(page))
  return (
    <section className="space-y-6">
      <header className="flex items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface text-primary"><UserRound size={22} aria-hidden="true"/></span><div><p className="text-xs text-muted">Bemor kabineti</p><h1 className="mt-0.5 text-xl font-semibold tracking-tight">{patient.data?.full_name || 'Mening kabinetim'}</h1></div></header>
      {patient.isError && (
        <RequestError
          error={patient.error}
          retry={() => void patient.refetch()}
        />
      )}
      <ConversationList />
      <section className="mt-card space-y-4 p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Mening chiqarishlarim</h2>
        {discharges.isPending && <Notice>Chiqarishlar yuklanmoqda…</Notice>}
        {discharges.isError && (
          <RequestError
            error={discharges.error}
            retry={() => void discharges.refetch()}
          />
        )}
        {discharges.data?.results.length === 0 && (
          <Notice>Chiqarish yozuvlari hali yo‘q.</Notice>
        )}
        {discharges.data?.results.map((item) => (
          <article
            key={item.id}
            className="space-y-3 border-t border-line pt-4"
          >
            <h3 className="font-semibold">
              {formatTashkentDateTime(item.discharged_at)} (Toshkent)
            </h3>
            <Facts
              items={[
                {
                  label: 'Kuzatuvga olish asosi',
                  value: item.follow_up_reason,
                },
                { label: 'Shifokor tavsiyasi', value: item.recommendations },
              ]}
            />
            <DischargeCorrections discharge={item}/>
          </article>
        ))}
        {discharges.data && (
          <nav
            className="flex flex-wrap items-center gap-3"
            aria-label="Chiqarish sahifalari"
          >
            <button
              className={secondaryButton}
              disabled={!discharges.data.previous}
              onClick={() => setPage(page - 1)}
            >
              Oldingi
            </button>
            <span>Sahifa {page}</span>
            <button
              className={secondaryButton}
              disabled={!discharges.data.next}
              onClick={() => setPage(page + 1)}
            >
              Keyingi
            </button>
          </nav>
        )}
      </section>
    </section>
  )
}
export function ConversationList() {
  const role = useSessionStore((state) => state.user?.role)
  return role === 'PATIENT' ? <PatientChat /> : <DoctorConversationList />
}
function PatientChat() {
  const conversations = useQuery(conversationsQuery())
  const active = conversations.data?.find((item) => item.status === 'OPEN')
  const history = conversations.data?.filter((item) => item.status === 'CLOSED') || []
  return <section className="space-y-4" aria-label="Shifokorlar bilan umumiy chat">
    <header className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><MessageCircle size={20} className="text-primary" aria-hidden="true"/><h2 className="text-lg font-semibold">Shifokorlar bilan chat</h2></div><button type="button" className={secondaryButton} aria-label="Suhbatni yangilash" disabled={conversations.isFetching} onClick={() => void conversations.refetch()}><RefreshCw size={17} aria-hidden="true" /></button></header>
    {conversations.isPending && <Notice>Suhbat yuklanmoqda…</Notice>}
    {conversations.isError && <RequestError error={conversations.error} retry={() => void conversations.refetch()} />}
    {!conversations.isError && active && <div className="h-[max(640px,calc(100dvh-230px))] overflow-hidden rounded-3xl border border-line bg-surface shadow-xs"><ConversationBody key={active.id} conversation={active} embedded /></div>}
    {!conversations.isPending && !conversations.isError && !active && <Notice>Suhbat tayyorlanmoqda. Mas’ul tibbiyot xodimi bilan bog‘laning.</Notice>}
    {history.length > 0 && <details className="text-sm"><summary className="cursor-pointer font-medium text-muted">Oldingi yozishmalar</summary><ul className="mt-3 space-y-2">{history.map((item) => <li key={item.id}><Link className="mt-link" to="/kabinet/$role/suhbat/$conversationId" params={{ role: 'bemor', conversationId: item.id }} search={{}}>Suhbat tarixi · {formatTashkentDateTime(item.created_at)}</Link></li>)}</ul></details>}
  </section>
}
function DoctorConversationList() {
  const user = useSessionStore((s) => s.user)!
  const conversations = useQuery(conversationsQuery())
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const active = conversations.data?.find(item => item.id === selected)
  return <section className="space-y-4">
    <header className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface text-primary"><MessageCircle size={22} aria-hidden="true"/></span><div><h1 className="text-xl font-semibold">Bemorlar bilan chat</h1><p className="mt-0.5 text-xs text-muted">Yozishmalar va bemor kuzatuvi</p></div></div><button className={secondaryButton} aria-label="Suhbatlarni yangilash" disabled={conversations.isFetching} onClick={() => void conversations.refetch()}><RefreshCw size={17} aria-hidden="true" /></button></header>
    <div className="grid h-[max(640px,calc(100dvh-180px))] overflow-hidden rounded-3xl border border-line bg-surface shadow-xs md:grid-cols-[250px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside aria-label="Suhbatlar ro‘yxati" className={(active ? 'hidden md:flex ' : 'flex ')+'min-h-0 flex-col border-line md:border-r'}>
        <div className="border-b border-line p-4"><label className="relative block"><span className="sr-only">Suhbat qidirish</span><Search size={17} className="absolute left-3 top-3.5 text-muted" aria-hidden="true"/><input className={inputStyle+' pl-10'} placeholder="Ism bo‘yicha qidirish" value={search} onChange={e=>setSearch(e.target.value)} /></label></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {conversations.isPending && <Notice>Suhbatlar yuklanmoqda…</Notice>}
          {conversations.isError && <RequestError error={conversations.error} retry={()=>void conversations.refetch()}/>}
          {!conversations.isError && conversations.data?.map(item=><ConversationCard key={item.id} conversation={item} patient={user.role==='PATIENT'} search={search} selected={selected===item.id} choose={()=>setSelected(item.id)}/>)}
          {!conversations.isPending && !conversations.isError && <p className="px-3 py-5 text-center text-xs text-muted">{conversations.data?.length ? 'Kerakli suhbatni ro‘yxatdan tanlang.' : 'Hozircha suhbatlar yo‘q.'}</p>}
        </div>
      </aside>
      <div className={(active ? 'flex ' : 'hidden md:flex ')+'min-h-0 min-w-0 flex-col bg-page'}>
        {active ? <><button className="flex shrink-0 items-center gap-2 border-b border-line bg-surface p-4 text-sm font-medium text-primary md:hidden" onClick={()=>setSelected(null)}><ArrowLeft size={18} aria-hidden="true"/>Suhbatlar</button><div className="min-h-0 flex-1 overflow-hidden"><ConversationBody key={active.id} conversation={active} embedded /></div></> : <div className="m-auto max-w-sm px-6 py-16 text-center"><span className="mx-auto mb-5 flex size-20 items-center justify-center rounded-3xl bg-mint text-primary"><MessageCircle size={36} aria-hidden="true"/></span><h2 className="text-xl font-semibold">Suhbatni tanlang</h2><p className="mt-2 text-sm leading-6 text-muted">Xabarlarni ko‘rish va javob yozish uchun chapdagi ro‘yxatdan bemorni tanlang.</p></div>}
      </div>
    </div>
  </section>
}
function ConversationCard({conversation, patient, search, selected, choose}: {conversation: Conversation; patient: boolean; search: string; selected: boolean; choose:()=>void}) {
  const doctor=useQuery(doctorNameQuery(conversation.doctor))
  const person=useQuery({...hospitalPatientQuery(conversation.patient),enabled:!patient && !conversation.patient_name,retry:false})
  const name=patient ? (conversation.doctor ? doctor.data || 'Mas’ul shifokor' : 'Mas’ul tayinlanmoqda') : conversation.patient_name || person.data?.full_name || 'Bemor '+conversation.patient.slice(0,8)
  if(!name.toLocaleLowerCase().includes(search.toLocaleLowerCase())) return null
  return <button type="button" onClick={choose} aria-pressed={selected} className={'mb-1 flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary '+(selected?'bg-mint':'hover:bg-page')}><span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface font-semibold text-primary">{name.slice(0,1).toLocaleUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{name}</span><span className="mt-1 block text-xs text-muted">{conversation.status==='CLOSED'?'Yopilgan suhbat':'Ochiq suhbat'}</span>{conversation.response_due_at && <span className="mt-2 block text-[11px] text-primary">Javob: {formatTashkentDateTime(conversation.response_due_at)}</span>}</span>{conversation.first_unanswered_at && conversation.status==='OPEN' && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" title="Javob kutilmoqda"/>}</button>
}
export function ConversationPage() {
  const { conversationId, role } = route.useParams()
  const conversation = useQuery(conversationQuery(conversationId))
  const client = useQueryClient()
  useEffect(() => {
    if (conversation.data?.status !== 'CLOSED') return
    client.setQueryData(
      messagingKeys.conversations,
      (previous: Conversation[] | undefined) =>
        previous?.map((item) =>
          item.id === conversationId
            ? { ...item, status: 'CLOSED' as const }
            : item,
        ),
    )
    void client.invalidateQueries({ queryKey: messagingKeys.conversations })
  }, [conversation.data?.status, conversationId, client])
  return (
    <section className="mt-workflow space-y-5">
      <Link
        to="/kabinet/$role"
        params={{ role }}
        search={{}}
        className="mt-link gap-2"
      >
        <ArrowLeft size={17} aria-hidden="true" />
        Kabinetga qaytish
      </Link>
      <h1 className="text-3xl font-semibold">
        {role === 'shifokor' ? 'Bemor bilan suhbat' : 'Tibbiy jamoa bilan suhbat'}
      </h1>
      {conversation.isPending && <Notice>Suhbat yuklanmoqda…</Notice>}
      {conversation.isError && (
        <RequestError
          error={conversation.error}
          retry={() => void conversation.refetch()}
        />
      )}
      {conversation.data && !conversation.isError && (
        <ConversationBody
          key={conversation.data.id}
          conversation={conversation.data}
        />
      )}
    </section>
  )
}
function ConversationBody({ conversation, embedded = false }: { conversation: Conversation; embedded?: boolean }) {
  const user = useSessionStore((s) => s.user)!
  const client = useQueryClient()
  const messages = useQuery(messagesQuery(conversation.id))
  const messageScroll = useRef<HTMLElement>(null)
  const followLatest = useRef(true)
  const scrollToLatest = () => {
    const area = messageScroll.current
    if (area) area.scrollTop = area.scrollHeight
  }
  useEffect(() => {
    if (!followLatest.current || !messages.data) return
    const frame = requestAnimationFrame(() => {
      const area = messageScroll.current
      if (area) area.scrollTop = area.scrollHeight
    })
    return () => cancelAnimationFrame(frame)
  }, [messages.data, conversation.id])
  const statuses = useQuery(statusesQuery(conversation.id))
  const lastRead = useRef('')
  const [visible, setVisible] = useState(
    () => document.visibilityState === 'visible',
  )
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  const incoming =
    messages.data
      ?.filter((m) => m.sender !== user.id && !m.read_at)
      .map((m) => m.id)
      .join(',') || ''
  const read = useMutation({
    mutationFn: () => markRead(conversation.id),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ['messaging', 'messages', conversation.id],
      })
    },
  })
  const { mutate: mark } = read
  useEffect(() => {
    if (
      visible &&
      conversation.status === 'OPEN' &&
      incoming &&
      incoming !== lastRead.current &&
      !messages.isError
    ) {
      lastRead.current = incoming
      mark()
    }
  }, [incoming, conversation.status, mark, messages.isError, visible])
  const denied = messages.isError || statuses.isError
  const snapshot = conversation.work_schedule
  const [toolsOpen, setToolsOpen] = useState(false)
  const online = conversation.team.filter((member) => member.online).length
  const tools = <>
        <div className="px-1"><h2 className="flex items-center gap-2 text-sm font-semibold"><HeartPulse size={17} className="text-primary" aria-hidden="true"/>Kuzatuv paneli</h2><p className="mt-1 text-xs leading-5 text-muted">{user.role === 'PATIENT' ? 'Holatingizni bildiring va avvalgi qaydlarni ko‘ring.' : 'Bemor bildirgan holatlar va ish jadvali.'}</p></div>
      {!denied && conversation.status === 'OPEN' && (
        <>
          {user.role === 'PATIENT' && (
            <details open className="rounded-2xl border border-line bg-surface px-4 py-3"><summary className="cursor-pointer text-sm font-medium text-primary"><HeartPulse size={16} className="mr-2 inline" aria-hidden="true"/>Holatimni bildirish</summary><StatusForm conversationId={conversation.id} /></details>
          )}
        </>
      )}
      {!denied && statuses.data && statuses.data.length > 0 && (
        <details open={user.role === 'DOCTOR'} className="rounded-2xl border border-line bg-surface px-4 py-3"><summary className="cursor-pointer text-sm font-medium text-muted"><History size={16} className="mr-2 inline text-primary" aria-hidden="true"/>Holatlar tarixi</summary><section className="space-y-4 py-4">
          <h2 className="text-xl font-semibold">Bemor bildirgan holatlar</h2>
          {statuses.data.map((item) => (
            <article
              key={item.id}
              className="space-y-2 border-t border-line pt-3"
            >
              <span
                className={
                  'mt-status mt-status-' +
                  (item.self_reported_state === 'WORSENED'
                    ? 'danger'
                    : 'accepted')
                }
              >
                {states[item.self_reported_state]}
              </span>
              <p className="whitespace-pre-wrap wrap-break-word">{item.note}</p>
              <p className="text-sm text-muted">
                Kuzatuv: {formatTashkentDateTime(item.observed_at)} · Qabul
                qilindi: {formatTashkentDateTime(item.received_at)} (Toshkent)
              </p>
              <p className="text-xs text-muted">Bemor bildirgan ma’lumot</p>
            </article>
          ))}
        </section></details>
      )}
      {!denied && user.role === 'DOCTOR' && statuses.data?.length === 0 && <div className="rounded-2xl border border-line bg-surface p-4 text-xs leading-5 text-muted"><History size={20} className="mb-2 text-primary" aria-hidden="true"/>Bemor hali holati haqida qayd yubormagan.</div>}
        {user.role === 'DOCTOR' && 'shifts' in snapshot && (
          <details className="chat-schedule group rounded-2xl border border-line bg-page">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3 text-sm font-medium"><CalendarClock size={18} className="text-primary" aria-hidden="true"/>Shifokorning ish jadvali<ChevronDown size={16} className="ml-auto text-muted transition-transform group-open:rotate-180" aria-hidden="true"/></summary>
            <div className="border-t border-line p-3"><p className="mb-3 px-1 text-xs text-muted">Vaqt zonasi: {snapshot.timezone}</p><ul className="grid gap-2 sm:grid-cols-2">{['Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba','Yakshanba'].map((day,weekday)=>{const shifts=snapshot.shifts.filter(shift=>shift.weekday===weekday);return <li key={day} className={'rounded-xl border p-3 text-xs '+(shifts.length?'border-line bg-surface':'border-transparent bg-page text-muted')}><p className="mb-1.5 font-medium">{day}</p><p className={shifts.length?'font-semibold tabular-nums text-primary':''}>{shifts.length?shifts.map(shift=>shift.start+'–'+shift.end).join(', '):'Dam olish'}</p></li>})}</ul>
            {Object.keys(snapshot.exceptions).length>0 && <div className="mt-3 border-t border-line pt-3"><h3 className="mb-2 text-xs font-semibold">Istisno kunlar</h3>{Object.entries(snapshot.exceptions).map(([day,intervals])=><p key={day} className="flex flex-wrap justify-between gap-2 py-1 text-xs"><span>{day}</span><span className="font-medium">{intervals.length?intervals.map(shift=>shift.start+'–'+shift.end).join(', '):'Dam olish kuni'}</span></p>)}</div>}</div>
          </details>
        )}
  </>
  return (
    <div className={(user.role === 'PATIENT' ? 'patient-chat-layout grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_290px] ' : 'grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_250px] ') + 'min-h-0 ' + (embedded ? 'h-full' : 'h-[max(640px,calc(100dvh-180px))] overflow-hidden rounded-3xl border border-line')}>
      <div className="chat-wallpaper flex min-h-0 min-w-0 flex-1 flex-col">
      <section className="shrink-0 space-y-2 border-b border-line bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mint text-primary"><Stethoscope size={20} aria-hidden="true"/></span><div><h2 className="font-semibold">{user.role === 'DOCTOR' ? conversation.patient_name : 'Tibbiy jamoa'}</h2><p className="mt-1 flex items-center gap-2 text-xs text-muted"><span className={'size-2 rounded-full ' + (online ? 'bg-emerald-500' : 'bg-slate-400')} aria-hidden="true" />{online ? `${online} shifokor onlayn` : 'Shifokorlar oflayn'} · {conversation.team.length} shifokor</p></div></div>{user.role === 'PATIENT' ? <div className="flex items-center gap-2"><button type="button" aria-label="Holat va tarix" className="flex size-11 items-center justify-center rounded-xl border border-line text-primary xl:hidden" onClick={() => setToolsOpen(true)}><HeartPulse size={20} aria-hidden="true"/></button><EmergencyPhone /></div> : <div className="flex items-center gap-2"><button type="button" aria-label="Bemor holati va jadval" className="flex size-11 items-center justify-center rounded-xl border border-line text-primary 2xl:hidden" onClick={() => setToolsOpen(true)}><HeartPulse size={20} aria-hidden="true"/></button>{conversation.can_manage_team && <ChatTeam patientId={conversation.patient} />}</div>}</div>
        <p className="text-xs text-muted">{user.role === 'PATIENT' ? conversation.assistant_enabled ? 'Avval shifokorlar javob beradi. Jamoa oflayn bo‘lsa yoki 1 daqiqada javob kelmasa, AI yordamchi javob beradi.' : 'Xabarlaringizga sizga biriktirilgan tibbiy jamoa javob beradi.' : conversation.response_policy}</p>
        {conversation.status === 'CLOSED' && (
          <p role="status" className="text-sm text-warning">
            Bu suhbat yopilgan. Tarixni ko‘rishingiz mumkin. Yangi suhbatni
            kabinetdan oching.
          </p>
        )}
        {user.role === 'DOCTOR' && conversation.response_due_at && (
          <p className="text-sm">
            Javob muddati:{' '}
            {formatTashkentDateTime(conversation.response_due_at)} (Toshkent).
          </p>
        )}
      </section>
      <section ref={messageScroll} onScroll={(event) => { const area = event.currentTarget; followLatest.current = area.scrollHeight - area.clientHeight - area.scrollTop < 80 }} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5" aria-label="Suhbat xabarlari">
        {messages.isPending && <Notice>Xabarlar yuklanmoqda…</Notice>}
        {messages.isError && (
          <RequestError
            error={messages.error}
            retry={() => void messages.refetch()}
          />
        )}
        {statuses.isError && (
          <RequestError
            error={statuses.error}
            retry={() => void statuses.refetch()}
          />
        )}
        {!denied && messages.data?.length === 0 && (
          <Notice>Suhbatda hali xabar yo‘q.</Notice>
        )}
        {!denied && (
          <ol className="flex flex-col gap-4" aria-label="Xabarlar">
            {messages.data?.map((message, index) => (
              <li
                key={message.id}
                data-message-id={message.id}
                className={
                  'chat-bubble min-w-0 max-w-[90%] wrap-break-word rounded-2xl p-3.5 text-sm leading-6 shadow-xs sm:max-w-[80%] ' +
                  (message.sender === user.id ? 'self-end rounded-br-sm bg-mint' : 'self-start rounded-bl-sm border border-line bg-surface')
                }
              >
                <p className="text-xs font-semibold text-muted">
                  {message.sender === user.id
                    ? 'Siz'
                    : user.role === 'PATIENT'
                      ? message.sender_name
                      : message.sender_role === 'DOCTOR' ? message.sender_name : 'Bemor'}
                  {message.kind === 'STATUS' ? ' · Bemor bildirgan holat' : ''}
                </p>
                <p className="whitespace-pre-wrap wrap-break-word">
                  {message.text}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-1 text-[10px] text-muted">
                  {message.sender === user.id && <CheckCheck size={13} aria-hidden="true"/>}{formatTashkentDateTime(message.sent_at)} (Toshkent) ·{' '}
                  {delivery[message.delivery_status]}
                </p>
                {message.answered_at && (
                  <p className="mt-cell-meta">
                    Javob vaqti: {formatTashkentDateTime(message.answered_at)}
                  </p>
                )}
                {message.assistant && <AssistantReply assessment={message.assistant} conversationId={conversation.id} interactive={user.role === 'PATIENT' && conversation.status === 'OPEN' && index === (messages.data?.length || 0) - 1} />}
                {message.assistant_status === 'WAITING' && index === (messages.data?.length || 0) - 1 && <FallbackStatus dueAt={message.assistant_due_at} />}
              </li>
            ))}
          </ol>
        )}
        {read.error && (
          <div>
            <p role="status" className="text-sm text-warning">
              O‘qilganlik belgisini yuborib bo‘lmadi.
            </p>
            <button
              className={secondaryButton}
              disabled={read.isPending}
              onClick={() => read.mutate()}
            >
              O‘qilganlikni qayta yuborish
            </button>
          </div>
        )}
      </section>
      {!denied && conversation.status === 'OPEN' && <MessageForm conversationId={conversation.id} onSent={() => { followLatest.current = true; scrollToLatest() }} />}
      </div>
      <aside aria-label="Bemor holati va tarix" className={'hidden min-h-0 space-y-4 overflow-y-auto border-l border-line bg-page p-3 ' + (user.role === 'PATIENT' ? 'xl:block' : '2xl:block')}>{tools}</aside>
      {toolsOpen && <Dialog title={user.role === 'PATIENT' ? 'Holatim va kuzatuv tarixi' : 'Bemor holati va jadval'} close={() => setToolsOpen(false)} scrollBody><div className="space-y-4">{tools}</div></Dialog>}

    </div>
  )
}
function FallbackStatus({ dueAt }: { dueAt: string | null }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const seconds = dueAt ? Math.max(0, Math.ceil((Date.parse(dueAt) - now) / 1000)) : 0
  return <div className="mt-2 space-y-1 border-t border-primary/10 pt-2 text-xs text-muted"><p role="status">Shifokor javobi kutilmoqda. Javob bo‘lmasa AI yordamchi ulanadi.</p><p aria-hidden="true">{seconds > 0 ? `AI javobigacha ${seconds} soniya` : 'AI javobi tayyorlanmoqda…'}</p></div>
}
function MessageForm({ conversationId, onSent }: { conversationId: string; onSent?: () => void }) {
  const client = useQueryClient()
  const [text, setText] = useState('')
  const composer = useRef<HTMLTextAreaElement>(null)
  const mutation = useIdempotentMutation((input: string, key) =>
    sendMessage(conversationId, input, key),
  )
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending || !text.trim()) return
    try {
      await mutation.mutateAsync(text.trim())
      setText('')
      onSent?.()
      if (composer.current) composer.current.style.height='auto'
      requestAnimationFrame(() =>
        composer.current?.focus({ preventScroll: true }),
      )
      await client.invalidateQueries({ queryKey: messagingKeys.all })
    } catch {
      /* Preserve text and retry key. */
    }
  }
  return (
    <form
      className="shrink-0 space-y-3 border-t border-line bg-surface p-4"
      onSubmit={submit}
      aria-busy={mutation.isPending}
    >
      <div className="flex items-end gap-2 rounded-3xl border border-line bg-page p-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
        <label className="min-w-0 flex-1"><span className="sr-only">Xabar</span><textarea
          className="block max-h-36 min-h-11 w-full resize-none border-0 bg-transparent px-3 py-3 text-sm leading-5 outline-none"
          rows={1} aria-label="Xabar" placeholder="Xabar yozing…" maxLength={4000} ref={composer} value={text}
          onChange={e=>{setText(e.target.value);e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,144)+'px'}}
          onKeyDown={e=>{if(e.key==='Enter' && !e.shiftKey && !e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit()}}}
          disabled={mutation.isPending} required aria-describedby="chat-composer-help"/></label>
        <button type="submit" aria-label={mutation.isPending?'Yuborilmoqda':'Yuborish'} title="Yuborish (Enter)" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-transform hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-40 motion-reduce:transform-none" disabled={mutation.isPending || !text.trim()}>{mutation.isPending?<LoaderCircle size={20} className="animate-spin motion-reduce:animate-none" aria-hidden="true"/>:<Send size={20} aria-hidden="true"/>}</button>
      </div>
      <p id="chat-composer-help" className="px-3 text-[10px] text-muted">Enter — yuborish · Shift+Enter — yangi qator</p>
      {mutation.error && <RequestError error={mutation.error} />}
    </form>
  )
}
function StatusForm({ conversationId }: { conversationId: string }) {
  const client = useQueryClient()
  const [error, setError] = useState('')
  const [initialTime] = useState(() => tashkentInputValue(new Date()))
  const mutation = useIdempotentMutation((input: StatusInput, key) =>
    sendStatus(conversationId, input, key),
  )
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    const form = event.currentTarget,
      data = new FormData(form),
      observed = parseTashkentInput(String(data.get('observed_at')))
    if (
      !Number.isFinite(observed.getTime()) ||
      observed.getTime() > Date.now()
    ) {
      setError('Kuzatuv vaqti kelajakda bo‘lmaydi.')
      return
    }
    setError('')
    try {
      await mutation.mutateAsync({
        self_reported_state: String(
          data.get('state'),
        ) as StatusInput['self_reported_state'],
        note: String(data.get('note')).trim(),
        observed_at: observed.toISOString(),
      })
      form.reset()
      await client.invalidateQueries({ queryKey: messagingKeys.all })
    } catch {
      /* Preserve input. */
    }
  }
  return (
    <form
      className="space-y-4 pt-4"
      onSubmit={submit}
      aria-busy={mutation.isPending}
    >
      <p className="text-xs leading-5 text-muted">Shifokorga holatingiz haqida qisqa ma’lumot yuboring.</p>
      <p className="rounded-xl bg-warning-wash p-3 text-xs leading-5 text-warning">
        Holatingiz yomonlashsa yoki shoshilinch yordam kerak bo‘lsa, chat
        javobini kutmang. Shoshilinch tibbiy yordamga murojaat qiling.
      </p>
      <fieldset className="space-y-4" disabled={mutation.isPending}>
        <Field label="Hozirgi holatingiz">
          {(a11y) => (
            <select {...a11y} name="state" className={inputStyle}>
              {Object.entries(states).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field
          label="Holat haqida izoh"
          error={responseFieldErrors(mutation.error).note}
        >
          {(a11y) => (
            <textarea
              {...a11y}
              className={inputStyle}
              name="note"
              rows={3}
              maxLength={4000}
              required
            />
          )}
        </Field>
        <Field
          label="Kuzatuv vaqti (Toshkent)"
          error={error || responseFieldErrors(mutation.error).observed_at}
        >
          {(a11y) => (
            <input
              {...a11y}
              className={inputStyle}
              name="observed_at"
              type="datetime-local"
              step="1"
              defaultValue={initialTime}
              required
            />
          )}
        </Field>
      </fieldset>
      {mutation.error && <RequestError error={mutation.error} />}
      <button className={primaryButton} disabled={mutation.isPending}>
        {mutation.isPending ? 'Yuborilmoqda…' : 'Holatni yuborish'}
      </button>
      {mutation.isSuccess && (
        <p role="status" className="text-sm text-action">
          Holat shifokorga yuborildi.
        </p>
      )}
    </form>
  )
}
