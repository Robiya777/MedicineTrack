import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowLeft, Check } from 'lucide-react'
import { useState } from 'react'
import {
  confirmDischarge, dischargeQuery, dischargeTaskQuery, doctorNameQuery, hospitalPatientQuery, hospitalQueryKeys,
  type Discharge, type HospitalTask,
} from '../../../../../../../api/hospital'
import {
  dischargeStatusLabels, formatTashkentDateTime, taskStatusLabels,
} from '../../../../../../../features/hospital/format'
import { DischargeForm } from '../../../../../../../features/hospital/discharge-form'
import { responseFieldErrors, useIdempotentMutation } from '../../../../../../../features/hospital/mutation'
import { Facts, Notice, primaryButton, RequestError, secondaryButton } from '../../../../../../../features/hospital/ui'

const detailRoute = getRouteApi('/(app)/kabinet/$role/chiqarish/$dischargeId/')

export function DischargeDetail() {
  const { dischargeId } = detailRoute.useParams()
  const discharge = useQuery(dischargeQuery(dischargeId))

  return (
    <section className="space-y-5">
      <Link to="/kabinet/$role" params={{ role: 'statsionar' }} className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-semibold text-action">
        <ArrowLeft size={17} aria-hidden="true" />
        Chiqarishlarga qaytish
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Chiqarish tafsiloti</h1>
      {discharge.isPending && <Notice>Chiqarish yuklanmoqda…</Notice>}
      {discharge.isError && <RequestError error={discharge.error} retry={() => void discharge.refetch()} />}
      {discharge.data && <DischargeSummary key={discharge.data.id} discharge={discharge.data} />}
    </section>
  )
}

function DischargeSummary({ discharge }: { discharge: Discharge }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const confirm = useIdempotentMutation((_: undefined, key) => confirmDischarge(discharge.id, key))
  const patient = useQuery({
    ...hospitalPatientQuery(discharge.patient),
    enabled: discharge.status === 'DRAFT',
  })
  async function submitConfirmation() {
    if (confirm.isPending) return
    try {
      const task = await confirm.mutateAsync(undefined)
      queryClient.setQueryData(hospitalQueryKeys.dischargeTask(discharge.id), task)
      queryClient.setQueryData(hospitalQueryKeys.discharge(discharge.id), {
        ...discharge,
        status: 'CONFIRMED',
        patient_snapshot: task.patient,
      } satisfies Discharge)
      void queryClient.invalidateQueries({ queryKey: hospitalQueryKeys.discharge(discharge.id) })
      void queryClient.invalidateQueries({ queryKey: hospitalQueryKeys.discharges })
    } catch {
      // Keep the summary and retry the same confirmation if the response was lost.
    }
  }

  if (editing && discharge.status === 'DRAFT') {
    return (
      <DischargeForm
        patient={{ id: discharge.patient, full_name: patient.data?.full_name ?? discharge.patient }}
        draft={discharge}
        onSaved={() => {
          confirm.reset()
          setEditing(false)
        }}
        cancel={() => setEditing(false)}
      />
    )
  }

  const record = discharge.status === 'CONFIRMED' ? discharge.patient_snapshot : patient.data
  const confirmFields = responseFieldErrors(confirm.error)
  const contact = record?.contact
    ? record.contact + (record.contact_is_representative ? ' (vakil)' : '')
    : record?.no_phone_reason || '—'

  return (
    <>
      <section className="space-y-5 rounded-xl border border-line bg-white p-5 sm:p-6" aria-labelledby="summary-title">
        <h2 id="summary-title" className="text-xl font-semibold">
          {discharge.status === 'DRAFT' ? 'Tasdiqlashdan oldin tekshiring' : 'Chiqarish ma’lumotlari'}
        </h2>
        {patient.isError && discharge.status === 'DRAFT' && (
          <RequestError error={patient.error} retry={() => void patient.refetch()} />
        )}
        <Facts items={[
          { label: 'Bemor', value: record?.full_name ?? '—' },
          { label: 'Bemor UUIDsi', value: <span className="font-mono text-sm">{discharge.patient}</span> },
          { label: 'Chiqarish holati', value: dischargeStatusLabels[discharge.status] },
          { label: 'Haqiqiy chiqarish vaqti (Toshkent)', value: formatTashkentDateTime(discharge.discharged_at) },
          { label: 'Telefon', value: contact },
          { label: 'Manzil', value: record?.address || '—' },
          { label: 'Kuzatuvga olish asosi', value: discharge.follow_up_reason },
          { label: 'Shifokor tavsiyasi', value: discharge.recommendations },
        ]} />
        {discharge.status === 'DRAFT' && (
          <div className="space-y-4 border-t border-line pt-4">
            <p className="text-sm text-muted">Patronaj muddati chiqarilgan vaqtdan boshlab 24 soat.</p>
            {Object.entries(confirmFields).map(([field, message]) => (
              <p key={field} role="alert" className="text-sm font-medium text-red-800">{message}</p>
            ))}
            {confirm.error && !Object.keys(confirmFields).length && <RequestError error={confirm.error} />}
            <div className="flex flex-wrap gap-3">
              <button type="button" className={primaryButton} disabled={confirm.isPending || !patient.data || patient.isError} onClick={() => void submitConfirmation()}>
                <Check size={17} aria-hidden="true" />
                {confirm.isPending ? 'Tasdiqlanmoqda…' : 'Chiqarishni tasdiqlash'}
              </button>
              <button type="button" className={secondaryButton} disabled={confirm.isPending} onClick={() => setEditing(true)}>
                Tahrirlash
              </button>
            </div>
          </div>
        )}
      </section>
      {discharge.status === 'CONFIRMED' && <LinkedTask discharge={discharge} />}
    </>
  )
}

function LinkedTask({ discharge }: { discharge: Discharge }) {
  const task = useQuery(dischargeTaskQuery(discharge))
  if (task.data) return <TaskDetails task={task.data} />
  if (task.isPending) return <Notice>Chaqiruv yuklanmoqda…</Notice>
  if (task.isError) return <RequestError error={task.error} retry={() => void task.refetch()} />
  return <Notice>Bu chiqarish bo‘yicha chaqiruv topilmadi.</Notice>
}

function TaskDetails({ task }: { task: HospitalTask }) {
  const doctor = useQuery(doctorNameQuery(task.assigned_doctor))

  return (
    <section className="space-y-5 rounded-xl border border-line bg-white p-5 sm:p-6" aria-labelledby="task-title">
      <h2 id="task-title" className="text-xl font-semibold">Aktiv chaqiruv</h2>
      <Facts items={[
        { label: 'Chaqiruv ID', value: <span className="font-mono text-sm">{task.id}</span> },
        { label: 'Holat', value: taskStatusLabels[task.status] },
        { label: 'Mas’ul shifokor', value: task.assigned_doctor
          ? doctor.data ?? task.assigned_doctor
          : 'Mas’ul biriktirilmagan' },
        { label: 'Patronaj muddati (Toshkent)', value: formatTashkentDateTime(task.due_at) },
      ]} />
      {task.overdue && <p className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-900">Patronaj muddati o‘tgan.</p>}
    </section>
  )
}
