import {useState,type SubmitEvent} from 'react'
import {saveAccount,roles,type Account,type Organization,type AccountInput} from '@/api/admin'
import {Field,inputStyle} from '@/components/ui'
import {useIdempotentMutation} from '@/hooks/use-idempotent-mutation'
import {responseFieldErrors} from '@/lib/errors'
import {SaveControls} from './save-controls'
import {roleLabels} from './labels'
export function AccountEditor({
  initial,
  organizations,
  close,
  saved,
}: {
  initial: Account | null
  organizations: Organization[]
  close: () => void
  saved: () => Promise<void>
}) {
  const [role, setRole] = useState<Account['role']>(
      initial?.role || 'HOSPITAL',
    ),
    mutation = useIdempotentMutation((input: AccountInput, key) =>
      saveAccount(input, initial?.id, key),
    ),
    fields = responseFieldErrors(mutation.error)
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    const f = new FormData(event.currentTarget),
      password = String(f.get('password') || '')
    try {
      await mutation.mutateAsync({
        username: String(f.get('username')).trim(),
        first_name: String(f.get('first_name') || '').trim(),
        last_name: String(f.get('last_name') || '').trim(),
        role,
        organization: role === 'ADMIN' ? null : String(f.get('organization')),
        is_active: f.get('active') === 'on',
        can_approve_medication_schedule:
          role === 'DOCTOR' && f.get('approve') === 'on',
        ...(password ? { password } : {}),
      })
      await saved()
    } catch {
      /* Keep form for API validation feedback. */
    }
  }
  return (
    <form
      className="rounded-2xl border border-line bg-surface shadow-xs space-y-5 p-5 sm:p-6"
      onSubmit={submit}
      aria-busy={mutation.isPending}
    >
      <h2 className="text-xl font-semibold">
        {initial ? 'Xodimni tahrirlash' : 'Yangi xodim'}
      </h2>
      <fieldset className="space-y-4" disabled={mutation.isPending}>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ['username', 'Xodim logini'],
              ['first_name', 'Ism'],
              ['last_name', 'Familiya'],
            ] as const
          ).map(([name, label]) => (
            <Field key={name} label={label} error={fields[name]}>
              {(a) => (
                <input
                  {...a}
                  name={name}
                  className={inputStyle}
                  defaultValue={initial?.[name] || ''}
                  required={name === 'username'}
                  maxLength={150}
                  autoComplete="off"
                />
              )}
            </Field>
          ))}
          <Field label="Xodim roli" error={fields.role}>
            {(a) => (
              <select
                {...a}
                className={inputStyle}
                value={role}
                onChange={(e) => setRole(e.target.value as Account['role'])}
              >
                {roles.map((value) => (
                  <option value={value} key={value}>
                    {roleLabels[value]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        {role !== 'ADMIN' && (
          <Field label="Xodim muassasasi" error={fields.organization}>
            {(a) => (
              <select
                {...a}
                className={inputStyle}
                name="organization"
                defaultValue={initial?.organization || ''}
                required
              >
                <option value="" disabled>
                  Faol muassasani tanlang
                </option>
                {organizations
                  .filter((o) => o.active || o.id === initial?.organization)
                  .map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                      {org.active ? '' : ' (faol emas)'}
                    </option>
                  ))}
              </select>
            )}
          </Field>
        )}
        <Field
          label={initial ? 'Yangi parol (o‘zgartirish uchun)' : 'Xodim paroli'}
          error={fields.password}
          hint={
            initial
              ? 'Bo‘sh qoldirilsa parol o‘zgarmaydi. Parol yangilansa faol seanslar bekor qilinadi.'
              : undefined
          }
        >
          {(a) => (
            <input
              {...a}
              name="password"
              type="password"
              className={inputStyle}
              autoComplete="new-password"
              required={!initial}
              maxLength={256}
            />
          )}
        </Field>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name="active"
            defaultChecked={initial?.is_active ?? true}
          />
          Akkaunt faol
        </label>
        {role === 'DOCTOR' && (
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              name="approve"
              defaultChecked={initial?.can_approve_medication_schedule || false}
            />
            Dori jadvalini klinik tasdiqlash ruxsati
          </label>
        )}
        {fields.can_approve_medication_schedule && (
          <p role="alert" className="text-danger">
            {fields.can_approve_medication_schedule}
          </p>
        )}
      </fieldset>
      <SaveControls
        pending={mutation.isPending}
        error={mutation.error}
        close={close}
        label="Xodimni saqlash"
      />
    </form>
  )
}
