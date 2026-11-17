import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useState, type SubmitEvent } from 'react'
import { z } from 'zod'
import { hospitalPatientQuery, type HospitalPatient } from '@/api/hospital'
import { Facts, Field, inputStyle, Notice, primaryButton, RequestError, secondaryButton } from '@/components/ui'
import { NewPatientForm } from './new-patient-form'

export function PatientSelect({ onSelect }: { onSelect: (patient: HospitalPatient) => void }) {
  const [adding, setAdding] = useState(false)

  return (
    <section className="space-y-5 mt-card p-5 sm:p-6">
      {adding ? <NewPatientForm onSaved={onSelect} cancel={() => setAdding(false)} /> : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Bemorni tanlash</h2>
            <button type="button" className={secondaryButton} onClick={() => setAdding(true)}>Yangi bemor</button>
          </div>
          <PatientSearch onSelect={onSelect} />
        </>
      )}
    </section>
  )
}

function PatientSearch({ onSelect }: { onSelect: (patient: HospitalPatient) => void }) {
  const [id, setId] = useState('')
  const [uuidError, setUuidError] = useState('')
  const patient = useQuery({
    ...hospitalPatientQuery(id),
    enabled: id !== '',
    retry: false,
  })

  function search(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const value = String(form.get('id') ?? '').trim()
    if (!z.uuid().safeParse(value).success) {
      setUuidError('Bemorning to‘liq UUID raqamini kiriting.')
      return
    }
    setUuidError('')
    if (id === value) void patient.refetch()
    else setId(value)
  }

  return (
    <>
      <form onSubmit={search} className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" aria-busy={patient.isFetching}>
        <Field label="Bemor UUIDsi" error={uuidError}>
          {(a11y) => (
            <input {...a11y} name="id" className={inputStyle} autoComplete="off" maxLength={36} required onChange={() => {
              setId('')
              setUuidError('')
            }} />
          )}
        </Field>
        <button type="submit" className={primaryButton + ' w-fit sm:mt-6'} disabled={patient.isFetching}>Qidirish</button>
      </form>
      {patient.isFetching && <Notice>Bemor qidirilmoqda…</Notice>}
      {patient.isError && (isAxiosError(patient.error) && patient.error.response?.status === 404
        ? <Notice>Bemor topilmadi. UUIDni tekshiring yoki yangi karta oching.</Notice>
        : <RequestError error={patient.error} retry={() => void patient.refetch()} />)}
      {patient.data && !patient.isError && (
        <div className="space-y-4 rounded-lg border border-line bg-[#f7fcfa] p-4">
          <Facts items={[
            { label: 'Bemor', value: patient.data.full_name },
            { label: 'Tug‘ilgan sana', value: patient.data.birth_date },
          ]} />
          <button type="button" className={secondaryButton} onClick={() => onSelect(patient.data)}>Shu bemorni tanlash</button>
        </div>
      )}
    </>
  )
}
