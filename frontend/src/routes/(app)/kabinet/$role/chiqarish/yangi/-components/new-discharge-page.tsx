import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import type { HospitalPatient } from '@/api/hospital'
import { DischargeForm } from '@/features/hospital/discharge-form'
import { PatientSelect } from './patient-select'

export function NewDischargePage() {
  const [patient, setPatient] = useState<HospitalPatient | null>(null)
  const navigate = useNavigate()

  return (
    <section className="mt-workflow space-y-5">
      <Link to="/kabinet/$role" params={{ role: 'statsionar' }} className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-semibold text-action">
        <ArrowLeft size={17} aria-hidden="true" />
        Chiqarishlarga qaytish
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Yangi chiqarish</h1>
      <ol aria-label="Chiqarish bosqichlari" className="mt-steps">
        <li aria-current={patient ? undefined : 'step'} className={patient ? '' : 'font-semibold text-action'}>
          1. Bemor
        </li>
        <li aria-current={patient ? 'step' : undefined} className={patient ? 'font-semibold text-action' : ''}>
          2. Chiqarish ma’lumotlari
        </li>
        <li>3. Tekshirish</li>
      </ol>
      {patient ? (
        <DischargeForm
          patient={patient}
          cancel={() => setPatient(null)}
          onSaved={(discharge) => {
            void navigate({
              to: '/kabinet/$role/chiqarish/$dischargeId',
              params: { role: 'statsionar', dischargeId: discharge.id },
              replace: true,
            })
          }}
        />
      ) : <PatientSelect onSelect={setPatient} />}
    </section>
  )
}
