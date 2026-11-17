import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { doctorNameQuery } from '../../../../../../../api/hospital'
import { taskDetailQuery, type CareTask } from '../../../../../../../api/tasks'
import { formatTashkentDateTime, taskStatusLabels } from '../../../../../../../features/hospital/format'
import { Facts, Notice, RequestError, secondaryButton } from '../../../../../../../features/hospital/ui'
import { CoordinatorActions } from '../../../../../../../features/tasks/coordinator-actions'
import { DoctorActions } from '../../../../../../../features/tasks/doctor-actions'
import { TaskHistory } from '../../../../../../../features/tasks/task-history'

const route = getRouteApi('/(app)/kabinet/$role/chaqiruv/$taskId/')

export function TaskDetail() {
  const { taskId, role } = route.useParams()
  const task = useQuery(taskDetailQuery(taskId))
  return (
    <section className="space-y-5">
      <Link to="/kabinet/$role" params={{ role }} className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-semibold text-action">
        <ArrowLeft size={17} aria-hidden="true" />Chaqiruvlarga qaytish
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Chaqiruv tafsiloti</h1>
        <button type="button" className={secondaryButton} disabled={task.isFetching} onClick={() => void task.refetch()}>Yangilash</button>
      </div>
      {task.isPending && <Notice>Chaqiruv yuklanmoqda…</Notice>}
      {task.isError && <RequestError error={task.error} retry={() => void task.refetch()} />}
      {task.data && !task.isError && (
        <>
          <TaskFacts task={task.data} />
          {role === 'koordinator' ? <CoordinatorActions task={task.data} /> : <DoctorActions task={task.data} />}
          <TaskHistory task={task.data} />
        </>
      )}
    </section>
  )
}

function TaskFacts({ task }: { task: CareTask }) {
  const doctor = useQuery(doctorNameQuery(task.assigned_doctor))
  return (
    <section className="space-y-5 rounded-xl border border-line bg-white p-5 sm:p-6" aria-labelledby="patient-title">
      <h2 id="patient-title" className="wrap-break-word text-xl font-semibold">{task.patient.full_name || 'Bemor'}</h2>
      <Facts items={[
        { label: 'Chaqiruv ID', value: <span className="font-mono text-sm">{task.id}</span> },
        { label: 'Holat', value: taskStatusLabels[task.status] },
        { label: 'Mas’ul shifokor', value: task.assigned_doctor ? doctor.data ?? task.assigned_doctor : 'Mas’ul biriktirilmagan' },
        { label: 'Patronaj muddati (Toshkent)', value: formatTashkentDateTime(task.due_at) },
        { label: 'Chiqarilgan vaqt (Toshkent)', value: formatTashkentDateTime(task.discharged_at) },
        { label: 'Manzil', value: task.patient.address || '—' },
        { label: 'Telefon', value: task.patient.contact
          ? <a className="rounded-sm text-action underline underline-offset-4" href={'tel:' + task.patient.contact}>{task.patient.contact}{task.patient.contact_is_representative ? ' (vakil)' : ''}</a>
          : task.patient.no_phone_reason || 'Telefon yo‘q' },
        { label: 'Shifokor tavsiyasi', value: task.recommendations },
      ]} />
      {task.overdue && <p className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-900">Patronaj muddati o‘tgan.</p>}
    </section>
  )
}
