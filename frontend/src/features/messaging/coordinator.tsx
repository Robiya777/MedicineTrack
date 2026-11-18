import { ScheduleCalendar } from './schedule-calendar'
import { Save, Globe2, RefreshCw, Clock3, MessageCircle, Stethoscope, TriangleAlert, UserRound } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type SubmitEvent } from 'react'
import { doctorName, doctorsQuery } from '@/api/tasks'
import { doctorNameQuery, hospitalPatientQuery } from '@/api/hospital'
import {
  saveSchedule,
  scheduleQuery,
  unansweredQuery,
  type ScheduleInput,
} from '@/api/messaging'
import {
  PageHeader,
  Field,
  inputStyle,
  Notice,
  primaryButton,
  RequestError,
  secondaryButton,
} from '@/components/ui'
import {
  responseFieldErrors,
} from '@/lib/errors'
import {
  useIdempotentMutation,
} from '@/hooks/use-idempotent-mutation'
import { formatTashkentDateTime } from '@/lib/date'
const weekdays = [
  'Dushanba',
  'Seshanba',
  'Chorshanba',
  'Payshanba',
  'Juma',
  'Shanba',
  'Yakshanba',
]
type Interval = { start: string; end: string }
const defaultInput: ScheduleInput = {
  timezone: 'Asia/Tashkent',
  shifts: [],
  exceptions: {},
}
export function SchedulePage() {
  const doctors = useQuery(doctorsQuery())
  const [id, setId] = useState('')
  const schedule = useQuery({ ...scheduleQuery(id), enabled: Boolean(id) })
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-semibold tracking-tight">Shifokor ish jadvali</h1>
        <p className="mt-1 text-sm text-muted">Ish vaqti va istisno kunlarini belgilang.</p></div>
      <div className="w-full sm:w-64">
        <Field label="Shifokor">
          {(a11y) => (
            <select
              {...a11y}
              className={inputStyle}
              value={id}
              onChange={(e) => setId(e.target.value)}
            >
              <option value="">Shifokorni tanlang</option>
              {doctors.data?.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctorName(doctor)}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      </header>
      {doctors.isError && (
        <RequestError
          error={doctors.error}
          retry={() => void doctors.refetch()}
        />
      )}
      {id && schedule.isPending && <Notice>Jadval yuklanmoqda…</Notice>}
      {id && schedule.isError && (
        <RequestError
          error={schedule.error}
          retry={() => void schedule.refetch()}
        />
      )}
      {id && schedule.isSuccess && (
        <ScheduleEditor
          key={id + ':' + (schedule.data?.version || 0)}
          doctorId={id}
          initial={schedule.data || defaultInput}
        />
      )}
    </section>
  )
}
function ScheduleEditor({
  doctorId,
  initial,
}: {
  doctorId: string
  initial: ScheduleInput
}) {
  const client = useQueryClient()
  const [input, setInput] = useState<ScheduleInput>(initial)
  const [tab, setTab] = useState<'week' | 'exceptions'>('week')
  const [dirty, setDirty] = useState(false)
  const [day, setDay] = useState('')
  const [error, setError] = useState('')
  const mutation = useIdempotentMutation((data: ScheduleInput, key) =>
    saveSchedule(doctorId, data, key),
  )
  const [saved, setSaved] = useState(false)
  function change(value: ScheduleInput) {
    setDirty(true)
    setInput(value)
    setSaved(false)
  }
  function validate(intervals: Interval[]) {
    const sorted = [...intervals].sort((a, b) => a.start.localeCompare(b.start))
    return sorted.some(
      (item, i) =>
        !item.start ||
        !item.end ||
        item.start >= item.end ||
        (i > 0 && sorted[i - 1].end > item.start),
    )
  }
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    if (
      weekdays.some((_, day) =>
        validate(input.shifts.filter((s) => s.weekday === day)),
      ) ||
      Object.values(input.exceptions).some(validate)
    ) {
      setError(
        'Ish oraliqlari tugashdan oldin boshlanishi va ustma-ust kelmasligi kerak.',
      )
      return
    }
    setError('')
    try {
      await mutation.mutateAsync(input)
      setSaved(true)
      setDirty(false)
      void client.invalidateQueries({
        queryKey: ['messaging', 'conversations'],
      })
      void client.invalidateQueries({ queryKey: ['messaging', 'conversation'] })
    } catch {
      /* Preserve the edited schedule. */
    }
  }
  return (
    <form
      className="space-y-5"
      onSubmit={submit}
      aria-busy={mutation.isPending}
    >
      <div className="sticky top-20 z-30 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface/95 p-2 shadow-xs backdrop-blur-sm">
        <div className="flex rounded-lg bg-page p-1">{(['week','exceptions'] as const).map(value=><button type="button" key={value} disabled={mutation.isPending} aria-pressed={tab===value} onClick={()=>setTab(value)} className={`min-h-10 rounded-md px-3 text-sm font-semibold ${tab===value ? 'bg-surface text-primary shadow-xs' : 'text-muted'}`}>{value==='week' ? 'Haftalik tartib' : 'Istisno kunlar'}</button>)}</div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
        <details className="relative text-sm"><summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-xs text-muted hover:bg-page"><Globe2 size={16} aria-hidden="true" />{input.timezone}</summary><div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-line bg-surface p-4 shadow-lg"><Field
          label="Vaqt zonasi"
          hint="IANA nomi, masalan Asia/Tashkent."
          error={responseFieldErrors(mutation.error).timezone}
        >
          {(a11y) => (
            <input
              {...a11y}
              className={inputStyle}
              value={input.timezone}
              onChange={(e) => change({ ...input, timezone: e.target.value })}
              required
            />
          )}
        </Field>
        </div></details>
          <span role="status" className="hidden text-xs text-warning lg:block">{dirty ? 'Saqlanmagan' : ''}</span>
          <button type="submit" className={primaryButton} disabled={mutation.isPending}><Save size={16} aria-hidden="true" />{mutation.isPending ? 'Saqlanmoqda…' : 'Saqlash'}</button>
        </div>
      </div>
      <fieldset className="min-w-0 space-y-5" disabled={mutation.isPending}>
        {tab === 'week' && <ScheduleCalendar intervals={input.shifts} change={shifts=>change({...input,shifts})} />}
        <div className={`space-y-4 ${tab !== 'exceptions' ? 'hidden' : ''}`}>
          <h2 className="text-xl font-semibold">Istisno kunlar</h2>
          <p className="text-sm text-muted">
            Oraliqlarsiz istisno — dam olish kuni.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Istisno sana">
              {(a11y) => (
                <input
                  {...a11y}
                  className={inputStyle}
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              )}
            </Field>
            <button
              type="button"
              className={secondaryButton}
              disabled={!day || Object.hasOwn(input.exceptions, day)}
              onClick={() => {
                change({
                  ...input,
                  exceptions: { ...input.exceptions, [day]: [] },
                })
                setDay('')
              }}
            >
              Istisno qo‘shish
            </button>
          </div>
          {Object.entries(input.exceptions)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, intervals]) => (
              <div
                key={date}
                className="space-y-3 rounded-lg border border-line p-4"
              >
                <IntervalEditor
                  label={date}
                  intervals={intervals}
                  change={(intervals) =>
                    change({
                      ...input,
                      exceptions: { ...input.exceptions, [date]: intervals },
                    })
                  }
                />
                <button
                  type="button"
                  className="min-h-11 rounded-lg px-3 text-sm font-medium text-danger hover:bg-danger-wash"
                  onClick={() => {
                    const next = { ...input.exceptions }
                    delete next[date]
                    change({ ...input, exceptions: next })
                  }}
                >
                  Istisnoni o‘chirish
                </button>
              </div>
            ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
      {mutation.error && <RequestError error={mutation.error} />}
      {saved && (
        <p role="status" className="text-sm text-action">
          Jadval saqlandi. Oldingi javobsiz murojaatlarning muddati o‘zgarmaydi.
        </p>
      )}
    </form>
  )
}
function IntervalEditor({
  label,
  intervals,
  change,
}: {
  label: string
  intervals: Interval[]
  change: (value: Interval[]) => void
}) {
  return <ScheduleCalendar singleLabel={label} intervals={intervals.map(i=>({...i,weekday:0}))} change={values=>change(values.map(({start,end})=>({start,end})))} />
}
export function UnansweredPage() {
  const query = useQuery(unansweredQuery())
  const [filter, setFilter] = useState<'ALL' | 'WORSENED' | 'OVERDUE'>('ALL')
  const rows = query.data
    ?.toSorted(
      (a, b) =>
        Number(b.priority === 'WORSENED') - Number(a.priority === 'WORSENED') ||
        Number(b.overdue) - Number(a.overdue) ||
        a.first_unanswered_at.localeCompare(b.first_unanswered_at),
    )
    .filter(
      (item) =>
        filter === 'ALL' ||
        (filter === 'WORSENED' ? item.priority === 'WORSENED' : item.overdue),
    )
  return (
    <section className="space-y-5">
      <PageHeader title="Javobsiz murojaatlar" description="Bemor xabarlari va javob muddatlarini kuzating."
        action={<button type="button" className={secondaryButton} disabled={query.isFetching} onClick={() => void query.refetch()}>
          <RefreshCw size={17} className={query.isFetching ? 'motion-safe:animate-spin' : undefined} aria-hidden="true" />
          Yangilash
        </button>} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1" role="group" aria-label="Murojaat filtri">
          {([['ALL', 'Barchasi'], ['WORSENED', 'Yomonlashdi'], ['OVERDUE', 'Kechikkan']] as const).map(([value, label]) => (
            <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${filter === value ? 'bg-mint text-primary-hover' : 'text-muted hover:bg-page'}`}>
              {label}
              <span className="rounded-md bg-page px-1.5 py-0.5 text-xs tabular-nums">{query.data?.filter(item => value === 'ALL' || (value === 'WORSENED' ? item.priority === 'WORSENED' : item.overdue)).length ?? '—'}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">Avval yomonlashgan va kechikkan murojaatlar</p>
      </div>
      {query.isPending && <Notice>Murojaatlar yuklanmoqda…</Notice>}
      {query.isError && (
        <RequestError error={query.error} retry={() => void query.refetch()} />
      )}
      {rows?.length === 0 && (
        <Notice>Tanlangan filtrda javobsiz murojaat yo‘q.</Notice>
      )}
      {!query.isError &&
        rows?.map((item) => (
          <UnansweredCard key={item.episode_id} item={item} />
        ))}
    </section>
  )
}
function UnansweredCard({
  item,
}: {
  item: {
    patient_id: string
    doctor_id: string | null
    priority: string
    overdue: boolean
    schedule_missing: boolean
    first_unanswered_at: string
    response_due_at: string | null
  }
}) {
  const patient = useQuery({
    ...hospitalPatientQuery(item.patient_id),
    retry: false,
  })
  const doctor = useQuery(doctorNameQuery(item.doctor_id))
  return (
    <article className="rounded-2xl border border-line bg-surface p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-mint text-primary"><UserRound size={21} aria-hidden="true" /></span>
          <div className="min-w-0">
            <h2 className="break-words text-base font-semibold text-ink">{patient.data?.full_name || 'Bemor ' + item.patient_id.slice(0, 8)}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><Stethoscope size={15} className="shrink-0" aria-hidden="true" />{item.doctor_id ? doctor.data || 'Shifokor yuklanmoqda…' : 'Mas’ul tayinlanmagan'}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${item.priority === 'WORSENED' ? 'bg-danger-wash text-danger' : item.overdue ? 'bg-warning-wash text-warning' : 'bg-blue-wash text-blue'}`}>
          {item.priority === 'WORSENED' || item.overdue ? <TriangleAlert size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}
          {item.priority === 'WORSENED' ? 'Yomonlashdi' : item.overdue ? 'Kechikkan' : 'Javob kutilmoqda'}
        </span>
      </div>
      <dl className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
        <div><dt className="flex items-center gap-2 text-xs text-muted"><MessageCircle size={15} aria-hidden="true" />Birinchi javobsiz xabar</dt><dd className="mt-2 text-sm font-medium">{formatTashkentDateTime(item.first_unanswered_at)}</dd></div>
        <div><dt className="flex items-center gap-2 text-xs text-muted"><Clock3 size={15} aria-hidden="true" />Javob muddati</dt><dd className={`mt-2 text-sm font-medium ${item.overdue ? 'text-danger' : 'text-ink'}`}>{item.response_due_at ? formatTashkentDateTime(item.response_due_at) : 'Belgilanmagan'}</dd></div>
      </dl>
      {(!item.response_due_at || item.schedule_missing) && <p className="mt-4 flex items-start gap-2 rounded-lg bg-warning-wash p-3 text-xs leading-5 text-warning"><TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />Shifokorning ish jadvalini tekshiring: javob muddati belgilanmagan.</p>}
    </article>
  )
}
