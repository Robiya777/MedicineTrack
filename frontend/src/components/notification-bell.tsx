import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { RefreshCw, Bell } from 'lucide-react'
import { useState } from 'react'
import {
  notificationKey,
  notificationsQuery,
  readNotification,
} from '@/api/notifications'
import { useSessionStore } from '@/state/session'
import { getWorkspace } from '@/lib/workspaces'
import { Dialog, Notice, RequestError, secondaryButton, iconButton } from '@/components/ui'
import { formatTashkentDateTime } from '@/lib/date'

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
  AI_EMERGENCY_ALERT: 'DEMO SOS · bemor shoshilinch belgi bildirgan',
  AI_ASSISTANT_REPLY: 'AI yordamchi javob berdi',
  CHAT_TEAM_ADDED: 'Siz bemorning chat jamoasiga qo‘shildingiz',
}

export function NotificationBell() {
  const user = useSessionStore((s) => s.user)!
  const query = useQuery(notificationsQuery())
  const [open, setOpen] = useState(false)
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: readNotification,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: notificationKey })
    },
  })
  const unread = query.data?.filter((item) => !item.read_at).length || 0
  const role = getWorkspace(user).slug

  return (
    <>
      <button
        type="button"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface text-ink transition hover:bg-page cursor-pointer"
        aria-label={
          'Bildirishnomalar' + (unread ? ' · ' + unread + ' ta o‘qilmagan' : '')
        }
        onClick={() => setOpen(true)}
      >
        <Bell size={20} aria-hidden="true" />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white"
            aria-hidden="true"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
        {query.isError && (
          <span
            className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white"
            aria-hidden="true"
          >
            !
          </span>
        )}
      </button>
      {open && (
        <Dialog title="Bildirishnomalar" close={() => setOpen(false)} scrollBody
          actions={(
            <button type="button" className={iconButton} aria-label="Yangilash" title="Yangilash"
              disabled={query.isFetching} onClick={() => void query.refetch()}>
              <RefreshCw size={17} className={query.isFetching ? 'motion-safe:animate-spin' : undefined} aria-hidden="true" />
            </button>
          )}>
          <div className="space-y-4">
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
                  <p className="font-semibold text-ink text-sm">
                    {labels[item.event_type] || 'Yangi bildirishnoma'}
                  </p>
                  <p className="text-xs text-muted">
                    {formatTashkentDateTime(item.created_at)} (Toshkent) ·{' '}
                    {item.read_at ? 'O‘qilgan' : 'O‘qilmagan'}
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {item.event_type === 'AI_EMERGENCY_ALERT' && ['DOCTOR', 'COORDINATOR'].includes(user.role) && (
                      <Link className={secondaryButton} to="/kabinet/$role" params={{ role }} search={{}} hash="demo-sos" onClick={() => { mutation.mutate(item.id); setOpen(false) }}>Demo SOSni ochish</Link>
                    )}
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
                    {['PATIENT_WORSENED', 'RESPONSE_OVERDUE', 'RESPONSE_SCHEDULE_MISSING'].includes(
                      item.event_type,
                    ) &&
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
