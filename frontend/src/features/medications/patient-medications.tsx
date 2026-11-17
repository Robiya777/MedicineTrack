import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type SubmitEvent } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import {
  changePlan,
  createPlan,
  historyQuery,
  medicationKeys,
  occurrencesQuery,
  plansQuery,
  saveRecord,
  type Plan,
  type Occurrence,
  type RecordInput,
} from '../../api/medications'
import { useSessionStore } from '../../state/session'
import {
  Field,
  inputStyle,
  Notice,
  primaryButton,
  RequestError,
  secondaryButton,
  Facts,
} from '../../components/ui'
import {
  useIdempotentMutation,
} from '../../hooks/use-idempotent-mutation'
import {
  responseFieldErrors,
} from '../../lib/errors'
import {
  formatTashkentDateTime,
  parseTashkentInput,
  tashkentInputValue,
} from '../../lib/date'
import { MedicationEditor } from './editor'
const route = getRouteApi('/(app)/kabinet/$role/dorilar/$patientId/')
const statuses = {
  DRAFT: 'Loyiha',
  ACTIVE: 'Faol',
  STOPPED: 'To‘xtatilgan',
  COMPLETED: 'Kurs tugagan',
}
const doseStatuses = {
  UPCOMING: 'Vaqti kelmagan',
  UNRECORDED: 'Qayd kiritilmagan',
  CANCELLED: 'Bekor qilingan',
  TAKEN: 'Ichdim',
  SKIPPED: 'O‘tkazib yubordim',
  NOT_AVAILABLE: 'Qabul tarixi uchun ruxsat yo‘q',
}
function today() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tashkent' }).format(
    new Date(),
  )
}
export function MedicationPage() {
  const { patientId } = route.useParams()
  return <MedicationPanel patientId={patientId} />
}
export function MedicationPanel({
  patientId,
  dischargeId,
}: {
  patientId: string
  dischargeId?: string
}) {
  const Heading = dischargeId ? 'h2' : 'h1'
  const user = useSessionStore((s) => s.user)!,
    client = useQueryClient(),
    plans = useQuery(plansQuery(patientId))
  const [creating, setCreating] = useState(false),
    [day, setDay] = useState(today),
    [history, setHistory] = useState(false),
    [discharge, setDischarge] = useState(dischargeId || '')
  async function refresh() {
    await client.invalidateQueries({ queryKey: medicationKeys })
  }
  return (
    <section className="space-y-5">
      <div className="mt-page-heading">
        <div>
          <Heading>Dori jadvali</Heading>
          <p>
            {user.role === 'PATIENT'
              ? 'Shifokor tasdiqlagan jadval va o‘zingiz bildirgan qabul qaydlari.'
              : 'Mavjud ko‘rsatma asosidagi dori jadvali va klinik versiyalar.'}
          </p>
        </div>
        <button className={secondaryButton} onClick={() => void refresh()}>
          Yangilash
        </button>
      </div>
      {plans.isPending && <Notice>Jadvallar yuklanmoqda…</Notice>}
      {plans.isError && (
        <RequestError error={plans.error} retry={() => void plans.refetch()} />
      )}
      {!plans.isError && (
        <>
          {user.role !== 'PATIENT' && (
            <div className="mt-card space-y-4 p-5">
              {!dischargeId && (
                <Field label="Chiqarish UUIDsi">
                  {(a) => (
                    <input
                      {...a}
                      className={inputStyle}
                      value={discharge}
                      onChange={(e) => setDischarge(e.target.value)}
                      placeholder="Jadval bog‘lanadigan chiqarish"
                    />
                  )}
                </Field>
              )}
              <button
                className={primaryButton}
                disabled={!discharge || creating}
                onClick={() => setCreating(true)}
              >
                Yangi dori jadvali
              </button>
            </div>
          )}
          {creating && (
            <MedicationEditor
              initial={[]}
              close={() => setCreating(false)}
              save={async (items, key) => {
                await createPlan(patientId, discharge, items, key)
                await refresh()
              }}
            />
          )}
          {user.role === 'PATIENT' && (
            <div className="mt-card space-y-4 p-5">
              <h2 className="text-xl font-semibold">Bugungi dorilar</h2>
              <Field label="Jadval sanasi (har dorining vaqt zonasida)">
                {(a) => (
                  <input
                    {...a}
                    className={inputStyle}
                    type="date"
                    value={day}
                    required
                    onChange={(e) => setDay(e.target.value || today())}
                  />
                )}
              </Field>
              <p className="text-sm text-muted">
                Ekrandagi vaqt tasdiqlangan jadval zonasida. Web sahifa fon yoki
                yopiq holatda lokal eslatma bermaydi.
              </p>
            </div>
          )}
          {plans.data?.rows.length === 0 && (
            <Notice>Tasdiqlangan dori jadvali hali yo‘q.</Notice>
          )}
          {plans.data?.rows.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              day={day}
              refresh={refresh}
            />
          ))}
          {['PATIENT', 'DOCTOR'].includes(user.role) && (
            <section className="mt-card space-y-4 p-5">
              <button
                className={secondaryButton}
                onClick={() => setHistory(!history)}
                aria-expanded={history}
              >
                Qabul tarixini {history ? 'yopish' : 'ochish'}
              </button>
              {history && <History patientId={patientId} />}
            </section>
          )}
        </>
      )}
    </section>
  )
}
function PlanCard({
  plan,
  day,
  refresh,
}: {
  plan: Plan
  day: string
  refresh: () => Promise<void>
}) {
  const user = useSessionStore((s) => s.user)!,
    [edit, setEdit] = useState<Plan | null>(null),
    [action, setAction] = useState<'approve' | 'revisions' | 'stop' | null>(
      null,
    )
  return (
    <article className="mt-card space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">
          Jadval · {plan.version}-versiya
        </h2>
        <span
          className={
            'mt-status mt-status-' +
            (plan.status === 'ACTIVE'
              ? 'accepted'
              : plan.status === 'DRAFT'
                ? 'unassigned'
                : 'completed')
          }
        >
          {statuses[plan.status]}
        </span>
      </div>
      <p className="break-all text-xs text-muted">{plan.id}</p>
      {plan.items.map((item) => (
        <section key={item.id} className="space-y-3 border-t border-line pt-4">
          <h3 className="font-semibold">
            {item.name || 'Nomi kiritilmagan dori'}
          </h3>
          <Facts
            items={[
              {
                label: 'Ko‘rsatmadagi doza',
                value: item.prescribed_dose_text || 'Kiritilmagan',
              },
              { label: 'Qabul yo‘li', value: item.route || 'Kiritilmagan' },
              {
                label: 'Kurs',
                value:
                  (item.start_date || '—') + ' — ' + (item.end_date || '—'),
              },
              {
                label: 'Qabul vaqtlari',
                value: item.local_times.join(', ') + ' · ' + item.timezone,
              },
              { label: 'Ko‘rsatma', value: item.instructions || '—' },
              {
                label: 'Manba',
                value: item.source_reference || 'Kiritilmagan',
              },
            ]}
          />
          {item.needs_clarification && (
            <p className="text-warning">
              Aniqlashtirish kerak:{' '}
              {item.clarification_reason || 'Sabab kiritilmagan'}
            </p>
          )}
          {item.missing_fields.length > 0 && (
            <p className="text-sm text-warning">
              To‘ldirilmagan maydonlar: {item.missing_fields.map(field => (({name:'Dori nomi',prescribed_dose_text:'Doza',route:'Qabul yo‘li',source_reference:'Manba',start_date:'Boshlanish sanasi',end_date:'Tugash sanasi',timezone:'Vaqt zonasi',local_times:'Qabul vaqtlari'} as Record<string,string>)[field] || 'Ko‘rsatma')).join(', ')}
            </p>
          )}
        </section>
      ))}
      {plan.stop_reason && (
        <p className="text-sm">To‘xtatish sababi: {plan.stop_reason === 'SUPERSEDED' ? 'Yangi versiya bilan almashtirilgan' : plan.stop_reason}</p>
      )}
      {user.role !== 'PATIENT' && (
        <div className="flex flex-wrap gap-3">
          {plan.status === 'DRAFT' && (
            <button className={secondaryButton} onClick={() => setEdit(plan)}>
              Loyihani tahrirlash
            </button>
          )}
          {user.role === 'DOCTOR' && (
            <>
              {plan.status === 'DRAFT' &&
                user.can_approve_medication_schedule && (
                  <button
                    className={primaryButton}
                    onClick={() => setAction('approve')}
                  >
                    Klinik tasdiqlash
                  </button>
                )}
              {plan.status === 'ACTIVE' && (
                <>
                  <button
                    className={secondaryButton}
                    onClick={() => setAction('revisions')}
                  >
                    Yangi versiya yaratish
                  </button>
                  <button
                    className="mt-button mt-button-danger"
                    onClick={() => setAction('stop')}
                  >
                    Jadvalni to‘xtatish
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
      {edit && (
        <MedicationEditor
          key={plan.id + ':edit'}
          initial={plan.items}
          close={() => setEdit(null)}
          save={async (items, key) => {
            await changePlan(edit, 'edit', { items }, key)
            await refresh()
          }}
        />
      )}
      {action && (
        <PlanAction
          plan={plan}
          action={action}
          close={() => setAction(null)}
          refresh={refresh}
        />
      )}
      {plan.status !== 'DRAFT' && ['PATIENT', 'DOCTOR'].includes(user.role) && (
        <Occurrences plan={plan} day={day} />
      )}
    </article>
  )
}
function PlanAction({
  plan,
  action,
  close,
  refresh,
}: {
  plan: Plan
  action: 'approve' | 'revisions' | 'stop'
  close: () => void
  refresh: () => Promise<void>
}) {
  const [base] = useState(plan),
    mutation = useIdempotentMutation((reason: string, key) =>
      changePlan(base, action, action === 'stop' ? { reason } : {}, key),
    )
  const conflict =
    isAxiosError(mutation.error) && mutation.error.response?.status === 409
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (mutation.isPending || conflict) return
    try {
      await mutation.mutateAsync(
        String(new FormData(e.currentTarget).get('reason') || '').trim(),
      )
      await refresh()
      close()
    } catch {
      if (conflict) void refresh()
    }
  }
  return (
    <form
      className="space-y-4 rounded-lg border border-line p-4"
      onSubmit={submit}
    >
      <p>
        {action === 'approve'
          ? 'Ko‘rsatma manbasi, doza, kurs, zona va barcha vaqtlarni tekshirib tasdiqlang.'
          : action === 'revisions'
            ? 'Yangi loyiha tasdiqlanguncha hozirgi jadval faol qoladi.'
            : 'Kelajakdagi qabullar bekor qilinadi, tarix saqlanadi.'}
      </p>
      {action === 'stop' && (
        <Field label="To‘xtatish sababi">
          {(a) => (
            <textarea
              {...a}
              className={inputStyle}
              name="reason"
              required
              maxLength={4000}
              disabled={mutation.isPending}
            />
          )}
        </Field>
      )}
      {mutation.error && <RequestError error={mutation.error} />}
      {conflict && (
        <p role="alert" className="text-warning">
          Jadval o‘zgargan. Yopib, Yangilash orqali joriy versiyani tekshiring.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          className={primaryButton}
          disabled={mutation.isPending || conflict}
        >
          {mutation.isPending ? 'Yuborilmoqda…' : 'Amalni tasdiqlash'}
        </button>
        <button
          type="button"
          className={secondaryButton}
          disabled={mutation.isPending}
          onClick={close}
        >
          Bekor qilish
        </button>
      </div>
    </form>
  )
}
function Occurrences({ plan, day }: { plan: Plan; day: string }) {
  const query = useQuery(occurrencesQuery(plan, day))
  return (
    <section className="space-y-4">
      <h3 className="font-semibold">Rejalashtirilgan qabullar</h3>
      {query.isPending && <Notice>Qabullar yuklanmoqda…</Notice>}
      {query.isError && (
        <RequestError error={query.error} retry={() => void query.refetch()} />
      )}
      {!query.isError &&
        query.data?.rows.map((item) => (
          <OccurrenceCard
            key={item.id}
            item={item}
            serverTime={query.data.serverTime}
          />
        ))}
      {query.data?.rows.length === 0 && (
        <Notice>Tanlangan sanada qabul yo‘q.</Notice>
      )}
    </section>
  )
}
function History({ patientId }: { patientId: string }) {
  const [day, setDay] = useState(''),
    query = useQuery(historyQuery(patientId, day))
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Bemor bildirgan qabul tarixi</h2>
      <Field label="Tarix sanasi (bo‘sh — barcha sanalar)">
        {(a) => (
          <input
            {...a}
            className={inputStyle}
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        )}
      </Field>
      {query.isPending && <Notice>Tarix yuklanmoqda…</Notice>}
      {query.isError && (
        <RequestError error={query.error} retry={() => void query.refetch()} />
      )}
      {!query.isError &&
        query.data?.rows.map((item) => (
          <OccurrenceCard
            key={item.id}
            item={item}
            serverTime={query.data.serverTime}
          />
        ))}
      {query.data?.rows.length === 0 && (
        <Notice>Qabul tarixi hali yo‘q.</Notice>
      )}
    </section>
  )
}
function OccurrenceCard({
  item,
  serverTime,
}: {
  item: Occurrence
  serverTime: string
}) {
  const user = useSessionStore((s) => s.user)!,
    [editing, setEditing] = useState(false)
  const due = Date.parse(item.scheduled_at) <= Date.parse(serverTime),
    allowed =
      user.role === 'PATIENT' &&
      due &&
      (!item.cancelled_at || Boolean(item.record))
  return (
    <article className="space-y-3 rounded-lg border border-line p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <h4 className="font-semibold">{item.item_details.name}</h4>
        <span className="mt-status">{doseStatuses[item.status]}</span>
      </div>
      <p className="text-sm">
        {new Intl.DateTimeFormat('sv-SE', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: item.item_details.timezone,
        }).format(new Date(item.scheduled_at))}{' '}
        · {item.item_details.timezone}
      </p>
      <p className="text-sm">
        {item.item_details.prescribed_dose_text} · {item.item_details.route}
      </p>
      {item.record && (
        <div className="space-y-2">
          <p className="text-sm">
            Bemor bildirgan qayd · Server qabul qildi:{' '}
            {formatTashkentDateTime(item.record.server_received_at)} (Toshkent)
          </p>
          {item.record.reported_taken_at && (
            <p className="text-sm">
              Bemor kiritgan qabul vaqti:{' '}
              {formatTashkentDateTime(item.record.reported_taken_at)} (Toshkent)
            </p>
          )}
          <p className="whitespace-pre-wrap text-sm">{item.record.note}</p>
          {item.record.late_recorded && (
            <p className="text-sm text-muted">
              Qayd keyinroq hujjatlashtirilgan.
            </p>
          )}
          {item.record.recorded_against_inactive_plan && (
            <p className="text-sm text-warning">
              Faol bo‘lmagan jadvalga tegishli tarixiy qayd.
            </p>
          )}
          <details>
            <summary className="flex min-h-11 cursor-pointer items-center text-sm text-action">
              Original va tuzatishlar
            </summary>
            <p className="text-sm">
              Original: {doseStatuses[item.record.original.result]} ·{' '}
              {item.record.original.note}
            </p>
            {item.record.corrections.map((c) => (
              <p key={c.id} className="text-sm">
                {c.version}-tuzatish: {doseStatuses[c.result]} · Sabab:{' '}
                {c.reason} · {formatTashkentDateTime(c.created_at)}
              </p>
            ))}
          </details>
        </div>
      )}
      {allowed && (
        <button
          className={secondaryButton}
          onClick={() => setEditing(!editing)}
        >
          {item.record ? 'Qaydni tuzatish' : 'Qabulni qayd etish'}
        </button>
      )}
      {editing && allowed && (
        <RecordForm item={item} close={() => setEditing(false)} />
      )}
    </article>
  )
}
function RecordForm({ item, close }: { item: Occurrence; close: () => void }) {
  const client = useQueryClient(),
    [result, setResult] = useState<'TAKEN' | 'SKIPPED'>(
      item.record?.result || 'TAKEN',
    ),
    [error, setError] = useState(''),
    [base] = useState(item),
    [initial] = useState(() => tashkentInputValue(new Date()))
  const snapshot = useRef<{ fingerprint: string; recordedAt: string } | null>(
    null,
  )
  const mutation = useIdempotentMutation(
    (input: { record: RecordInput; reason: string }, key) =>
      saveRecord(base, input.record, input.reason, key),
  )
  const conflict =
    isAxiosError(mutation.error) && mutation.error.response?.status === 409
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (mutation.isPending || conflict) return
    const f = new FormData(e.currentTarget),
      now = new Date(),
      taken =
        result === 'TAKEN' ? parseTashkentInput(String(f.get('taken'))) : null
    if (
      taken &&
      (!Number.isFinite(taken.getTime()) ||
        taken > now ||
        taken.getTime() < Date.parse(item.scheduled_at))
    ) {
      setError(
        'Qabul vaqti rejalashtirilgan vaqt va hozirgi vaqt orasida bo‘lishi kerak.',
      )
      return
    }
    setError('')
    const fingerprint = JSON.stringify({
      result,
      taken: taken?.toISOString(),
      note: f.get('note'),
      reason: f.get('reason'),
    })
    if (snapshot.current?.fingerprint !== fingerprint)
      snapshot.current = { fingerprint, recordedAt: now.toISOString() }
    try {
      await mutation.mutateAsync({
        record: {
          plan_version: item.plan_version,
          result,
          reported_taken_at: taken?.toISOString() || null,
          client_recorded_at: snapshot.current.recordedAt,
          note: String(f.get('note') || '').trim(),
        },
        reason: String(f.get('reason') || '').trim(),
      })
      await client.invalidateQueries({ queryKey: medicationKeys })
      close()
    } catch {
      /* Keep form and original idempotency payload. */
    }
  }
  return (
    <form className="space-y-4 border-t border-line pt-4" onSubmit={submit}>
      <fieldset className="space-y-4" disabled={mutation.isPending || conflict}>
        <Field label="Qabul natijasi">
          {(a) => (
            <select
              {...a}
              className={inputStyle}
              value={result}
              onChange={(e) => setResult(e.target.value as 'TAKEN' | 'SKIPPED')}
            >
              <option value="TAKEN">Ichdim</option>
              <option value="SKIPPED">O‘tkazib yubordim</option>
            </select>
          )}
        </Field>
        {result === 'TAKEN' && (
          <Field label="Qabul vaqti (Toshkent)" error={error}>
            {(a) => (
              <input
                {...a}
                className={inputStyle}
                name="taken"
                type="datetime-local"
                step="1"
                defaultValue={initial}
                required
              />
            )}
          </Field>
        )}
        <Field label="Qabul izohi">
          {(a) => (
            <textarea
              {...a}
              name="note"
              className={inputStyle}
              defaultValue={base.record?.note || ''}
              maxLength={4000}
            />
          )}
        </Field>
        {base.record && (
          <Field label="Tuzatish sababi">
            {(a) => (
              <textarea
                {...a}
                name="reason"
                className={inputStyle}
                required
                maxLength={4000}
              />
            )}
          </Field>
        )}
      </fieldset>
      {Object.values(responseFieldErrors(mutation.error)).map((text, i) => (
        <p key={i} role="alert" className="text-red-800">
          {text}
        </p>
      ))}
      {mutation.error && <RequestError error={mutation.error} />}
      {conflict && (
        <p role="alert">
          Qayd o‘zgargan. Formani yopib, ro‘yxatni yangilang va qayta
          tekshiring.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          className={primaryButton}
          disabled={mutation.isPending || conflict}
        >
          {mutation.isPending ? 'Yuborilmoqda…' : 'Qaydni saqlash'}
        </button>
        <button
          type="button"
          className={secondaryButton}
          disabled={mutation.isPending}
          onClick={close}
        >
          Bekor qilish
        </button>
      </div>
    </form>
  )
}
