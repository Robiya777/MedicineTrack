import { RefreshCw, ArrowLeft, ClipboardList } from 'lucide-react'
import { MedicationTaskLink } from '@/features/medications/entry'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { taskDetailQuery } from '@/api/tasks'
import {
  Notice,
  iconButton,
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
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5"><div className="flex items-center gap-3"><Link to="/kabinet/$role" params={{role}} className={iconButton + ' shrink-0'} aria-label="Chaqiruvlarga qaytish" title="Orqaga"><ArrowLeft size={19} aria-hidden="true" /></Link><div><h1 className="text-2xl font-semibold tracking-tight">Chaqiruv tafsiloti</h1><p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><ClipboardList size={14} aria-hidden="true" />Bemor kuzatuvi va patronaj jarayoni</p></div></div>{refreshButton}</header>
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
