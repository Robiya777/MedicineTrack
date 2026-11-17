import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, CircleCheck, CircleDashed, CircleX, Clock3, Inbox, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { ScreenId } from './catalog'
import { statuses } from './demo'
import type { Event, Task } from './demo'

export function ScreenLink({ to, children, className = 'dp-button dp-secondary' }: {
  to: ScreenId; children: ReactNode; className?: string
}) {
  const { variant } = useParams({ from: '/(app)/design/$variant' })
  return <Link to="/design/$variant/$screen" params={{ variant, screen: to }} className={className}>{children}</Link>
}

export function Panel({ title, action, children, className = '' }: {
  title?: string; action?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={'dp-panel ' + className}>
      {(title || action) && <div className="dp-panel-head">{title && <h2>{title}</h2>}{action}</div>}
      {children}
    </section>
  )
}

export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return <dl className="dp-facts">{items.map(({ label, value }) => (
    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
  ))}</dl>
}

export function Status({ task }: { task: Task }) {
  const kind = task.overdue && task.status !== 'COMPLETED' && task.status !== 'CANCELLED' ? 'overdue' : task.status
  const Icon = kind === 'COMPLETED' ? CircleCheck
    : kind === 'CANCELLED' ? CircleX
    : kind === 'overdue' || kind === 'UNASSIGNED' ? TriangleAlert
    : kind === 'ACCEPTED' ? Clock3
    : CircleDashed
  return <span className="dp-status" data-status={kind}><Icon aria-hidden="true" size={15} />
    {kind === 'overdue' ? 'Kechikkan' : statuses[kind]}
  </span>
}

export function Empty({ label, action }: { label: string; action?: ReactNode }) {
  return <div className="dp-empty"><Inbox aria-hidden="true" size={25} /><p>{label}</p>{action}</div>
}

export function History({ events }: { events: Event[] }) {
  return <ol className="dp-history">{[...events].reverse().map((event, index) =>
    <li key={event.time + '-' + index}>
      <span className="dp-history-dot" />
      <div><strong>{event.label}</strong><p>{event.detail}</p></div>
      <time>{event.time}</time>
    </li>,
  )}</ol>
}

export type Field = {
  name: string; label: string; type?: 'text' | 'password' | 'tel' | 'date' | 'datetime-local' | 'time' | 'textarea' | 'select';
  options?: { value: string; label: string }[]; initial?: string; hint?: string; optional?: boolean; max?: string; min?: string;
}

type Step = { title: string; fields: Field[] }
type FormValues = Record<string, string>
type FormErrors = Record<string, string>

export function DemoForm({ steps, guided = false, submit, onSubmit, check, cancel, summary = false }: {
  steps: Step[]; guided?: boolean; submit: string; onSubmit: (values: FormValues) => void;
  check?: (values: FormValues) => Partial<FormErrors>; cancel?: ReactNode; summary?: boolean;
}) {
  const fields = steps.flatMap((step) => step.fields)
  const [values, setValues] = useState<FormValues>(() => Object.fromEntries(fields.map((field) => [field.name, field.initial ?? ''])))
  const [errors, setErrors] = useState<FormErrors>({})
  const [current, setCurrent] = useState(0)
  const stepped = guided && steps.length > 1
  const finalIndex = stepped ? steps.length + (summary ? 1 : 0) - 1 : 0
  const activeStep = stepped ? current : 0
  const reviewing = stepped && summary && activeStep === steps.length
  const visibleSteps = stepped ? steps.slice(activeStep, activeStep + 1) : steps

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const checkedFields = reviewing ? fields : visibleSteps.flatMap((step) => step.fields)
    const trimmedValues = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]))
    const nextErrors: FormErrors = {}
    for (const field of checkedFields) {
      const value = trimmedValues[field.name]
      const type = field.type ?? 'text'
      const isText = type === 'textarea' || type === 'text'
      if (!value && !field.optional) nextErrors[field.name] = 'Bu maydonni to‘ldiring.'
      else if (field.max && isText && value.length > Number(field.max)) {
        nextErrors[field.name] = field.max + ' belgidan oshmasin.'
      } else if (value && field.max && !isText && value > field.max) {
        nextErrors[field.name] = 'Belgilangan chegaradan oshmasin.'
      } else if (value && field.min && value < field.min) {
        nextErrors[field.name] = 'Belgilangan chegaradan oldin bo‘lmasin.'
      }
    }
    const customErrors = check?.(trimmedValues) ?? {}
    for (const { name } of checkedFields) {
      const error = customErrors[name]
      if (error && !nextErrors[name]) nextErrors[name] = error
    }
    setErrors(nextErrors)
    const firstError = Object.keys(nextErrors)[0]
    if (firstError) {
      if (reviewing) setCurrent(steps.findIndex((step) => step.fields.some(({ name }) => name === firstError)))
      const form = event.currentTarget
      requestAnimationFrame(() => {
        const field = form.elements.namedItem(firstError)
        if (field instanceof HTMLElement) field.focus()
      })
      return
    }
    if (current < finalIndex) setCurrent(current + 1)
    else onSubmit(trimmedValues)
  }

  return <form className="dp-form" noValidate onSubmit={handleSubmit}>
    {stepped && <ol className="dp-steps" aria-label="Forma qadamlari">
      {[...steps.map(({ title }) => title), ...(summary ? ['Xulosa'] : [])].map((title, index) => (
        <li key={title} data-done={index < current} aria-current={index === current ? 'step' : undefined}>
          <span>{index + 1}</span>{title}
        </li>
      ))}
    </ol>}
    {reviewing && <Facts items={fields.map((field) => ({
      label: field.label,
      value: field.options?.find(({ value }) => value === values[field.name])?.label ?? (values[field.name] || '—'),
    }))} />}
    {visibleSteps.map((step) => <fieldset key={step.title}><legend>{step.title}</legend>
      <div className="dp-fields">{step.fields.map((field) => {
        const type = field.type ?? 'text'
        const id = 'field-' + field.name
        const error = errors[field.name]
        const describedBy = [field.hint && id + '-hint', error && id + '-error'].filter(Boolean).join(' ')
        const shared = {
          id, name: field.name, value: values[field.name], required: !field.optional,
          'aria-invalid': Boolean(error), 'aria-describedby': describedBy || undefined,
          onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
            setValues({ ...values, [field.name]: event.target.value })
            if (error) setErrors({ ...errors, [field.name]: '' })
          },
        }
        return <div key={field.name} className={field.type === 'textarea' ? 'dp-field dp-field-wide' : 'dp-field'}>
          <label htmlFor={id}>{field.label}{field.optional ? <span> · ixtiyoriy</span> : null}</label>
          {field.type === 'textarea' ? <textarea {...shared} rows={3} maxLength={field.max ? Number(field.max) : undefined} />
            : field.type === 'select' ? <select {...shared}>
              <option value="">Tanlang</option>
              {field.options?.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
            : <input {...shared} type={type} min={field.min} max={type !== 'text' ? field.max : undefined}
              maxLength={type === 'text' && field.max ? Number(field.max) : undefined}
              autoComplete={field.type === 'password' ? 'off' : undefined} />}
          {field.hint && <small id={id + '-hint'}>{field.hint}</small>}
          {error && <small id={id + '-error'} className="dp-error" role="alert">{error}</small>}
        </div>
      })}</div>
    </fieldset>)}
    <div className="dp-actions">
      {activeStep > 0
        ? <button type="button" className="dp-button dp-secondary" onClick={() => setCurrent(current - 1)}><ArrowLeft size={16} aria-hidden />Orqaga</button>
        : cancel}
      <button className="dp-button dp-primary" type="submit">
        {activeStep < finalIndex ? <>Davom etish <ArrowRight size={16} aria-hidden /></> : submit}
      </button>
    </div>
  </form>
}

export function Dialog({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    element.showModal()
    return () => element.close()
  }, [])
  return <dialog ref={dialog} className="dp-dialog" aria-labelledby="dialog-title" onCancel={(event) => {
    event.preventDefault()
    close()
  }}>
    <header><h2 id="dialog-title">{title}</h2>
      <button className="dp-button dp-secondary" onClick={close} type="button">Yopish</button>
    </header>
    {children}
  </dialog>
}
