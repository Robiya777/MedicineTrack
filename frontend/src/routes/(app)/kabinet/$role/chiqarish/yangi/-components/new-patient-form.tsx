import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type SubmitEvent } from 'react'
import { createPatient, hospitalPatientQuery, territoriesQuery, type HospitalPatient, type PatientInput } from '../../../../../../../api/hospital'
import { tashkentInputValue } from '../../../../../../../features/hospital/format'
import { responseFieldErrors, useIdempotentMutation } from '../../../../../../../features/hospital/mutation'
import { Field, inputStyle, Notice, primaryButton, RequestError, secondaryButton } from '../../../../../../../features/hospital/ui'

export function NewPatientForm({ onSaved, cancel }: {
  onSaved: (patient: HospitalPatient) => void
  cancel: () => void
}) {
  const territories = useQuery(territoriesQuery())
  const queryClient = useQueryClient()
  const [noPhone, setNoPhone] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const mutation = useIdempotentMutation(createPatient)
  const today = tashkentInputValue(new Date()).slice(0, 10)

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending || !territories.data?.length) return

    const form = new FormData(event.currentTarget)
    const input: PatientInput = {
      full_name: String(form.get('full_name') ?? '').trim(),
      birth_date: String(form.get('birth_date') ?? ''),
      territory: String(form.get('territory') ?? ''),
      address: String(form.get('address') ?? '').trim(),
      contact: noPhone ? '' : String(form.get('contact') ?? '').trim(),
      contact_is_representative: !noPhone && form.has('contact_is_representative'),
      no_phone_reason: noPhone ? String(form.get('no_phone_reason') ?? '').trim() : '',
    }
    const errors: Record<string, string> = {}
    if (!input.full_name) errors.full_name = 'Bemorning ism va familiyasini kiriting.'
    if (!input.birth_date || input.birth_date > today) errors.birth_date = 'Tug‘ilgan sanani to‘g‘ri kiriting.'
    if (!input.territory) errors.territory = 'Hududni tanlang.'
    if (!input.address) errors.address = 'Manzilni kiriting.'
    if (!noPhone && !/^\+[1-9]\d{7,14}$/.test(input.contact)) errors.contact = 'Raqamni +998901234567 shaklida kiriting.'
    if (noPhone && !input.no_phone_reason) errors.no_phone_reason = 'Telefon yo‘qligi sababini kiriting.'
    setErrors(errors)
    mutation.reset()
    if (Object.keys(errors).length) return

    try {
      const patient = await mutation.mutateAsync(input)
      queryClient.setQueryData(hospitalPatientQuery(patient.id).queryKey, patient)
      onSaved(patient)
    } catch {
      // React Query exposes the backend field errors without discarding the form.
    }
  }

  const fieldErrors = { ...responseFieldErrors(mutation.error), ...errors }

  return (
    <form onSubmit={submit} className="space-y-5" aria-busy={mutation.isPending}>
      <h2 className="text-xl font-semibold">Yangi bemor kartasi</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ism va familiya" error={fieldErrors.full_name}>
          {(a11y) => <input {...a11y} className={inputStyle} name="full_name" maxLength={250} required />}
        </Field>
        <Field label="Tug‘ilgan sana" error={fieldErrors.birth_date}>
          {(a11y) => <input {...a11y} className={inputStyle} name="birth_date" type="date" max={today} required />}
        </Field>
      </div>
      {territories.isPending && <Notice>Hududlar yuklanmoqda…</Notice>}
      {territories.isError && <RequestError error={territories.error} retry={() => void territories.refetch()} />}
      {territories.data && (territories.data.length === 0 ? (
        <Notice>Muassasaga hudud biriktirilmagan.</Notice>
      ) : (
        <Field label="Xizmat hududi" error={fieldErrors.territory}>
          {(a11y) => (
            <select {...a11y} name="territory" className={inputStyle} defaultValue={territories.data.length === 1 ? territories.data[0].id : ''} required>
              <option value="" disabled>Hududni tanlang</option>
              {territories.data.map((territory) => <option key={territory.id} value={territory.id}>{territory.name}</option>)}
            </select>
          )}
        </Field>
      ))}
      <Field label="Manzil" error={fieldErrors.address}>
        {(a11y) => <textarea {...a11y} className={inputStyle} name="address" rows={2} required />}
      </Field>
      <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm font-medium">
        <input type="checkbox" checked={noPhone} onChange={(event) => setNoPhone(event.currentTarget.checked)} />
        Telefon yo‘q
      </label>
      {noPhone ? (
        <Field label="Telefon yo‘qligi sababi" error={fieldErrors.no_phone_reason}>
          {(a11y) => <input {...a11y} className={inputStyle} name="no_phone_reason" maxLength={250} required />}
        </Field>
      ) : (
        <div className="space-y-3">
          <Field label="Telefon" error={fieldErrors.contact} hint="Xalqaro shaklda, masalan +998901234567.">
            {(a11y) => <input {...a11y} className={inputStyle} name="contact" type="tel" maxLength={20} required />}
          </Field>
          <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm font-medium">
            <input type="checkbox" name="contact_is_representative" />
            Vakilning telefon raqami
          </label>
        </div>
      )}
      {mutation.error && <RequestError error={mutation.error} />}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={primaryButton} disabled={mutation.isPending || !territories.data?.length}>
          {mutation.isPending ? 'Saqlanmoqda…' : 'Bemorni saqlash'}
        </button>
        <button type="button" className={secondaryButton} disabled={mutation.isPending} onClick={cancel}>Qidiruvga qaytish</button>
      </div>
    </form>
  )
}
