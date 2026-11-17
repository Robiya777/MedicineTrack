import {MedicationTaskLink} from '../../../../../../../features/medications/entry'
import { TaskStatus } from '../../../../../../../features/tasks/task-table'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { doctorNameQuery } from '../../../../../../../api/hospital'
import { taskDetailQuery, type CareTask } from '../../../../../../../api/tasks'
import { formatTashkentDateTime } from '../../../../../../../lib/date'
import {
  Facts,
  Notice,
  RequestError,
  secondaryButton,
} from '../../../../../../../components/ui'
import { CoordinatorActions } from '../../../../../../../features/tasks/coordinator-actions'
import { DoctorActions } from '../../../../../../../features/tasks/doctor-actions'
import { TaskHistory } from '../../../../../../../features/tasks/task-history'

const route = getRouteApi('/(app)/kabinet/$role/chaqiruv/$taskId/')

export function TaskDetail() {
  const { taskId, role } = route.useParams()
  const task = useQuery(taskDetailQuery(taskId))
  return (
    <section className="max-w-4xl space-y-6">
      <Link
        to="/kabinet/$role"
        params={{ role }}
        search={(prev) => prev}
        className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft size={17} aria-hidden="true" />
        Chaqiruvlarga qaytish
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
          Chaqiruv tafsiloti
        </h1>
        <button
          type="button"
          className={secondaryButton}
          disabled={task.isFetching}
          onClick={() => void task.refetch()}
        >
          Yangilash
        </button>
      </div>
      {task.isPending && <Notice>Chaqiruv yuklanmoqda…</Notice>}
      {task.isError && (
        <RequestError error={task.error} retry={() => void task.refetch()} />
      )}
      {task.data && !task.isError && (
        <>
          <TaskFacts task={task.data} />
          {role === 'shifokor' && <MedicationTaskLink dischargeId={task.data.discharge}/>}
          {role === 'koordinator' ? (
            <CoordinatorActions task={task.data} />
          ) : (
            <DoctorActions task={task.data} />
          )}
          <TaskHistory task={task.data} />
        </>
      )}
    </section>
  )
}

function TaskFacts({ task }: { task: CareTask }) {
  const doctor = useQuery(doctorNameQuery(task.assigned_doctor))
  return (
    <section
      className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-xs border-t-4 border-t-primary"
      aria-labelledby="patient-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="patient-title" className="wrap-break-word text-xl font-bold text-ink">
          {task.patient.full_name || 'Bemor'}
        </h2>
        <TaskStatus task={task} />
      </div>
      <Facts
        items={[
          {
            label: 'Chaqiruv ID',
            value: <span className="font-mono text-sm">{task.id}</span>,
          },
          {
            label: 'Mas’ul shifokor',
            value: task.assigned_doctor
              ? (doctor.data ?? task.assigned_doctor)
              : 'Mas’ul biriktirilmagan',
          },
          {
            label: 'Patronaj muddati (Toshkent)',
            value: formatTashkentDateTime(task.due_at),
          },
          {
            label: 'Chiqarilgan vaqt (Toshkent)',
            value: formatTashkentDateTime(task.discharged_at),
          },
          { label: 'Manzil', value: task.patient.address || '—' },
          {
            label: 'Telefon',
            value: task.patient.contact ? (
              <a
                className="font-medium text-primary hover:underline"
                href={'tel:' + task.patient.contact}
              >
                {task.patient.contact}
                {task.patient.contact_is_representative ? ' (vakil)' : ''}
              </a>
            ) : (
              task.patient.no_phone_reason || 'Telefon yo‘q'
            ),
          },
          { label: 'Shifokor tavsiyasi', value: task.recommendations },
        ]}
      />
      {task.overdue && (
        <p className="rounded-xl border border-danger/20 bg-danger-wash p-3.5 text-sm font-semibold text-danger">
          Patronaj muddati o‘tgan.
        </p>
      )}
    </section>
  )
}
