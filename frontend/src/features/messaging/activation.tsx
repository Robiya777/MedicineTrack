import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type SubmitEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { z } from 'zod'
import { activatePatient, issueActivation } from '../../api/messaging'
import { hospitalPatientQuery } from '../../api/hospital'
import { formatTashkentDateTime } from '../hospital/format'
import { responseFieldErrors } from '../hospital/mutation'
import { Field, inputStyle, primaryButton, RequestError } from '../hospital/ui'

export function PatientActivation({ patientId }: { patientId: string }) {
  const patient = useQuery(hospitalPatientQuery(patientId))
  const [verified, setVerified] = useState(false)
  const mutation = useMutation({ mutationFn: () => issueActivation(patientId) })
  return (
    <section
      className="mt-card space-y-4 p-5 sm:p-6"
      aria-labelledby="activation-title"
    >
      <h2 id="activation-title" className="text-xl font-semibold">
        Bemor kabinetini faollashtirish
      </h2>
      {patient.data?.contact ? (
        <>
          <p className="text-sm text-muted">
            Bemor yoki vakili bilan {patient.data.contact} raqamini tekshiring.
            Yangi kod chiqarish avvalgi kodni bekor qiladi.
          </p>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
              disabled={mutation.isPending}
            />
            Telefon raqamini tekshirdim
          </label>
          <button
            className={primaryButton}
            type="button"
            disabled={!verified || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Kod olinmoqda…' : 'Aktivatsiya kodini olish'}
          </button>
        </>
      ) : (
        <p className="text-sm text-muted">
          Aktivatsiya uchun bemorning telefon raqami bo‘lishi va tekshirilishi
          kerak.
        </p>
      )}
      {patient.isError && (
        <RequestError
          error={patient.error}
          retry={() => void patient.refetch()}
        />
      )}
      {mutation.error && <RequestError error={mutation.error} />}
      {mutation.data && (
        <div className="space-y-3 rounded-lg bg-surface p-4" role="status">
          <p>
            Bemor uchun{' '}
            <Link to="/faollashtirish" className="text-action underline">
              faollashtirish sahifasi
            </Link>
          </p>
          <p className="text-sm">Bemor UUIDsi</p>
          <code className="block break-all">{mutation.data.patient_id}</code>
          <p className="text-sm">Bir martalik kod</p>
          <code className="block break-all">{mutation.data.code}</code>
          <p className="text-sm">
            Amal qilish muddati:{' '}
            {formatTashkentDateTime(mutation.data.expires_at)} (Toshkent).
          </p>
        </div>
      )}
    </section>
  )
}
export function ActivationPage() {
  const [username, setUsername] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const mutation = useMutation({
    mutationFn: activatePatient,
    onSuccess: (data) => setUsername(data.username),
  })
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    const form = new FormData(event.currentTarget)
    const input = {
      patient_id: String(form.get('patient_id') || '').trim(),
      code: String(form.get('code') || '').trim(),
      password: String(form.get('password') || ''),
    }
    const issues: Record<string, string> = {}
    if (!z.uuid().safeParse(input.patient_id).success)
      issues.patient_id = 'Bemor UUIDsini to‘liq kiriting.'
    if (input.password !== form.get('repeat'))
      issues.repeat = 'Parollar bir xil emas.'
    setErrors(issues)
    if (!Object.keys(issues).length) {
      try {
        await mutation.mutateAsync(input)
      } catch {
        /* Keep inputs for correction. */
      }
    }
  }
  const fields = { ...responseFieldErrors(mutation.error), ...errors }
  return (
    <main className="mt-theme mt-login">
      <section className="mt-card w-full max-w-lg space-y-5 p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">
          Bemor hisobini faollashtirish
        </h1>
        {username ? (
          <div className="space-y-4" role="status">
            <p>
              Hisob faollashtirildi. Quyidagi login va yangi parolingiz bilan
              kiring.
            </p>
            <code className="block break-all rounded-lg bg-surface p-3">
              {username}
            </code>
            <Link to="/login" search={{}} className={primaryButton}>
              Kirish sahifasiga o‘tish
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted">
              Statsionar bergan bemor UUIDsi va bir martalik kodni kiriting. Kod
              24 soat amal qiladi.
            </p>
            <form
              className="space-y-4"
              onSubmit={submit}
              aria-busy={mutation.isPending}
            >
              <fieldset className="space-y-4" disabled={mutation.isPending}>
                {[
                  ['patient_id', 'Bemor UUIDsi', 'text'],
                  ['code', 'Aktivatsiya kodi', 'text'],
                  ['password', 'Yangi parol', 'password'],
                  ['repeat', 'Parolni takrorlang', 'password'],
                ].map(([name, label, type]) => (
                  <Field key={name} label={label} error={fields[name]}>
                    {(a11y) => (
                      <input
                        {...a11y}
                        className={inputStyle}
                        name={name}
                        type={type}
                        autoComplete={
                          type === 'password' ? 'new-password' : 'off'
                        }
                        required
                        maxLength={
                          name === 'code'
                            ? 128
                            : name === 'patient_id'
                              ? 36
                              : 256
                        }
                      />
                    )}
                  </Field>
                ))}
              </fieldset>
              {mutation.error && <RequestError error={mutation.error} />}
              <button
                type="submit"
                className={primaryButton}
                disabled={mutation.isPending}
              >
                {mutation.isPending
                  ? 'Faollashtirilmoqda…'
                  : 'Hisobni faollashtirish'}
              </button>
            </form>
            <Link
              to="/login"
              search={{}}
              className="mt-link text-action underline"
            >
              Kirish sahifasiga qaytish
            </Link>
          </>
        )}
      </section>
    </main>
  )
}
