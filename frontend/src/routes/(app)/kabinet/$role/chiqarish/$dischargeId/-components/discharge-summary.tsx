import { adminOrganizationsQuery } from '@/api/admin'
import {DischargeCorrections} from '@/features/records/corrections'
import {PatientContact} from '@/features/records/patient-contact'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Check } from 'lucide-react'
import {
  confirmDischarge,
  hospitalPatientQuery,
  hospitalQueryKeys,
  type Discharge,
} from '@/api/hospital'
import { formatTashkentDateTime } from '@/lib/date'
import { responseFieldErrors } from '@/lib/errors'
import { useIdempotentMutation } from '@/hooks/use-idempotent-mutation'
import {
  Facts,
  RequestError,
  primaryButton,
  secondaryButton,
} from '@/components/ui'
import { dischargeStatusLabels } from '@/features/hospital/format'
import { DischargeForm } from '@/features/hospital/discharge-form'
import { PatientActivation } from '@/features/messaging/activation'
import { MedicationPanel } from '@/features/medications/patient-medications'
import { LinkedCareTask } from './linked-care-task'

export interface DischargeSummaryProps {
  discharge: Discharge
}

export function DischargeSummary({ discharge }: DischargeSummaryProps) {
  const hospitals = useQuery(adminOrganizationsQuery())
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const confirm = useIdempotentMutation((_: undefined, key) =>
    confirmDischarge(discharge.id, key),
  )
  const patient = useQuery({
    ...hospitalPatientQuery(discharge.patient),
    enabled: discharge.status === 'DRAFT',
  })

  async function submitConfirmation() {
    if (confirm.isPending) return
    try {
      const task = await confirm.mutateAsync(undefined)
      queryClient.setQueryData(
        hospitalQueryKeys.dischargeTask(discharge.id),
        task,
      )
      queryClient.setQueryData(hospitalQueryKeys.discharge(discharge.id), {
        ...discharge,
        status: 'CONFIRMED',
        patient_snapshot: task.patient,
      } satisfies Discharge)
      void queryClient.invalidateQueries({
        queryKey: hospitalQueryKeys.discharge(discharge.id),
      })
      void queryClient.invalidateQueries({
        queryKey: hospitalQueryKeys.discharges,
      })
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409) {
        void queryClient.invalidateQueries({
          queryKey: hospitalQueryKeys.discharge(discharge.id),
        })
      }
    }
  }

  if (editing && discharge.status === 'DRAFT') {
    return (
      <DischargeForm
        patient={{
          id: discharge.patient,
          full_name: patient.data?.full_name ?? discharge.patient,
        }}
        draft={discharge}
        onSaved={() => {
          confirm.reset()
          setEditing(false)
        }}
        cancel={() => setEditing(false)}
      />
    )
  }

  const record =
    discharge.status === 'CONFIRMED'
      ? discharge.patient_snapshot
      : patient.data
  const confirmFields = responseFieldErrors(confirm.error)
  const contact = record?.contact
    ? record.contact + (record.contact_is_representative ? ' (vakil)' : '')
    : record?.no_phone_reason || '—'

  return (
    <>
      <section
        className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-xs"
        aria-labelledby="summary-title"
      >
        <h2 id="summary-title" className="text-xl font-bold text-ink">
          {discharge.status === 'DRAFT'
            ? 'Tasdiqlashdan oldin tekshiring'
            : 'Chiqarish ma’lumotlari'}
        </h2>
        {patient.isError && discharge.status === 'DRAFT' && (
          <RequestError
            error={patient.error}
            retry={() => void patient.refetch()}
          />
        )}
        <Facts
          items={[
            { label: 'Chiqaruvchi kasalxona', value: hospitals.data?.find(org => org.id === discharge.hospital)?.name || 'Yuklanmoqda…' },
            { label: 'Bemor', value: record?.full_name ?? '—' },
            {
              label: 'Bemor UUIDsi',
              value: <span className="font-mono text-sm">{discharge.patient}</span>,
            },
            {
              label: 'Chiqarish holati',
              value: dischargeStatusLabels[discharge.status],
            },
            {
              label: 'Haqiqiy chiqarish vaqti (Toshkent)',
              value: formatTashkentDateTime(discharge.discharged_at),
            },
            { label: 'Telefon', value: contact },
            { label: 'Manzil', value: record?.address || '—' },
            {
              label: 'Kuzatuvga olish asosi',
              value: discharge.follow_up_reason,
            },
            { label: 'Shifokor tavsiyasi', value: discharge.recommendations },
          ]}
        />
        {discharge.status === 'DRAFT' && (
          <div className="space-y-4 border-t border-line pt-4">
            <p className="text-sm text-muted">
              Patronaj muddati chiqarilgan vaqtdan boshlab 24 soat.
            </p>
            {Object.entries(confirmFields).map(([field, message]) => (
              <p
                key={field}
                role="alert"
                className="text-sm font-medium text-danger"
              >
                {message}
              </p>
            ))}
            {confirm.error && !Object.keys(confirmFields).length && (
              <RequestError error={confirm.error} />
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={primaryButton}
                disabled={
                  confirm.isPending || !patient.data || patient.isError
                }
                onClick={() => void submitConfirmation()}
              >
                <Check size={17} aria-hidden="true" />
                {confirm.isPending
                  ? 'Tasdiqlanmoqda…'
                  : 'Chiqarishni tasdiqlash'}
              </button>
              <button
                type="button"
                className={secondaryButton}
                disabled={confirm.isPending}
                onClick={() => setEditing(true)}
              >
                Tahrirlash
              </button>
            </div>
          </div>
        )}
      </section>
      {discharge.status==='DRAFT'&&<PatientContact patientId={discharge.patient}/>}
      <DischargeCorrections discharge={discharge}/>
      <PatientActivation patientId={discharge.patient} />
      <MedicationPanel
        patientId={discharge.patient}
        dischargeId={discharge.id}
      />
      {discharge.status === 'CONFIRMED' && (
        <LinkedCareTask discharge={discharge} />
      )}
    </>
  )
}
