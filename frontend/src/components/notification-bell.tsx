import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import { useState } from 'react'
import {
  notificationKey,
  notificationsQuery,
  readNotification,
} from '../api/notifications'
import { useSessionStore } from '../state/session'
import { workspaces } from './workspaces'
import { Dialog } from './dialog'
import { Notice, RequestError, secondaryButton } from '../features/hospital/ui'
import { formatTashkentDateTime } from '../features/hospital/format'
const labels: Record<string, string> = {
  TASK_CREATED: 'Sizga yangi chaqiruv biriktirildi',
  TASK_REASSIGNED: 'Chaqiruv sizga qayta tayinlandi',
  TASK_OVERDUE: 'Chaqiruv muddati o‘tgan',
  TASK_REMINDER_12: 'Chaqiruv bo‘yicha eslatma',
  TASK_REMINDER_20: 'Chaqiruv bo‘yicha eslatma',
  CHAT_MESSAGE: 'Yangi xabar',
  PATIENT_WORSENED: 'Bemor holati yomonlashganini bildirdi',
  RESPONSE_OVERDUE: 'Murojaatga javob muddati o‘tgan',
  RESPONSE_SCHEDULE_MISSING: 'Shifokorning javob jadvali belgilanmagan',
}
export function NotificationBell() {
  const user = useSessionStore((s) => s.user)!,
    query = useQuery(notificationsQuery()),
    [open, setOpen] = useState(false),
    client = useQueryClient(),
    mutation = useMutation({
      mutationFn: readNotification,
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: notificationKey })
      },
    })
  const unread = query.data?.filter((item) => !item.read_at).length || 0,
    role = workspaces[user.role].slug
  return (
    <>
      <button
        type="button"
        className="mt-button mt-icon-button mt-notification-trigger"
        aria-label={
          'Bildirishnomalar' + (unread ? ' · ' + unread + ' ta o‘qilmagan' : '')
        }
        onClick={() => setOpen(true)}
      >
        <Bell size={20} aria-hidden="true" />
        {unread > 0 && (
          <span className="mt-notification-count" aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
        {query.isError && (
          <span className="mt-notification-error" aria-hidden="true">
            !
          </span>
        )}
      </button>
      {open && (
        <Dialog title="Bildirishnomalar" close={() => setOpen(false)}>
          <div className="space-y-4 p-5">
            <button
              className={secondaryButton}
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Yangilash
            </button>
            {query.isPending && <Notice>Bildirishnomalar yuklanmoqda…</Notice>}
            {query.isError && (
              <RequestError
                error={query.error}
                retry={() => void query.refetch()}
              />
            )}
            {mutation.error && <RequestError error={mutation.error} />}
            {query.data?.length === 0 && (
              <Notice>Bildirishnomalar hali yo‘q.</Notice>
            )}
            {!query.isError &&
              query.data?.map((item) => (
                <article
                  key={item.id}
                  className="space-y-3 border-t border-line pt-4"
                >
                  <p className="font-semibold">
                    {labels[item.event_type] || 'Yangi bildirishnoma'}
                  </p>
                  <p className="text-sm text-muted">
                    {formatTashkentDateTime(item.created_at)} (Toshkent) ·{' '}
                    {item.read_at ? 'O‘qilgan' : 'O‘qilmagan'}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {item.task &&
                      ['DOCTOR', 'COORDINATOR'].includes(user.role) && (
                        <Link
                          className={secondaryButton}
                          to="/kabinet/$role/chaqiruv/$taskId"
                          params={{ role, taskId: item.task }}
                          search={{}}
                          onClick={() => {
                            mutation.mutate(item.id)
                            setOpen(false)
                          }}
                        >
                          Chaqiruvni ochish
                        </Link>
                      )}
                    {item.conversation &&
                      ['DOCTOR', 'PATIENT'].includes(user.role) && (
                        <Link
                          className={secondaryButton}
                          to="/kabinet/$role/suhbat/$conversationId"
                          params={{ role, conversationId: item.conversation }}
                          search={{}}
                          onClick={() => {
                            mutation.mutate(item.id)
                            setOpen(false)
                          }}
                        >
                          Suhbatni ochish
                        </Link>
                      )}
                    {[
                      'PATIENT_WORSENED',
                      'RESPONSE_OVERDUE',
                      'RESPONSE_SCHEDULE_MISSING',
                    ].includes(item.event_type) &&
                      user.role === 'COORDINATOR' && (
                        <Link
                          className={secondaryButton}
                          to="/kabinet/$role/murojaatlar"
                          params={{ role }}
                          search={{}}
                          onClick={() => {
                            mutation.mutate(item.id)
                            setOpen(false)
                          }}
                        >
                          Murojaatlar navbati
                        </Link>
                      )}
                    {!item.read_at && (
                      <button
                        className={secondaryButton}
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate(item.id)}
                      >
                        O‘qilgan deb belgilash
                      </button>
                    )}
                  </div>
                </article>
              ))}
          </div>
        </Dialog>
      )}
    </>
  )
}
