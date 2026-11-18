import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, getRouteApi } from '@tanstack/react-router'
import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { ArrowLeft, MessageCircle, RefreshCw } from 'lucide-react'
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
      <div className="mt-page-heading">
        <div>
          <h1>{patient.data?.full_name || 'Bemor kabineti'}</h1>
          <p>Chiqarish ma’lumotlari va shifokoringiz bilan aloqa.</p>
        </div>
      </div>
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
  const user = useSessionStore((s) => s.user)!
  const conversations = useQuery(conversationsQuery())
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Suhbatlar</h2>
        <button
          className={secondaryButton}
          disabled={conversations.isFetching}
          onClick={() => void conversations.refetch()}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Yangilash
        </button>
      </div>
      {conversations.isPending && <Notice>Suhbatlar yuklanmoqda…</Notice>}
      {conversations.isError && (
        <RequestError
          error={conversations.error}
          retry={() => void conversations.refetch()}
        />
      )}
      {conversations.data?.length === 0 && (
        <Notice>
          Suhbatlar hali yo‘q. Biriktirish yangilangach ro‘yxatni qayta
          tekshiring.
        </Notice>
      )}
      {!conversations.isError &&
        conversations.data?.map((item) => (
          <ConversationCard
            key={item.id}
            conversation={item}
            patient={user.role === 'PATIENT'}
          />
        ))}
    </section>
  )
}
function ConversationCard({
  conversation,
  patient,
}: {
  conversation: Conversation
  patient: boolean
}) {
  const doctor = useQuery(doctorNameQuery(conversation.doctor))
  const person = useQuery({
    ...hospitalPatientQuery(conversation.patient),
    enabled: !patient,
    retry: false,
  })
  return (
    <Link
      to="/kabinet/$role/suhbat/$conversationId"
      params={{
        role: patient ? 'bemor' : 'shifokor',
        conversationId: conversation.id,
      }}
      search={{}}
      className="mt-card mt-conversation-card"
    >
      <MessageCircle size={23} aria-hidden="true" />
      <div>
        <h3 className="font-semibold">
          {patient
            ? conversation.doctor
              ? doctor.data || 'Mas’ul shifokor'
              : 'Mas’ul tayinlanmoqda'
            : person.data?.full_name ||
              'Bemor ' + conversation.patient.slice(0, 8)}
        </h3>
        <p className="mt-cell-meta">
          {conversation.status === 'CLOSED'
            ? 'Yopilgan suhbat · Tarix'
            : conversation.response_policy}
        </p>
        {conversation.response_due_at && (
          <p className="text-sm text-muted">
            Javob muddati:{' '}
            {formatTashkentDateTime(conversation.response_due_at)} (Toshkent)
          </p>
        )}
      </div>
      <span
        className={
          'mt-status mt-status-' +
          (conversation.status === 'OPEN' ? 'accepted' : 'cancelled')
        }
      >
        {conversation.status === 'OPEN' ? 'Ochiq' : 'Yopiq'}
      </span>
    </Link>
  )
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
        {role === 'shifokor' ? 'Bemor bilan suhbat' : 'Shifokor bilan suhbat'}
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
function ConversationBody({ conversation }: { conversation: Conversation }) {
  const user = useSessionStore((s) => s.user)!
  const client = useQueryClient()
  const messages = useQuery(messagesQuery(conversation.id))
  const statuses = useQuery(statusesQuery(conversation.id))
  const doctor = useQuery(doctorNameQuery(conversation.doctor))
  const patient = useQuery({ ...hospitalPatientQuery(conversation.patient), enabled: user.role === 'DOCTOR', retry: false })
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
  return (
    <>
      <section className="mt-card space-y-3 p-5">
        <h2 className="font-semibold">
          {user.role === 'DOCTOR' ? patient.data?.full_name || 'Bemor ' + conversation.patient.slice(0, 8) : conversation.doctor
            ? doctor.data || 'Mas’ul shifokor'
            : 'Mas’ul tayinlanmoqda'}
        </h2>
        <p className="text-sm text-muted">{conversation.response_policy}</p>
        {conversation.status === 'CLOSED' && (
          <p role="status" className="text-sm text-warning">
            Bu suhbat yopilgan. Tarixni ko‘rishingiz mumkin. Yangi suhbatni
            kabinetdan oching.
          </p>
        )}
        {conversation.response_due_at && (
          <p className="text-sm">
            Javob muddati:{' '}
            {formatTashkentDateTime(conversation.response_due_at)} (Toshkent).
          </p>
        )}
        {'shifts' in snapshot && (
          <details className="mt-schedule-summary">
            <summary>Shifokorning ish jadvali</summary>
            <p className="mt-2 text-sm text-muted">
              Vaqt zonasi: {snapshot.timezone}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {snapshot.shifts.map((s, i) => (
                <li key={i}>
                  {
                    [
                      'Dushanba',
                      'Seshanba',
                      'Chorshanba',
                      'Payshanba',
                      'Juma',
                      'Shanba',
                      'Yakshanba',
                    ][s.weekday]
                  }
                  : {s.start}–{s.end}
                </li>
              ))}
            </ul>
            {Object.entries(snapshot.exceptions).map(([day, intervals]) => (
              <p key={day} className="text-sm">
                {day}:{' '}
                {intervals.length
                  ? intervals.map((s) => s.start + '–' + s.end).join(', ')
                  : 'Dam olish kuni'}
              </p>
            ))}
          </details>
        )}
      </section>
      <section className="mt-card space-y-4 p-5" aria-label="Suhbat xabarlari">
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
          <ol className="mt-message-list">
            {messages.data?.map((message) => (
              <li
                key={message.id}
                className={
                  'mt-message' +
                  (message.sender === user.id ? ' mt-message-own' : '')
                }
              >
                <p className="text-xs font-semibold text-muted">
                  {message.sender === user.id
                    ? 'Siz'
                    : user.role === 'PATIENT'
                      ? 'Shifokor'
                      : 'Bemor'}
                  {message.kind === 'STATUS' ? ' · Bemor bildirgan holat' : ''}
                </p>
                <p className="whitespace-pre-wrap wrap-break-word">
                  {message.text}
                </p>
                <p className="mt-cell-meta">
                  {formatTashkentDateTime(message.sent_at)} (Toshkent) ·{' '}
                  {delivery[message.delivery_status]}
                </p>
                {message.answered_at && (
                  <p className="mt-cell-meta">
                    Javob vaqti: {formatTashkentDateTime(message.answered_at)}
                  </p>
                )}
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
      {!denied && statuses.data && statuses.data.length > 0 && (
        <section className="mt-card space-y-4 p-5">
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
        </section>
      )}
      {!denied && conversation.status === 'OPEN' && (
        <>
          <MessageForm conversationId={conversation.id} />
          {user.role === 'PATIENT' && (
            <StatusForm conversationId={conversation.id} />
          )}
        </>
      )}
    </>
  )
}
function MessageForm({ conversationId }: { conversationId: string }) {
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
      className="mt-card space-y-4 p-5"
      onSubmit={submit}
      aria-busy={mutation.isPending}
    >
      <Field label="Xabar" error={responseFieldErrors(mutation.error).text}>
        {(a11y) => (
          <textarea
            {...a11y}
            className={inputStyle}
            rows={3}
            maxLength={4000}
            ref={composer}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={mutation.isPending}
            required
          />
        )}
      </Field>
      {mutation.error && <RequestError error={mutation.error} />}
      <button
        className={primaryButton}
        disabled={mutation.isPending || !text.trim()}
      >
        {mutation.isPending ? 'Yuborilmoqda…' : 'Xabarni yuborish'}
      </button>
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
      className="mt-card space-y-4 p-5"
      onSubmit={submit}
      aria-busy={mutation.isPending}
    >
      <h2 className="text-xl font-semibold">Holatimni bildirish</h2>
      <p className="text-sm text-warning">
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
