import { useQuery } from '@tanstack/react-query'
import { dischargeQuery } from '@/api/hospital'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { useSessionStore } from '@/state/session'
import { Field, inputStyle, primaryButton } from '@/components/ui'
import { MedicationPanel } from './patient-medications'
export function MedicationEntry() {
  const user = useSessionStore((s) => s.user)!,
    [id, setId] = useState('')
  if (user.role === 'PATIENT' && user.patient)
    return <MedicationPanel patientId={user.patient} />
  return (
    <section className="mt-card max-w-xl space-y-5 p-5">
      <h1 className="text-2xl font-semibold">Dori jadvali</h1>
      <p className="text-muted">
        Bemorning aniq ichki UUIDsi bilan ruxsatli jadvallarni oching.
        Statsionarda chiqarish tafsilotidan ham jadval tuzish mumkin.
      </p>
      <Field label="Bemor UUIDsi">
        {(a) => (
          <input
            {...a}
            className={inputStyle}
            value={id}
            onChange={(e) => setId(e.target.value.trim())}
          />
        )}
      </Field>
      {z.uuid().safeParse(id).success && (
        <Link
          to="/kabinet/$role/dorilar/$patientId"
          params={{
            role: user.role === 'HOSPITAL' ? 'statsionar' : 'shifokor',
            patientId: id,
          }}
          search={{}}
          className={primaryButton}
        >
          Bemor jadvalini ochish
        </Link>
      )}
    </section>
  )
}

export function MedicationTaskLink({ dischargeId }: { dischargeId: string }) {
  const discharge = useQuery(dischargeQuery(dischargeId))
  return discharge.data && !discharge.isError ? (
    <Link
      to="/kabinet/$role/dorilar/$patientId"
      params={{ role: 'shifokor', patientId: discharge.data.patient }}
      search={{}}
      className={primaryButton}
    >
      Dori jadvali va qabul tarixi
    </Link>
  ) : null
}
