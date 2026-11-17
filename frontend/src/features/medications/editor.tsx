import { useState, type SubmitEvent } from 'react'
import type { ItemInput } from '../../api/medications'
import {
  Field,
  inputStyle,
  primaryButton,
  secondaryButton,
  RequestError,
} from '../../components/ui'
import { useIdempotentMutation } from '../../hooks/use-idempotent-mutation'
import { responseFieldErrors } from '../../lib/errors'
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
      className="mt-card space-y-5 p-5"
      onSubmit={submit}
      aria-busy={mutation.isPending}
    >
      <h2 className="text-xl font-semibold">Dori jadvali loyihasi</h2>
      <p className="text-sm text-muted">
        Faqat shifokorning mavjud ko‘rsatmasini kiriting. Doza va qabul vaqtini
        taxmin qilmang. Jadval klinik tasdiqdan keyin bemorga ko‘rinadi.
      </p>
      <fieldset disabled={mutation.isPending} className="space-y-6">
        {items.map((item, index) => (
          <section key={index} className="space-y-4 border-t border-line pt-4">
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
              className="mt-button mt-button-danger"
              onClick={() => setItems(items.filter((_, i) => i !== index))}
            >
              Dorini loyihadan olib tashlash
            </button>
          </section>
        ))}
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
          Dori qo‘shish
        </button>
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
        <button className={primaryButton} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saqlanmoqda…' : 'Loyihani saqlash'}
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
