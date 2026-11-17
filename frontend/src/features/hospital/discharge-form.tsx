import { useQueryClient } from '@tanstack/react-query'
import { useState, type SubmitEvent } from 'react'
import {
  hospitalQueryKeys, saveDischarge, type Discharge, type DischargeInput, type HospitalPatient,
} from '../../api/hospital'
import { parseTashkentInput, tashkentInputValue } from './format'
import { responseFieldErrors, useIdempotentMutation } from './mutation'
import { Field, inputStyle, primaryButton, RequestError, secondaryButton } from './ui'

export function DischargeForm({ patient, draft, onSaved, cancel }: {
  patient: Pick<HospitalPatient, 'id' | 'full_name'>
  draft?: Discharge
  onSaved: (discharge: Discharge) => void
  cancel: () => void
}) {
  const queryClient = useQueryClient()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [initialDate] = useState(() => tashkentInputValue(draft ? new Date(draft.discharged_at) : new Date()))
  const mutation = useIdempotentMutation((input: DischargeInput, key) => saveDischarge(
    input, draft ? { id: draft.id } : { patient: patient.id }, key,
  ))

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitted || mutation.isPending) return

    const form = new FormData(event.currentTarget)
    const localTime = String(form.get('discharged_at') ?? '')
    const date = parseTashkentInput(localTime)
    const followUp = String(form.get('follow_up_reason') ?? '').trim()
    const recommendations = String(form.get('recommendations') ?? '').trim()
    const errors: Record<string, string> = {}
    if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now()) {
      errors.discharged_at = 'Chiqarilgan vaqtni kiriting. U kelajakda bo‘lmasligi kerak.'
    }
    if (!followUp) errors.follow_up_reason = 'Kuzatuvga olish asosini kiriting.'
    if (!recommendations) errors.recommendations = 'Shifokor tavsiyasini kiriting.'
    setErrors(errors)
    mutation.reset()
    if (Object.keys(errors).length) return

    try {
      const saved = await mutation.mutateAsync({
        discharged_at: draft && date.getTime() === parseTashkentInput(initialDate).getTime() ? draft.discharged_at : date.toISOString(),
        follow_up_reason: followUp,
        recommendations,
      })
      setSubmitted(true)
      queryClient.setQueryData(hospitalQueryKeys.discharge(saved.id), saved)
      void queryClient.invalidateQueries({ queryKey: hospitalQueryKeys.discharges })
      onSaved(saved)
    } catch {
      // React Query keeps the error and the form values stay available for a retry.
    }
  }

  const fieldErrors = { ...responseFieldErrors(mutation.error), ...errors }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-line bg-white p-5 sm:p-6" aria-busy={mutation.isPending}>
      <div>
        <h2 className="text-xl font-semibold">{draft ? 'Chiqarishni tahrirlash' : 'Chiqarish ma’lumotlari'}</h2>
        <p className="mt-1 wrap-break-word text-sm text-muted">{patient.full_name}</p>
      </div>
      <Field label="Haqiqiy chiqarish vaqti" error={fieldErrors.discharged_at} hint="Toshkent vaqti. Patronaj muddati shu paytdan hisoblanadi.">
        {(a11y) => (
          <input {...a11y} className={inputStyle} name="discharged_at" type="datetime-local" step="1" defaultValue={initialDate} required />
        )}
      </Field>
      <Field label="Kuzatuvga olish asosi" error={fieldErrors.follow_up_reason}>
        {(a11y) => (
          <textarea {...a11y} className={inputStyle} name="follow_up_reason" defaultValue={draft?.follow_up_reason} rows={2} required />
        )}
      </Field>
      <Field label="Shifokor tavsiyasi" error={fieldErrors.recommendations}>
        {(a11y) => (
          <textarea {...a11y} className={inputStyle} name="recommendations" defaultValue={draft?.recommendations} rows={3} required />
        )}
      </Field>
      {mutation.error && <RequestError error={mutation.error} />}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={primaryButton} disabled={mutation.isPending || submitted}>
          {mutation.isPending ? 'Saqlanmoqda…' : draft ? 'O‘zgarishlarni saqlash' : 'Loyihani saqlash va tekshirish'}
        </button>
        <button type="button" className={secondaryButton} onClick={cancel} disabled={mutation.isPending || submitted}>
          {draft ? 'Bekor qilish' : 'Bemor tanlashga qaytish'}
        </button>
      </div>
    </form>
  )
}
