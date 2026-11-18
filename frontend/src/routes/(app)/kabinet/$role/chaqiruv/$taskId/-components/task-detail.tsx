import { RefreshCw } from 'lucide-react'
import { MedicationTaskLink } from '@/features/medications/entry'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { taskDetailQuery } from '@/api/tasks'
import {
  Notice,
  PageHeader,
  RequestError,
  secondaryButton,
} from '@/components/ui'
import { CoordinatorActions } from '@/features/tasks/coordinator-actions'
import { DoctorActions } from '@/features/tasks/doctor-actions'
import { TaskHistory } from '@/features/tasks/task-history'
import { TaskFacts } from './task-facts'

const route = getRouteApi('/(app)/kabinet/$role/chaqiruv/$taskId/')

export function TaskDetail() {
  const { taskId, role } = route.useParams()
  const task = useQuery(taskDetailQuery(taskId))

  const refreshButton = (
    <button
      type="button"
      className={secondaryButton}
      disabled={task.isFetching}
      onClick={() => void task.refetch()}
    >
      <RefreshCw size={17} aria-hidden="true" />
      Yangilash
    </button>
  )

  return (
    <section className="max-w-4xl space-y-6">
      <PageHeader
        title="Chaqiruv tafsiloti"
        action={refreshButton}
        backTo={{
          to: '/kabinet/$role',
          params: { role },
          label: 'Chaqiruvlarga qaytish',
        }}
      />
      {task.isPending && <Notice>Chaqiruv yuklanmoqda…</Notice>}
      {task.isError && (
        <RequestError error={task.error} retry={() => void task.refetch()} />
      )}
      {task.data && !task.isError && (
        <>
          <TaskFacts task={task.data} />
          {role === 'shifokor' && (
            <MedicationTaskLink dischargeId={task.data.discharge} />
          )}
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
