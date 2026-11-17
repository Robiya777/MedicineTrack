import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Clock3 } from 'lucide-react'
import type { CareTask } from '@/api/tasks'
import { formatTashkentDateTime } from '@/lib/date'
import { taskStatusLabels } from './labels'

export function TaskStatus({ task }: { task: CareTask }) {
  const styles: Record<CareTask['status'], { badge: string; dot: string }> = {
    UNASSIGNED: {
      badge: 'bg-amber-50 text-amber-800 border-amber-200',
      dot: 'bg-amber-500',
    },
    NEW: {
      badge: 'bg-blue-50 text-blue-800 border-blue-200',
      dot: 'bg-blue-500',
    },
    ACCEPTED: {
      badge: 'bg-teal-50 text-teal-800 border-teal-200',
      dot: 'bg-teal-600',
    },
    COMPLETED: {
      badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      dot: 'bg-emerald-500',
    },
    CANCELLED: {
      badge: 'bg-slate-100 text-slate-700 border-slate-200',
      dot: 'bg-slate-400',
    },
  }
  const current = styles[task.status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${current.badge}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${current.dot}`}
        aria-hidden="true"
      />
      {taskStatusLabels[task.status]}
    </span>
  )
}

export function TaskTable({
  tasks,
  coordinator,
  names,
  facilities,
}: {
  tasks: CareTask[]
  coordinator: boolean
  names: Map<string, string>
  facilities: Map<string, string>
}) {
  const role = coordinator ? 'koordinator' : 'shifokor'

  const patient = (task: CareTask) => (
    <div className="flex items-center gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-800 border border-teal-200/60"
        aria-hidden="true"
      >
        {(task.patient.full_name || 'B')
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join('')}
      </span>
      <div>
        <span className="block font-semibold text-ink text-sm">
          {task.patient.full_name || 'Bemor'}
        </span>
        <p className="text-xs text-muted">#{task.id.slice(0, 8)}</p>
      </div>
    </div>
  )

  const doctor = (task: CareTask) =>
    task.assigned_doctor ? (
      names.get(task.assigned_doctor) || task.assigned_doctor
    ) : (
      <span className="text-xs font-medium text-amber-700 italic">
        Mas’ul biriktirilmagan
      </span>
    )

  const due = (task: CareTask) => (
    <div className="space-y-0.5">
      <time className="block font-medium text-ink text-sm" dateTime={task.due_at}>
        {formatTashkentDateTime(task.due_at)}
      </time>
      <span
        className={`inline-flex items-center gap-1 text-xs ${
          task.overdue ? 'text-danger font-semibold' : 'text-muted'
        }`}
      >
        {task.overdue && <Clock3 size={13} aria-hidden="true" />}
        {task.overdue
          ? 'Muddati o‘tgan'
          : task.status === 'COMPLETED' || task.status === 'CANCELLED'
            ? 'Yakunlangan'
            : 'Toshkent vaqti'}
      </span>
    </div>
  )

  const open = (task: CareTask) => (
    <Link
      to="/kabinet/$role/chaqiruv/$taskId"
      params={{ role, taskId: task.id }}
      search={(prev) => prev}
      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-semibold text-primary hover:bg-teal-50 transition cursor-pointer"
      aria-label={(task.patient.full_name || 'Bemor') + ' — ko‘rish'}
    >
      <span>Ko‘rish</span>
      <ArrowUpRight size={18} aria-hidden="true" />
    </Link>
  )

  return (
    <>
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-line bg-surface shadow-xs">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Chaqiruvlar ro‘yxati</caption>
          <thead>
            <tr className="border-b border-line bg-slate-50/60">
              <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted">
                Bemor
              </th>
              {coordinator && (
                <>
                  <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted">
                    Mas’ul shifokor
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted">
                    Muassasa
                  </th>
                </>
              )}
              <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted">
                Holat
              </th>
              <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted">
                Patronaj muddati
              </th>
              <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted text-right">
                <span className="sr-only">Amal</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {tasks.map((task) => (
              <tr
                key={task.id}
                className={`transition hover:bg-page/50 ${
                  task.overdue ? 'bg-danger-wash/30' : ''
                }`}
              >
                <td className="px-5 py-4 align-middle">{patient(task)}</td>
                {coordinator && (
                  <>
                    <td className="px-5 py-4 align-middle">
                      <span className="font-medium text-ink">{doctor(task)}</span>
                    </td>
                    <td className="px-5 py-4 align-middle text-muted">
                      {task.receiving_org
                        ? facilities.get(task.receiving_org) ||
                          task.receiving_org
                        : '—'}
                    </td>
                  </>
                )}
                <td className="px-5 py-4 align-middle">
                  <TaskStatus task={task} />
                </td>
                <td className="px-5 py-4 align-middle">{due(task)}</td>
                <td className="px-5 py-4 align-middle text-right">{open(task)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-4 md:hidden" aria-label="Chaqiruvlar ro‘yxati">
        {tasks.map((task) => (
          <li
            key={task.id}
            className={`space-y-4 rounded-2xl border p-5 shadow-xs bg-surface ${
              task.overdue
                ? 'border-danger/30 bg-danger-wash/10'
                : 'border-line'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              {patient(task)}
              <TaskStatus task={task} />
            </div>
            <dl className="grid grid-cols-2 gap-3 text-xs border-t border-line/60 pt-3">
              {coordinator && (
                <>
                  <div>
                    <dt className="text-muted font-medium">Mas’ul shifokor</dt>
                    <dd className="font-semibold text-ink mt-0.5">{doctor(task)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted font-medium">Muassasa</dt>
                    <dd className="font-semibold text-ink mt-0.5">
                      {task.receiving_org
                        ? facilities.get(task.receiving_org) ||
                          task.receiving_org
                        : '—'}
                    </dd>
                  </div>
                </>
              )}
              <div className="col-span-2">
                <dt className="text-muted font-medium">Patronaj muddati</dt>
                <dd className="mt-0.5">{due(task)}</dd>
              </div>
            </dl>
            <div className="flex items-center justify-between border-t border-line/60 pt-3">
              <span className="text-xs text-muted">#{task.id.slice(0, 8)}</span>
              {open(task)}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
