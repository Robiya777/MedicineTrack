import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Clock3 } from 'lucide-react'
import type { CareTask } from '../../api/tasks'
import { formatTashkentDateTime, taskStatusLabels } from '../hospital/format'

export function TaskStatus({ task }: { task: CareTask }) {
  const variants = {
    UNASSIGNED: 'unassigned',
    NEW: 'new',
    ACCEPTED: 'accepted',
    COMPLETED: 'completed',
    CANCELLED: '',
  }
  return (
    <span className={'mt-status mt-status-' + variants[task.status]}>
      <span className="mt-status-dot" aria-hidden="true" />
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
    <div className="mt-patient-cell">
      <span className="mt-avatar" aria-hidden="true">
        {(task.patient.full_name || 'B')
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join('')}
      </span>
      <div>
        <span className="mt-patient-name">
          {task.patient.full_name || 'Bemor'}
        </span>
        <p className="mt-cell-meta">#{task.id.slice(0, 8)}</p>
      </div>
    </div>
  )
  const doctor = (task: CareTask) =>
    task.assigned_doctor ? (
      names.get(task.assigned_doctor) || task.assigned_doctor
    ) : (
      <span className="mt-unassigned-label">Mas’ul biriktirilmagan</span>
    )
  const due = (task: CareTask) => (
    <>
      <time className="mt-due-date" dateTime={task.due_at}>
        {formatTashkentDateTime(task.due_at)}
      </time>
      <span
        className={
          'mt-remaining' + (task.overdue ? ' mt-remaining-danger' : '')
        }
      >
        {task.overdue && <Clock3 size={13} aria-hidden="true" />}
        {task.overdue
          ? 'Muddati o‘tgan'
          : task.status === 'COMPLETED' || task.status === 'CANCELLED'
            ? 'Yakunlangan'
            : 'Toshkent vaqti'}
      </span>
    </>
  )
  const open = (task: CareTask) => (
    <Link
      to="/kabinet/$role/chaqiruv/$taskId"
      params={{ role, taskId: task.id }}
      search={(prev) => prev}
      className="mt-row-action"
      aria-label={(task.patient.full_name || 'Bemor') + ' — ko‘rish'}
    >
      <span>Ko‘rish</span>
      <ArrowUpRight size={18} aria-hidden="true" />
    </Link>
  )
  return (
    <>
      <div className="mt-table-wrap">
        <table className="mt-table mt-live-table">
          <caption className="mt-sr-only">Chaqiruvlar ro‘yxati</caption>
          <thead>
            <tr>
              <th scope="col">Bemor</th>
              {coordinator && (
                <>
                  <th scope="col">Mas’ul shifokor</th>
                  <th scope="col">Muassasa</th>
                </>
              )}
              <th scope="col">Holat</th>
              <th scope="col">Patronaj muddati</th>
              <th scope="col">
                <span className="mt-sr-only">Amal</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr
                key={task.id}
                className={task.overdue ? 'mt-row-overdue' : undefined}
              >
                <td>{patient(task)}</td>
                {coordinator && (
                  <>
                    <td>
                      <span className="mt-doctor-name">{doctor(task)}</span>
                    </td>
                    <td>
                      <span className="mt-facility-name">
                        {task.receiving_org
                          ? facilities.get(task.receiving_org) ||
                            task.receiving_org
                          : '—'}
                      </span>
                    </td>
                  </>
                )}
                <td>
                  <TaskStatus task={task} />
                </td>
                <td>{due(task)}</td>
                <td>{open(task)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-mobile-tasks" aria-label="Chaqiruvlar ro‘yxati">
        {tasks.map((task) => (
          <li
            key={task.id}
            className={
              'mt-mobile-task' + (task.overdue ? ' mt-mobile-task-overdue' : '')
            }
          >
            <div className="mt-mobile-task-heading">
              {patient(task)}
              <TaskStatus task={task} />
            </div>
            <dl className="mt-mobile-task-facts">
              {coordinator && (
                <>
                  <div>
                    <dt>Mas’ul shifokor</dt>
                    <dd>{doctor(task)}</dd>
                  </div>
                  <div>
                    <dt>Muassasa</dt>
                    <dd>
                      {task.receiving_org
                        ? facilities.get(task.receiving_org) ||
                          task.receiving_org
                        : '—'}
                    </dd>
                  </div>
                </>
              )}
              <div>
                <dt>Patronaj muddati</dt>
                <dd>{due(task)}</dd>
              </div>
            </dl>
            <div className="mt-mobile-task-bottom">
              <span className="mt-cell-meta">#{task.id.slice(0, 8)}</span>
              {open(task)}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
