import { Building2, Check, Copy, MapPin, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Dialog as PreviewDialog } from '../../../../../components/dialog'
export { PreviewDialog }
import { previewDate, previewDoctors, previewFacilities, type PreviewTask } from './data'
import { TaskStatus } from './task-table'

export function TaskDetailDialog({ task, close }: { task: PreviewTask; close: () => void }) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  const doctor = previewDoctors.find((item) => item.id === task.doctorId)
  const facility = previewFacilities.find((item) => item.id === task.facilityId)

  async function copyId() {
    try {
      await navigator.clipboard.writeText(task.id)
      setCopied(true)
      setCopyError('')
    } catch {
      setCopyError('IDni belgilab, nusxalashingiz mumkin.')
    }
  }

  return (
    <PreviewDialog title="Chaqiruv tafsiloti" close={close}>
      <div className="mt-detail-body">
        <div className="mt-detail-patient">
          <div><h3>{task.patient}</h3><p>{task.shortId} · {task.age} yosh</p></div>
          <TaskStatus task={task} />
        </div>
        <dl className="mt-detail-facts">
          <div><dt><UserRound size={15} aria-hidden="true" />Mas’ul shifokor</dt><dd>{doctor?.name ?? 'Mas’ul biriktirilmagan'}</dd></div>
          <div><dt><Building2 size={15} aria-hidden="true" />Muassasa</dt><dd>{facility?.name}</dd></div>
          <div><dt>Chiqarilgan vaqt</dt><dd className="mt-numeric">{previewDate(task.dischargedAt)}</dd></div>
          <div><dt>Patronaj muddati</dt><dd className="mt-numeric">{previewDate(task.dueAt)}</dd></div>
        </dl>
        <p className="mt-detail-timezone"><MapPin size={14} aria-hidden="true" />Vaqtlar Toshkent vaqtida ko‘rsatilgan.</p>
        <div className="mt-detail-id">
          <span>To‘liq chaqiruv IDsi</span>
          <code>{task.id}</code>
          <button type="button" className="mt-button" onClick={() => void copyId()}>
            {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            {copied ? 'Nusxalandi' : 'IDni nusxalash'}
          </button>
          <p className={copyError ? 'mt-error-text' : 'mt-sr-only'} role="status">{copyError || (copied ? 'Chaqiruv IDsi nusxalandi.' : '')}</p>
        </div>
      </div>
      <footer className="mt-dialog-footer">
        <p>Sintetik ma’lumot · Dizayn preview</p>
        <button type="button" className="mt-button mt-button-primary" onClick={close}>Yopish</button>
      </footer>
    </PreviewDialog>
  )
}
