import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { doctorName, doctorsQuery, type CareTask } from '../../api/tasks'
import { Field, inputStyle, primaryButton, RequestError, secondaryButton } from '../hospital/ui'
import { TaskActionForm } from './action-form'
import { taskIsOpen } from './labels'

const cancellationReasons = [
  { value: 'WRONG_DISCHARGE', label: 'Xato chiqarish yozuvi' },
  { value: 'READMITTED', label: 'Qayta yotqizilgan' },
  { value: 'OTHER', label: 'Boshqa sabab' },
]

export function CoordinatorActions({ task }: { task: CareTask }) {
  const [action, setAction] = useState<'reassign' | 'cancel' | null>(null)
  if (!taskIsOpen(task)) return null

  return (
    <section className="flex flex-wrap gap-3" aria-label="Koordinator amallari">
      <button type="button" className={primaryButton} onClick={() => setAction('reassign')}>
        {task.assigned_doctor ? 'Qayta tayinlash' : 'Shifokor tayinlash'}
      </button>
      <button type="button" className={secondaryButton + ' text-red-800'} onClick={() => setAction('cancel')}>Chaqiruvni bekor qilish</button>
      {action && (
        <ActionDialog title={action === 'cancel' ? 'Chaqiruvni bekor qilish' : 'Shifokor tayinlash'} close={() => setAction(null)}>
          {(onPending) => (
            <TaskActionForm
              key={action}
              task={task}
              submitLabel={action === 'cancel' ? 'Bekor qilishni tasdiqlash' : 'Tayinlash'}
              cancel={() => setAction(null)}
              onSaved={() => setAction(null)}
              onPending={onPending}
              check={(form): Record<string, string> => {
                if (!String(form.get('reason') ?? '').trim()) return { reason: 'Sababini yozing.' }
                return {}
              }}
              build={(form, version) => action === 'cancel' ? {
                action, version,
                reason_code: String(form.get('reason_code')),
                reason: String(form.get('reason')).trim(),
              } : {
                action, version,
                doctor_id: String(form.get('doctor_id')),
                reason: String(form.get('reason')).trim(),
              }}
            >
              {(errors, disabled) => (
                <fieldset disabled={disabled} className="min-w-0 space-y-4">
                  {action === 'cancel' ? (
                    <Field label="Sabab turi" error={errors.reason_code}>
                      {(a11y) => (
                        <select {...a11y} name="reason_code" className={inputStyle} defaultValue="WRONG_DISCHARGE">
                          {cancellationReasons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                      )}
                    </Field>
                  ) : <DoctorSelect assignedDoctor={task.assigned_doctor} error={errors.doctor_id} />}
                  <Field label="Sabab" error={errors.reason}>
                    {(a11y) => <textarea {...a11y} name="reason" className={inputStyle} rows={3} required />}
                  </Field>
                </fieldset>
              )}
            </TaskActionForm>
          )}
        </ActionDialog>
      )}
    </section>
  )
}

function DoctorSelect({ assignedDoctor, error }: { assignedDoctor: string | null; error?: string }) {
  const doctors = useQuery(doctorsQuery())
  const available = doctors.data?.filter((doctor) => doctor.id !== assignedDoctor && doctor.is_active) ?? []
  return (
    <div className="space-y-3">
      <Field label="Yangi mas’ul shifokor" error={error}>
        {(a11y) => (
          <select {...a11y} name="doctor_id" className={inputStyle} defaultValue="" required>
            <option value="" disabled>Shifokorni tanlang</option>
            {available.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctorName(doctor)}</option>)}
          </select>
        )}
      </Field>
      {doctors.isPending && <p role="status" className="text-sm text-muted">Shifokorlar yuklanmoqda…</p>}
      {doctors.isError && <RequestError error={doctors.error} retry={() => void doctors.refetch()} />}
      {doctors.isSuccess && available.length === 0 && <p role="status" className="text-sm text-muted">Boshqa faol shifokor topilmadi.</p>}
    </div>
  )
}

function ActionDialog({ title, close, children }: {
  title: string
  close: () => void
  children: (pending: (value: boolean) => void) => ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [pending, setPending] = useState(false)
  const titleId = useId()
  useEffect(() => {
    const node = dialog.current
    node?.showModal()
    return () => node?.close()
  }, [])

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!pending) close()
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-xl border border-line bg-white p-5 text-ink shadow-xl backdrop:bg-black/40 sm:p-6"
    >
      <h2 id={titleId} className="mb-5 text-xl font-semibold">{title}</h2>
      {children(setPending)}
    </dialog>
  )
}
