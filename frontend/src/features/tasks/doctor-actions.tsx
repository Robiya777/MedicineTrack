import { useState } from 'react'
import { useSessionStore } from '../../state/session'
import { channelSchema, contactResultSchema, type CareTask, type TaskCommand } from '../../api/tasks'
import { parseTashkentInput, tashkentInputValue } from '../../lib/date'
import { Field, inputStyle, primaryButton, secondaryButton } from '../../components/ui'
import { TaskActionForm } from './action-form'
import { channelLabels, contactResultLabels, taskIsOpen } from './labels'

export function DoctorActions({ task }: { task: CareTask }) {
  const userId = useSessionStore((state) => state.user?.id)
  const [action, setAction] = useState<'accept' | 'contact-attempts' | 'complete' | null>(null)
  const allowed = taskIsOpen(task) && task.assigned_doctor === userId
  if (!allowed) return null

  const currentAction = action === 'complete' && task.status !== 'ACCEPTED'
    ? null
    : action === 'accept' && task.status !== 'NEW' ? null : action

  return (
    <section className="space-y-4 mt-card p-5 sm:p-6" aria-labelledby="doctor-actions-title">
      <h2 id="doctor-actions-title" className="text-xl font-semibold">Chaqiruv bilan ishlash</h2>
      {currentAction ? (
        <DoctorForm key={currentAction} task={task} action={currentAction} close={() => setAction(null)} />
      ) : (
        <div className="flex flex-wrap gap-3">
          {task.status === 'NEW' && <button type="button" className={primaryButton} onClick={() => setAction('accept')}>Qabul qilish</button>}
          <button type="button" className={secondaryButton} onClick={() => setAction('contact-attempts')}>Aloqa urinishini qo‘shish</button>
          {task.status === 'ACCEPTED' && <button type="button" className={primaryButton} onClick={() => setAction('complete')}>Natijani yuborish</button>}
        </div>
      )}
    </section>
  )
}

function DoctorForm({ task, action, close }: {
  task: CareTask
  action: 'accept' | 'contact-attempts' | 'complete'
  close: () => void
}) {
  const [initialTime] = useState(() => tashkentInputValue(new Date()))
  const contact = action === 'contact-attempts'
  const field = contact ? 'attempted_at' : 'performed_at'
  const title = action === 'accept' ? 'Chaqiruvni qabul qilish' : contact ? 'Aloqa urinishini qayd etish' : 'Yakuniy natijani yuborish'

  function validate(form: FormData) {
    const errors: Record<string, string> = {}
    if (action === 'accept') return errors
    const date = parseTashkentInput(String(form.get(field) ?? ''))
    if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now() || date.getTime() < Date.parse(task.discharged_at)) {
      errors[field] = 'Vaqt chiqarilgan payt va hozirgi vaqt oralig‘ida bo‘lishi kerak.'
    }
    const required = contact ? ['note', 'next_action'] : ['observation', 'actions', 'follow_up']
    for (const name of required) {
      if (!String(form.get(name) ?? '').trim()) errors[name] = 'Bu maydonni to‘ldiring.'
    }
    return errors
  }

  function build(form: FormData, version: number): TaskCommand {
    if (action === 'accept') return { action, version }
    const channel = channelSchema.parse(form.get('channel'))
    const time = parseTashkentInput(String(form.get(field))).toISOString()
    if (contact) return {
      action, version, channel,
      result: contactResultSchema.parse(form.get('result')),
      attempted_at: time,
      note: String(form.get('note')).trim(),
      next_action: String(form.get('next_action')).trim(),
    }
    return {
      action: 'complete', version, channel,
      performed_at: time,
      observation: String(form.get('observation')).trim(),
      actions: String(form.get('actions')).trim(),
      follow_up: String(form.get('follow_up')).trim(),
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{title}</h3>
      <TaskActionForm task={task} submitLabel={action === 'accept' ? 'Qabul qilishni tasdiqlash' : contact ? 'Urinishni saqlash' : 'Natijani tasdiqlash'} cancel={close} onSaved={close} check={validate} build={build}>
        {(errors, disabled) => action === 'accept' ? (
          <p className="text-sm text-muted">Qabul qilingach aloqa yoki tashrif natijasini yuboring.</p>
        ) : (
          <fieldset disabled={disabled} className="min-w-0 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={contact ? 'Urinish vaqti (Toshkent)' : 'Aloqa yoki tashrif vaqti (Toshkent)'} error={errors[field]}>
                {(a11y) => <input {...a11y} name={field} type="datetime-local" step="1" defaultValue={initialTime} className={inputStyle} required />}
              </Field>
              <Field label="Aloqa turi" error={errors.channel}>
                {(a11y) => (
                  <select {...a11y} name="channel" className={inputStyle} defaultValue="PHONE">
                    {Object.entries(channelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                )}
              </Field>
            </div>
            {contact && (
              <Field label="Aloqa natijasi" error={errors.result}>
                {(a11y) => (
                  <select {...a11y} name="result" className={inputStyle} defaultValue="NO_ANSWER">
                    {Object.entries(contactResultLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                )}
              </Field>
            )}
            {(contact ? [
              { name: 'note', label: 'Izoh' },
              { name: 'next_action', label: 'Keyingi harakat' },
            ] : [
              { name: 'observation', label: 'Bemor holati' },
              { name: 'actions', label: 'Bajarilgan ish' },
              { name: 'follow_up', label: 'Keyingi reja' },
            ]).map(({ name, label }) => (
              <Field key={name} label={label} error={errors[name]}>
                {(a11y) => <textarea {...a11y} name={name} className={inputStyle} rows={2} required />}
              </Field>
            ))}
          </fieldset>
        )}
      </TaskActionForm>
    </div>
  )
}
