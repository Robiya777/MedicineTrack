import { useState, type SubmitEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addCorrection,
  type Correction,
  type CorrectionInput,
} from '@/api/corrections'
import { dischargeTaskQuery, type Discharge } from '@/api/hospital'
import {
  Field,
  inputStyle,
  primaryButton,
  secondaryButton,
  RequestError,
  Notice,
} from '@/components/ui'
import { useIdempotentMutation } from '@/hooks/use-idempotent-mutation'
import { responseFieldErrors } from '@/lib/errors'
import { formatTashkentDateTime } from '@/lib/date'
import { useSessionStore } from '@/state/session'
const labels: Record<string, string> = {
  recommendations: 'Shifokor tavsiyasi',
  observation: 'Bemor holati',
  actions: 'Bajarilgan ish',
  follow_up: 'Keyingi reja',
}
export function CorrectionHistory({ items }: { items: Correction[] }) {
  return items.length > 0 ? (
    <section className="rounded-2xl border border-line bg-surface shadow-xs space-y-4 p-5">
      <h2 className="text-xl font-semibold">Sababli tuzatishlar</h2>
      <p className="text-sm text-muted">
        Original matn saqlangan. Quyidagi tuzatishlar alohida kiritilgan.
      </p>
      <ol className="space-y-5">
        {items.map((item) => (
          <li key={item.id} className="space-y-2 border-t border-line pt-4">
            <h3 className="font-semibold">
              {labels[item.field] || 'Matn tuzatishi'}
            </h3>
            <p className="whitespace-pre-wrap wrap-break-word">
              {item.correction_text}
            </p>
            <p className="whitespace-pre-wrap wrap-break-word text-sm">
              Sabab: {item.reason}
            </p>
            <time className="text-sm text-muted" dateTime={item.created_at}>
              {formatTashkentDateTime(item.created_at)} (Toshkent)
            </time>
          </li>
        ))}
      </ol>
    </section>
  ) : null
}
export function CorrectionForm({
  kind,
  id,
}: {
  kind: 'discharge' | 'report'
  id: string
}) {
  const [open, setOpen] = useState(false)
  return open ? (
    <CorrectionEditor kind={kind} id={id} close={() => setOpen(false)} />
  ) : (
    <button
      type="button"
      className={secondaryButton}
      onClick={() => setOpen(true)}
    >
      {kind === 'discharge'
        ? 'Tavsiyaga sababli tuzatish'
        : 'Hisobotga sababli tuzatish'}
    </button>
  )
}
function CorrectionEditor({
  kind,
  id,
  close,
}: {
  kind: 'discharge' | 'report'
  id: string
  close: () => void
}) {
  const client = useQueryClient(),
    mutation = useIdempotentMutation((input: CorrectionInput, key) =>
      addCorrection(kind, id, input, key),
    ),
    fields = responseFieldErrors(mutation.error)
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    const form = new FormData(event.currentTarget)
    try {
      await mutation.mutateAsync({
        field: String(form.get('field')),
        correction_text: String(form.get('text') || '').trim(),
        reason: String(form.get('reason') || '').trim(),
      })
      await Promise.all([
        client.invalidateQueries({ queryKey: ['hospital'] }),
        client.invalidateQueries({ queryKey: ['care'] }),
      ])
      close()
    } catch {
      /* Keep all correction text on failure. */
    }
  }
  return (
    <form
      className="rounded-2xl border border-line bg-surface shadow-xs space-y-4 p-5"
      onSubmit={submit}
      aria-busy={mutation.isPending}
    >
      <h2 className="text-xl font-semibold">Sababli tuzatish kiritish</h2>
      <p className="text-sm text-muted">
        Original yozuv o‘zgartirilmaydi. Tasdiqlangan matnga qo‘shimcha tuzatish
        audit bilan saqlanadi.
      </p>
      <fieldset className="space-y-4" disabled={mutation.isPending}>
        <Field label="Tuzatiladigan maydon" error={fields.field}>
          {(a) => (
            <select {...a} name="field" className={inputStyle}>
              {(kind === 'discharge'
                ? ['recommendations']
                : ['observation', 'actions', 'follow_up']
              ).map((field) => (
                <option value={field} key={field}>
                  {labels[field]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Tuzatilgan matn" error={fields.correction_text}>
          {(a) => (
            <textarea
              {...a}
              name="text"
              className={inputStyle}
              rows={4}
              required
              maxLength={10000}
            />
          )}
        </Field>
        <Field label="Tuzatish sababi" error={fields.reason}>
          {(a) => (
            <textarea
              {...a}
              name="reason"
              className={inputStyle}
              rows={2}
              required
              maxLength={4000}
            />
          )}
        </Field>
      </fieldset>
      {mutation.error && <RequestError error={mutation.error} />}
      <div className="flex flex-wrap gap-3">
        <button className={primaryButton} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saqlanmoqda…' : 'Tuzatishni saqlash'}
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
export function DischargeCorrections({ discharge }: { discharge: Discharge }) {
  const user = useSessionStore((s) => s.user),
    task = useQuery(dischargeTaskQuery(discharge))
  if (discharge.status !== 'CONFIRMED') return null
  return (
    <div className="space-y-4">
      {user?.role === 'COORDINATOR' && (
        <CorrectionForm kind="discharge" id={discharge.id} />
      )}
      {task.isPending && <Notice>Tuzatishlar tekshirilmoqda…</Notice>}
      {task.isError && (
        <RequestError error={task.error} retry={() => void task.refetch()} />
      )}
      {task.data && !task.isError && (
        <CorrectionHistory
          items={task.data.corrections.filter(
            (item) => item.field === 'recommendations',
          )}
        />
      )}
    </div>
  )
}
