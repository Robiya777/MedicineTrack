import { useQuery } from '@tanstack/react-query'
import {
  dischargeTaskQuery,
  doctorNameQuery,
  type Discharge,
  type HospitalTask,
} from '../../../../../../../api/hospital'
import { formatTashkentDateTime } from '../../../../../../../lib/date'
import { Facts, Notice, RequestError } from '../../../../../../../components/ui'
import { taskStatusLabels } from '../../../../../../../features/hospital/format'

export interface LinkedCareTaskProps {
  discharge: Discharge
}

export function LinkedCareTask({ discharge }: LinkedCareTaskProps) {
  const task = useQuery(dischargeTaskQuery(discharge))
  if (task.data) return <TaskDetails task={task.data} />
  if (task.isPending) return <Notice>Chaqiruv yuklanmoqda…</Notice>
  if (task.isError)
    return <RequestError error={task.error} retry={() => void task.refetch()} />
  return <Notice>Bu chiqarish bo‘yicha chaqiruv topilmadi.</Notice>
}

function TaskDetails({ task }: { task: HospitalTask }) {
  const doctor = useQuery(doctorNameQuery(task.assigned_doctor))

  return (
    <section className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-xs" aria-labelledby="task-title">
      <h2 id="task-title" className="text-xl font-bold text-ink">
        Aktiv chaqiruv
      </h2>
      <Facts
        items={[
          { label: 'Chaqiruv ID', value: <span className="font-mono text-sm">{task.id}</span> },
          { label: 'Holat', value: taskStatusLabels[task.status] },
          {
            label: 'Mas’ul shifokor',
            value: task.assigned_doctor
              ? doctor.data ?? task.assigned_doctor
              : 'Mas’ul biriktirilmagan',
          },
          { label: 'Patronaj muddati (Toshkent)', value: formatTashkentDateTime(task.due_at) },
        ]}
      />
      {!task.assigned_doctor && (
        <p role="status" className="rounded-xl bg-amber-50 p-3.5 text-sm font-medium text-amber-900 border border-amber-200">
          Chaqiruv hali shifokorga tayinlanmagan. Koordinator uni mas’ul shifokorga biriktirishi kerak.
        </p>
      )}
      {task.overdue && (
        <p className="rounded-xl bg-amber-50 p-3.5 text-sm font-medium text-amber-900 border border-amber-200">
          Patronaj muddati o‘tgan.
        </p>
      )}
    </section>
  )
}
