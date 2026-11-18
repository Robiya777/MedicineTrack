import { useState, type SubmitEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { hospitalPatientQuery } from '@/api/hospital'
import { updatePatientContact } from '@/api/corrections'
import {
  Field,
  inputStyle,
  primaryButton,
  secondaryButton,
  Notice,
  RequestError,
} from '@/components/ui'
import { useIdempotentMutation } from '@/hooks/use-idempotent-mutation'
import { responseFieldErrors } from '@/lib/errors'
export function PatientContact({ patientId }: { patientId: string }) {
  const query = useQuery(hospitalPatientQuery(patientId)),
    [open, setOpen] = useState(false)
  return (
    <section className="space-y-4">
      {!open && (
        <button className={secondaryButton} onClick={() => setOpen(true)}>
          Kontakt va manzilni tahrirlash
        </button>
      )}
      {open && query.isPending && <Notice>Bemor ma’lumoti yuklanmoqda…</Notice>}
      {open && query.isError && (
        <RequestError error={query.error} retry={() => void query.refetch()} />
      )}
      {open && query.data && !query.isError && (
        <ContactForm
          initial={query.data}
          patientId={patientId}
          close={() => setOpen(false)}
        />
      )}
    </section>
  )
}
function ContactForm({
  initial,
  patientId,
  close,
}: {
  initial: {
    contact: string
    contact_is_representative: boolean
    no_phone_reason: string
    address: string
  }
  patientId: string
  close: () => void
}) {
  const [noPhone, setNoPhone] = useState(!initial.contact),
    [error, setError] = useState(''),
    client = useQueryClient(),
    mutation = useIdempotentMutation(
      (input: Parameters<typeof updatePatientContact>[1], key) =>
        updatePatientContact(patientId, input, key),
    ),
    fields = responseFieldErrors(mutation.error)
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    const f = new FormData(event.currentTarget),
      contact = noPhone ? '' : String(f.get('contact') || '').trim()
    if (contact && !/^\+[1-9]\d{7,14}$/.test(contact)) {
      setError('Telefonni xalqaro shaklda kiriting, masalan +998901234567.')
      return
    }
    setError('')
    try {
      await mutation.mutateAsync({
        address: String(f.get('address') || '').trim(),
        contact,
        no_phone_reason: noPhone ? String(f.get('reason') || '').trim() : '',
        contact_is_representative: !noPhone && f.get('representative') === 'on',
      })
      await client.invalidateQueries({ queryKey: ['hospital'] })
      close()
    } catch {
      /* Preserve editable values on conflict or loss. */
    }
  }
  return (
    <form className="mt-card space-y-4 p-5" onSubmit={submit}>
      <h2 className="text-xl font-semibold">Kontakt va manzil</h2>
      <p className="text-sm text-muted">
        Tahrir faqat o‘zingiz yaratgan bemorning tasdiqlanmagan chiqarishi
        mavjud paytda ruxsat etiladi.
      </p>
      <fieldset className="space-y-4" disabled={mutation.isPending}>
        <Field label="Yangi manzil" error={fields.address}>
          {(a) => (
            <textarea
              {...a}
              className={inputStyle}
              name="address"
              defaultValue={initial.address}
              required
            />
          )}
        </Field>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={noPhone}
            onChange={(e) => setNoPhone(e.target.checked)}
          />
          Telefon yo‘q
        </label>
        {noPhone ? (
          <Field label="Telefon yo‘qligi sababi" error={fields.no_phone_reason}>
            {(a) => (
              <textarea
                {...a}
                className={inputStyle}
                name="reason"
                defaultValue={initial.no_phone_reason}
                required
              />
            )}
          </Field>
        ) : (
          <>
            <Field label="Yangi telefon" error={error || fields.contact}>
              {(a) => (
                <input
                  {...a}
                  className={inputStyle}
                  name="contact"
                  defaultValue={initial.contact}
                  type="tel"
                  required
                />
              )}
            </Field>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                name="representative"
                defaultChecked={initial.contact_is_representative}
              />
              Vakilning telefon raqami
            </label>
          </>
        )}
      </fieldset>
      {mutation.error && <RequestError error={mutation.error} />}
      <div className="flex flex-wrap gap-3">
        <button className={primaryButton} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saqlanmoqda…' : 'Kontaktni saqlash'}
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
