import type { CareTask } from '../../api/tasks'
import { Facts } from '../hospital/ui'
import { formatTashkentDateTime } from '../hospital/format'
import { channelLabels, contactResultLabels, eventLabels } from './labels'

export function TaskHistory({ task }: { task: CareTask }) {
  return (
    <>
      {task.contact_attempts.length > 0 && (
        <section aria-labelledby="contact-title" className="space-y-4 rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 id="contact-title" className="text-xl font-semibold">Aloqa urinishlari</h2>
          <ol className="space-y-5">
            {task.contact_attempts.map((attempt) => (
              <li key={attempt.id} className="space-y-3 border-t border-line pt-4">
                <p className="font-semibold">{contactResultLabels[attempt.result]}</p>
                <Facts items={[
                  { label: 'Vaqt (Toshkent)', value: formatTashkentDateTime(attempt.attempted_at) },
                  { label: 'Aloqa turi', value: channelLabels[attempt.channel] },
                  { label: 'Izoh', value: attempt.note },
                  { label: 'Keyingi harakat', value: attempt.next_action },
                ]} />
              </li>
            ))}
          </ol>
        </section>
      )}
      {task.report && (
        <section aria-labelledby="report-title" className="space-y-5 rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 id="report-title" className="text-xl font-semibold">Yakuniy natija</h2>
          <Facts items={[
            { label: 'Aloqa yoki tashrif vaqti (Toshkent)', value: formatTashkentDateTime(task.report.performed_at) },
            { label: 'Aloqa turi', value: channelLabels[task.report.channel] },
            { label: 'Bemor holati', value: task.report.observation },
            { label: 'Bajarilgan ish', value: task.report.actions },
            { label: 'Keyingi reja', value: task.report.follow_up },
            { label: 'Natija yuborilgan vaqt (Toshkent)', value: task.completed_at ? formatTashkentDateTime(task.completed_at) : '—' },
          ]} />
          {task.late_documented && <p className="text-sm font-medium text-amber-900">Natija kech hujjatlashtirilgan.</p>}
        </section>
      )}
      {task.status === 'CANCELLED' && (
        <section className="space-y-4 rounded-xl border border-line bg-white p-5" aria-labelledby="cancel-title">
          <h2 id="cancel-title" className="text-xl font-semibold">Bekor qilish sababi</h2>
          <p className="whitespace-pre-wrap wrap-break-word">{task.cancellation_note}</p>
          {task.cancelled_at && <p className="text-sm text-muted">{formatTashkentDateTime(task.cancelled_at)} (Toshkent)</p>}
        </section>
      )}
      <section aria-labelledby="timeline-title" className="space-y-4 rounded-xl border border-line bg-white p-5 sm:p-6">
        <h2 id="timeline-title" className="text-xl font-semibold">Chaqiruv tarixi</h2>
        {task.timeline.length === 0 && <p className="text-sm text-muted">Hodisalar hali yo‘q.</p>}
        <ol className="space-y-3">
          {task.timeline.map((event) => (
            <li key={event.id} className="border-l-2 border-[#a1c3b5] pl-4">
              <p className="font-medium">{eventLabels[event.action] ?? 'Yozuv yangilandi'}</p>
              <time dateTime={event.created_at} className="text-sm text-muted">{formatTashkentDateTime(event.created_at)} (Toshkent)</time>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
