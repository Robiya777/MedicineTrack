import { useEffect } from 'react'
import { apiClient } from '@/api/client'
import { useSessionStore } from '@/state/session'

export function useDoctorPresence() {
  const id = useSessionStore((state) => state.user?.id)
  const role = useSessionStore((state) => state.user?.role)
  const revision = useSessionStore((state) => state.revision)
  useEffect(() => {
    if (!id || role !== 'DOCTOR') return
    let disposed = false
    let queue: Promise<unknown> = Promise.resolve()
    const pulse = (active: boolean) => {
      queue = queue.catch(() => {}).then(() => {
        const session = useSessionStore.getState()
        if (disposed || session.revision !== revision || session.user?.id !== id) return
        return apiClient.post('/me/presence', { active }).catch(() => {})
      })
    }
    const update = () => pulse(document.visibilityState === 'visible')
    const hide = () => pulse(false)
    update()
    const timer = window.setInterval(update, 15_000)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('pagehide', hide)
    return () => {
      disposed = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('pagehide', hide)
    }
  }, [id, role, revision])
}
