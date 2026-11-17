import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import {
  dischargeQuery, dischargeTaskQuery, doctorNameQuery, hospitalPatientQuery, type Discharge, type HospitalTask,
} from '../../../../../../../api/hospital'
import {
  dischargeStatusLabels, formatTashkentDateTime, taskStatusLabels,
} from '../../../../../../../features/hospital/format'
import { Facts, Notice, RequestError } from '../../../../../../../features/hospital/ui'

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
  const patient = useQuery({
    ...hospitalPatientQuery(discharge.patient),
    enabled: discharge.status === 'DRAFT',
  })
  const record = discharge.status === 'CONFIRMED' ? discharge.patient_snapshot : patient.data
  const contact = record?.contact
    ? record.contact + (record.contact_is_representative ? ' (vakil)' : '')
    : record?.no_phone_reason || '—'

  return (
    <>
      <section className="space-y-5 rounded-xl border border-line bg-white p-5 sm:p-6" aria-labelledby="summary-title">
        <h2 id="summary-title" className="text-xl font-semibold">Chiqarish ma’lumotlari</h2>
        <Facts items={[
          { label: 'Bemor', value: record?.full_name ?? discharge.patient },
          { label: 'Chiqarish holati', value: dischargeStatusLabels[discharge.status] },
          { label: 'Haqiqiy chiqarish vaqti (Toshkent)', value: formatTashkentDateTime(discharge.discharged_at) },
          { label: 'Telefon', value: contact },
          { label: 'Manzil', value: record?.address || '—' },
          { label: 'Kuzatuvga olish asosi', value: discharge.follow_up_reason },
          { label: 'Shifokor tavsiyasi', value: discharge.recommendations },
        ]} />
      </section>
      {discharge.status === 'CONFIRMED' && <LinkedTask discharge={discharge} />}
    </>
  )
}

function LinkedTask({ discharge }: { discharge: Discharge }) {
  const task = useQuery(dischargeTaskQuery(discharge))
  if (task.isPending) return <Notice>Chaqiruv yuklanmoqda…</Notice>
  if (task.isError) return <RequestError error={task.error} retry={() => void task.refetch()} />
  if (!task.data) return <Notice>Bu chiqarish bo‘yicha chaqiruv topilmadi.</Notice>
  return <TaskDetails task={task.data} />
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
