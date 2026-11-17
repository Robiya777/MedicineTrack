import { ArrowUpDown, CheckCheck, ChevronLeft, ChevronRight, Clock3, Eye, UserRound } from 'lucide-react'
import { initials, isOverdue, previewDate, previewDoctors, previewFacilities, statusLabels, timeRemaining, type PreviewTask } from './data'

export function TaskStatus({ task }: { task: PreviewTask }) {
  return (
    <span className={'mt-status mt-status-' + task.status.toLowerCase()}>
      <span className="mt-status-dot" aria-hidden="true" />
      {statusLabels[task.status]}
    </span>
  )
}

export function TaskTable({ tasks, total, page, pageSize, now, order, onOrder, onPage, onSelect }: {
  tasks: PreviewTask[]
  total: number
  page: number
  pageSize: number
  now: number
  order: 'asc' | 'desc'
  onOrder: () => void
  onPage: (page: number) => void
  onSelect: (task: PreviewTask) => void
}) {
  const pages = Math.ceil(total / pageSize)
  return (
    <>
      <div className="mt-table-wrap">
        <table className="mt-table">
          <caption className="mt-sr-only">Hudud chaqiruvlari. Muddatlar Toshkent vaqtida.</caption>
          <thead>
            <tr>
              <th scope="col">Bemor</th>
              <th scope="col">Mas’ul shifokor</th>
              <th scope="col">Muassasa</th>
              <th scope="col">Holat</th>
              <th scope="col" aria-sort={order === 'asc' ? 'ascending' : 'descending'}>
                <button type="button" className="mt-sort" onClick={onOrder}>
                  Muddat <ArrowUpDown size={14} aria-hidden="true" />
                </button>
              </th>
              <th scope="col"><span className="mt-sr-only">Amal</span></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const doctor = previewDoctors.find((item) => item.id === task.doctorId)
              const facility = previewFacilities.find((item) => item.id === task.facilityId)
              const overdue = isOverdue(task, now)
              return (
                <tr key={task.id} className={overdue ? 'mt-row-overdue' : undefined}>
                  <td>
                    <div className="mt-patient-cell">
                      <span className="mt-avatar" aria-hidden="true">{initials(task.patient)}</span>
                      <div>
                        <span className="mt-patient-name">{task.patient}</span>
                        <p className="mt-cell-meta">{task.shortId} <span aria-hidden="true">·</span> {task.age} yosh</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    {doctor ? <span className="mt-doctor-name">{doctor.name}</span> : (
                      <span className="mt-unassigned-label"><UserRound size={14} aria-hidden="true" />Tayinlanmagan</span>
                    )}
                  </td>
                  <td><span className="mt-facility-name">{facility?.name}</span></td>
                  <td><TaskStatus task={task} /></td>
                  <td>
                    <time dateTime={new Date(task.dueAt).toISOString()} className="mt-due-date mt-numeric">{previewDate(task.dueAt)}</time>
                    <p className={'mt-remaining' + (overdue ? ' mt-remaining-danger' : '')}>
                      {overdue ? <Clock3 size={12} aria-hidden="true" /> : task.status === 'COMPLETED' ? <CheckCheck size={12} aria-hidden="true" /> : null}
                      {timeRemaining(task, now)}
                    </p>
                  </td>
                  <td>
                    <button type="button" className="mt-row-action" onClick={() => onSelect(task)} aria-label={task.patient + ' tafsiloti'}>
                      <Eye size={16} aria-hidden="true" /><span>Tafsilot</span>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-mobile-tasks">
        {tasks.map((task) => {
          const doctor = previewDoctors.find((item) => item.id === task.doctorId)
          const overdue = isOverdue(task, now)
          return (
            <article key={task.id} className={'mt-mobile-task' + (overdue ? ' mt-mobile-task-overdue' : '')}>
              <div className="mt-mobile-task-heading">
                <div className="mt-patient-cell">
                  <span className="mt-avatar" aria-hidden="true">{initials(task.patient)}</span>
                  <div><h3>{task.patient}</h3><p className="mt-cell-meta">{task.shortId} · {task.age} yosh</p></div>
                </div>
                <TaskStatus task={task} />
              </div>
              <dl className="mt-mobile-task-facts">
                <div><dt>Mas’ul</dt><dd>{doctor?.name ?? 'Tayinlanmagan'}</dd></div>
                <div><dt>Muddat (Toshkent)</dt><dd className="mt-numeric">{previewDate(task.dueAt)}</dd></div>
              </dl>
              <div className="mt-mobile-task-bottom">
                <p className={'mt-remaining' + (overdue ? ' mt-remaining-danger' : '')}>
                  <Clock3 size={13} aria-hidden="true" />{timeRemaining(task, now)}
                </p>
                <button type="button" className="mt-row-action" onClick={() => onSelect(task)} aria-label={task.patient + ' tafsiloti'}>
                  Tafsilot <ChevronRight size={15} aria-hidden="true" />
                </button>
              </div>
            </article>
          )
        })}
      </div>

      <nav aria-label="Chaqiruv sahifalari" className="mt-pagination">
        <p><strong>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</strong> / {total} ta chaqiruv</p>
        <div className="mt-pagination-buttons">
          <button type="button" className="mt-button mt-icon-button" onClick={() => onPage(page - 1)} disabled={page === 1} aria-label="Oldingi sahifa"><ChevronLeft size={17} /></button>
          {Array.from({ length: pages }, (_, index) => (
            <button key={index} type="button" className={'mt-button mt-page-button' + (page === index + 1 ? ' mt-page-active' : '')} aria-label={index + 1 + '-sahifa'} aria-current={page === index + 1 ? 'page' : undefined} onClick={() => onPage(index + 1)}>{index + 1}</button>
          ))}
          <button type="button" className="mt-button mt-icon-button" onClick={() => onPage(page + 1)} disabled={page === pages} aria-label="Keyingi sahifa"><ChevronRight size={17} /></button>
        </div>
      </nav>
    </>
  )
}
