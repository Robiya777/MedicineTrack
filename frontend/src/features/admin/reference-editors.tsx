import type {SubmitEvent} from 'react'
import {saveOrganization,saveTerritory,type Organization,type Territory,type OrganizationInput,type TerritoryInput} from '@/api/admin'
import {Field,inputStyle} from '@/components/ui'
import {useIdempotentMutation} from '@/hooks/use-idempotent-mutation'
import {responseFieldErrors} from '@/lib/errors'
import {SaveControls} from './save-controls'
export function OrganizationEditor({
  initial,
  territories,
  close,
  saved,
}: {
  initial: Organization | null
  territories: Territory[]
  close: () => void
  saved: () => Promise<void>
}) {
  const mutation = useIdempotentMutation((input: OrganizationInput, key) =>
      saveOrganization(input, initial?.id, key),
    ),
    fields = responseFieldErrors(mutation.error)
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    const f = new FormData(event.currentTarget)
    try {
      await mutation.mutateAsync({
        name: String(f.get('name')).trim(),
        type: String(f.get('type')) as Organization['type'],
        territory: String(f.get('territory')),
        active: f.get('active') === 'on',
      })
      await saved()
    } catch {
      /* Preserve input. */
    }
  }
  return (
    <form className="rounded-3xl border border-line bg-surface shadow-xs space-y-4 p-5" onSubmit={submit}>
      <h2 className="border-b border-line pb-4 text-lg font-semibold">
        {initial ? 'Muassasani tahrirlash' : 'Yangi muassasa'}
      </h2>
      <fieldset className="space-y-4" disabled={mutation.isPending}>
        <Field label="Muassasa nomi" error={fields.name}>
          {(a) => (
            <input
              {...a}
              className={inputStyle}
              name="name"
              defaultValue={initial?.name || ''}
              required
              maxLength={200}
            />
          )}
        </Field>
        <Field label="Muassasa turi" error={fields.type}>
          {(a) => (
            <select
              {...a}
              className={inputStyle}
              name="type"
              defaultValue={initial?.type || 'HOSPITAL'}
            >
              <option value="HOSPITAL">Statsionar</option>
              <option value="CLINIC">Poliklinika</option>
            </select>
          )}
        </Field>
        <Field label="Muassasa hududi" error={fields.territory}>
          {(a) => (
            <select
              {...a}
              className={inputStyle}
              name="territory"
              defaultValue={initial?.territory || ''}
              required
            >
              <option value="" disabled>
                Hududni tanlang
              </option>
              {territories.map((t) => (
                <option value={t.id} key={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name="active"
            defaultChecked={initial?.active ?? true}
          />
          Muassasa faol
        </label>
      </fieldset>
      <SaveControls
        pending={mutation.isPending}
        error={mutation.error}
        close={close}
        label="Muassasani saqlash"
      />
    </form>
  )
}
export function TerritoryEditor({
  initial,
  territories,
  close,
  saved,
}: {
  initial: Territory | null
  territories: Territory[]
  close: () => void
  saved: () => Promise<void>
}) {
  const mutation = useIdempotentMutation((input: TerritoryInput, key) =>
      saveTerritory(input, initial?.id, key),
    ),
    fields = responseFieldErrors(mutation.error)
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    const f = new FormData(event.currentTarget)
    try {
      await mutation.mutateAsync({
        name: String(f.get('name')).trim(),
        parent: String(f.get('parent') || '') || null,
      })
      await saved()
    } catch {
      /* Preserve input. */
    }
  }
  return (
    <form className="rounded-3xl border border-line bg-surface shadow-xs space-y-4 p-5" onSubmit={submit}>
      <h2 className="border-b border-line pb-4 text-lg font-semibold">
        {initial ? 'Hududni tahrirlash' : 'Yangi hudud'}
      </h2>
      <fieldset className="space-y-4" disabled={mutation.isPending}>
        <Field label="Hudud nomi" error={fields.name}>
          {(a) => (
            <input
              {...a}
              className={inputStyle}
              name="name"
              defaultValue={initial?.name || ''}
              required
              maxLength={200}
            />
          )}
        </Field>
        <Field label="Yuqori hudud" error={fields.parent}>
          {(a) => (
            <select
              {...a}
              className={inputStyle}
              name="parent"
              defaultValue={initial?.parent || ''}
            >
              <option value="">Yuqori hududsiz</option>
              {territories
                .filter((t) => {
                  const visited = new Set<string>()
                  let candidate: Territory | undefined = t
                  while (candidate) {
                    if (candidate.id === initial?.id || visited.has(candidate.id)) return false
                    visited.add(candidate.id)
                    candidate = territories.find(parent => parent.id === candidate?.parent)
                  }
                  return true
                })
                .map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          )}
        </Field>
      </fieldset>
      <SaveControls
        pending={mutation.isPending}
        error={mutation.error}
        close={close}
        label="Hududni saqlash"
      />
    </form>
  )
}
