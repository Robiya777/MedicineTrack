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
    [error, setError] = useState('')
  const mutation = useIdempotentMutation(save)
  function update(index: number, changes: Partial<ItemInput>) {
    setItems(
      items.map((item, i) => (i === index ? { ...item, ...changes } : item)),
    )
  }
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (mutation.isPending) return
    setError('')
    if (
      items.some(
        (item) => new Set(item.local_times).size !== item.local_times.length,
      )
    ) {
      setError('Bir xil qabul vaqtini takrorlamang.')
      return
    }
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
                <Field key={field} label={label}>
                  {(a) => (
                    <input
                      {...a}
                      className={inputStyle}
                      value={item[field]}
                      maxLength={4000}
                      onChange={(e) =>
                        update(index, { [field]: e.target.value })
                      }
                    />
                  )}
                </Field>
              ))}
              <Field label="Kurs boshlanishi">
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
              <Field label="Kurs tugashi">
                {(a) => (
                  <input
                    {...a}
                    className={inputStyle}
                    type="date"
                    value={item.end_date || ''}
                    onChange={(e) =>
                      update(index, { end_date: e.target.value || null })
                    }
                  />
                )}
              </Field>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">Aniq qabul vaqtlari</h4>
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
              <Field label="Aniqlashtirish sababi">
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
      {error && (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      )}
      {Object.entries(responseFieldErrors(mutation.error)).map(
        ([field, text]) => (
          <p key={field} role="alert" className="text-sm text-red-800">
            {text}
          </p>
        ),
      )}
      {mutation.error && <RequestError error={mutation.error} />}
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
