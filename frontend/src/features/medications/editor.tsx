import { DosePlanner } from './dose-planner'
import { Pill, Plus, Save, Trash2 } from 'lucide-react'
import { useState, type SubmitEvent } from 'react'
import type { ItemInput } from '@/api/medications'
import {
  Field,
  inputStyle,
  primaryButton,
  secondaryButton,
  RequestError,
} from '@/components/ui'
import { useIdempotentMutation } from '@/hooks/use-idempotent-mutation'
import { responseFieldErrors } from '@/lib/errors'
export function MedicationEditor({
  initial,
  save,
  close,
}: {
  initial: ItemInput[]
  save: (items: ItemInput[], key: string) => Promise<unknown>
  close: () => void
}) {
  const [items, setItems] = useState<ItemInput[]>(initial),
    [errors, setErrors] = useState<Record<string, string>>({})
  const mutation = useIdempotentMutation(save)
  const fieldErrors = { ...responseFieldErrors(mutation.error), ...errors }
  function itemError(index: number, field: string) {
    const path = `items.${index}.${field}`
    return Object.entries(fieldErrors).filter(([key]) => key === path || key.startsWith(path + '.')).map(([, text]) => text).join(' ')
  }
  function update(index: number, changes: Partial<ItemInput>) {
    setErrors({})
    mutation.reset()
    setItems(
      items.map((item, i) => (i === index ? { ...item, ...changes } : item)),
    )
  }
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (mutation.isPending) return
    const issues: Record<string, string> = {}
    items.forEach((item, index) => {
      const prefix = `items.${index}.`
      if (item.local_times.some(time => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) issues[prefix+'local_times'] = 'Qabul vaqtini soat:daqiqa ko‘rinishida to‘ldiring.'
      if (new Set(item.local_times).size !== item.local_times.length) issues[prefix+'local_times'] = 'Bir xil qabul vaqtini takrorlamang.'
      if (item.start_date && item.end_date) {
        const days = (Date.parse(item.end_date) - Date.parse(item.start_date)) / 86400000
        if (days < 0) issues[prefix+'end_date'] = 'Kurs tugashi boshlanish sanasidan oldin bo‘lmaydi.'
        else if (days >= 90) issues[prefix+'end_date'] = 'Kurs davomiyligi 1–90 kun bo‘lishi kerak.'
      }
    })
    setErrors(issues)
    if (Object.keys(issues).length) return
    try {
      await mutation.mutateAsync(items)
      close()
    } catch {
      /* Preserve draft. */
    }
  }
  return (
    <form
      className="min-w-0 space-y-5 rounded-2xl border border-line bg-surface p-4 sm:p-6"
      onSubmit={submit}
      noValidate
      aria-busy={mutation.isPending}
    >
      <h2 className="flex items-center gap-2 text-xl font-semibold"><Pill size={21} className="text-blue" aria-hidden="true" />Dori jadvali loyihasi</h2>
      <p className="text-sm text-muted">
        Faqat shifokorning mavjud ko‘rsatmasini kiriting. Doza va qabul vaqtini
        taxmin qilmang. Jadval klinik tasdiqdan keyin bemorga ko‘rinadi.
      </p>
      <fieldset disabled={mutation.isPending} className="min-w-0 space-y-6">
        <button
          type="button"
          className={secondaryButton}
          disabled={items.length >= 20}
          onClick={() =>
            setItems([
              ...items,
              {
                name: '',
                prescribed_dose_text: '',
                route: '',
                instructions: '',
                source_reference: '',
                start_date: null,
                end_date: null,
                timezone: 'Asia/Tashkent',
                local_times: [],
                schedule_type: 'FIXED_TIMES',
                needs_clarification: false,
                clarification_reason: '',
              },
            ])
          }
        >
          <Plus size={17} aria-hidden="true" />Dori qo‘shish
        </button>
        <DosePlanner items={items} change={(index,local_times)=>update(index,{local_times})} />
        {items.map((item, index) => (
          <section key={index} className="space-y-4 rounded-2xl border border-line bg-page/60 p-4">
            <h3 className="font-semibold">{index + 1}-dori</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['name', 'Dori nomi'],
                  ['prescribed_dose_text', 'Ko‘rsatmadagi doza'],
                  ['route', 'Qabul yo‘li'],
                  ['source_reference', 'Ko‘rsatma manbasi'],
                  ['timezone', 'Vaqt zonasi'],
                  ['instructions', 'Qo‘shimcha ko‘rsatma'],
                ] as const
              ).map(([field, label]) => (
                <Field key={field} label={label} error={itemError(index, field)}>
                  {(a) => (
                    <input
                      {...a}
                      className={inputStyle}
                      value={item[field]}
                      maxLength={field === 'name' ? 250 : field === 'route' ? 80 : 4000}
                      onChange={(e) =>
                        update(index, { [field]: e.target.value })
                      }
                    />
                  )}
                </Field>
              ))}
              <Field label="Kurs boshlanishi" error={itemError(index, 'start_date')}>
                {(a) => (
                  <input
                    {...a}
                    className={inputStyle}
                    type="date"
                    value={item.start_date || ''}
                    onChange={(e) =>
                      update(index, { start_date: e.target.value || null })
                    }
                  />
                )}
              </Field>
              <Field label="Kurs tugashi" error={itemError(index, 'end_date')}>
                {(a) => (
                  <input
                    {...a}
                    className={inputStyle}
                    type="date"
                    value={item.end_date || ''}
                    min={item.start_date || undefined}
                    max={item.start_date ? new Date(Date.parse(item.start_date) + 89 * 86400000).toISOString().slice(0, 10) : undefined}
                    onChange={(e) =>
                      update(index, { end_date: e.target.value || null })
                    }
                  />
                )}
              </Field>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">Aniq qabul vaqtlari</h4>
              {itemError(index, 'local_times') && <p role="alert" className="text-sm text-danger">{itemError(index, 'local_times')}</p>}
              {item.local_times.map((time, i) => (
                <div key={i} className="flex items-end gap-3">
                  <Field label={'Qabul vaqti ' + (i + 1)}>
                    {(a) => (
                      <input
                        {...a}
                        type="time"
                        className={inputStyle}
                        value={time}
                        required
                        onChange={(e) =>
                          update(index, {
                            local_times: item.local_times.map((t, n) =>
                              n === i ? e.target.value : t,
                            ),
                          })
                        }
                      />
                    )}
                  </Field>
                  <button
                    type="button"
                    className={secondaryButton}
                    aria-label={'Qabul vaqti ' + (i + 1) + 'ni o‘chirish'}
                    onClick={() =>
                      update(index, {
                        local_times: item.local_times.filter((_, n) => n !== i),
                      })
                    }
                  >
                    O‘chirish
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={secondaryButton}
                disabled={item.local_times.length >= 8}
                onClick={() =>
                  update(index, { local_times: [...item.local_times, ''] })
                }
              >
                Qabul vaqti qo‘shish
              </button>
            </div>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={item.needs_clarification}
                onChange={(e) =>
                  update(index, { needs_clarification: e.target.checked })
                }
              />
              Ko‘rsatmani aniqlashtirish kerak
            </label>
            {item.needs_clarification && (
              <Field label="Aniqlashtirish sababi" error={itemError(index, 'clarification_reason')}>
                {(a) => (
                  <textarea
                    {...a}
                    className={inputStyle}
                    value={item.clarification_reason}
                    onChange={(e) =>
                      update(index, { clarification_reason: e.target.value })
                    }
                  />
                )}
              </Field>
            )}
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-danger hover:bg-danger-wash"
              onClick={() => setItems(items.filter((_, i) => i !== index))}
            >
              <Trash2 size={16} aria-hidden="true" />Dorini olib tashlash
            </button>
          </section>
        ))}
      </fieldset>
      {Object.keys(fieldErrors).length > 0 && <div role="alert" className="rounded-2xl border border-danger/20 bg-danger-wash p-4 text-sm text-danger"><p className="font-medium">Quyidagi maydonlarni tuzating:</p><ul className="mt-2 list-inside list-disc">{Object.entries(fieldErrors).map(([path, text]) => { const match = path.match(/^items\.(\d+)\./); return <li key={path}>{match ? `${Number(match[1]) + 1}-dori: ` : ''}{text}</li> })}</ul></div>}
      {mutation.error && !Object.keys(fieldErrors).length && <RequestError error={mutation.error} />}
      <div className="flex flex-wrap gap-3">
        <button className={primaryButton} disabled={mutation.isPending || items.length === 0}>
          <Save size={17} aria-hidden="true" />{mutation.isPending ? 'Saqlanmoqda…' : 'Loyihani saqlash'}
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
