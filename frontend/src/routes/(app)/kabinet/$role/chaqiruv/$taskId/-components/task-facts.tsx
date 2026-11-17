import { useQuery } from '@tanstack/react-query'
import { doctorNameQuery } from '../../../../../../../api/hospital'
import type { CareTask } from '../../../../../../../api/tasks'
import { formatTashkentDateTime } from '../../../../../../../lib/date'
import { Facts } from '../../../../../../../components/ui'
import { TaskStatus } from '../../../../../../../features/tasks/task-table'

export interface TaskFactsProps {
  task: CareTask
}

export function TaskFacts({ task }: TaskFactsProps) {
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
