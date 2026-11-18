import { tabSessionId } from './tab-session'
import axios, { isAxiosError } from 'axios'
import { queryClient } from '@/state/query-client'
import { useSessionStore, type SessionUser } from '@/state/session'

const authClient = axios.create({
  baseURL: '/api/v1',
  allowAbsoluteUrls: false,
  timeout: 5000,
  withCredentials: true,
})

type Tokens = { access: string; user: SessionUser }

let pendingRefresh: Promise<string | null> | undefined
let signingOut = false

function saveTokens({ access, user }: Tokens) {
  useSessionStore.setState({ accessToken: access, user, checked: true })
}

function clearSession() {
  useSessionStore.setState((state) => ({
    accessToken: null,
    user: null,
    checked: true,
    revision: state.revision + 1,
  }))
  queryClient.clear()
}

async function csrfHeaders() {
  const { data } = await authClient.get<{ csrf_token: string }>('/auth/csrf')
  return { 'X-CSRFToken': data.csrf_token }
}

async function withCookieLock<T>(operation: (tabId: string) => Promise<T>): Promise<T> {
  const tabId = await tabSessionId()
  return navigator.locks
    ? navigator.locks.request('medicinetrack-refresh:' + tabId, () => operation(tabId))
    : operation(tabId)
}

export async function signIn(username: string, password: string) {
  return withCookieLock(async (tabId) => {
    const headers = await csrfHeaders()
    const { data } = await authClient.post<Tokens>('/auth/login', {
      username, password, client: 'web', tab_id: tabId,
    }, { headers })
    const { data: user } = await authClient.get<SessionUser>('/me', {
      headers: { Authorization: `Bearer ${data.access}` },
    })
    clearSession()
    saveTokens({ ...data, user })
    return user
  })
}

function refresh() {
  if (pendingRefresh) return pendingRefresh

  const { revision, user } = useSessionStore.getState()
  pendingRefresh = withCookieLock(async (tabId) => {
    if (useSessionStore.getState().revision !== revision) return null

    try {
      const headers = await csrfHeaders()
      const { data } = await authClient.post<Tokens>('/auth/refresh', { tab_id: tabId }, { headers })
      if (useSessionStore.getState().revision !== revision) return null

      // A refresh must retain this tab’s identity.
      if (user && data.user.id !== user.id) {
        clearSession()
        return null
      }
      saveTokens(data)
      return data.access
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        if (useSessionStore.getState().revision === revision) clearSession()
        return null
      }
      throw error
    }
  }).finally(() => { pendingRefresh = undefined })
  return pendingRefresh
}

export async function restoreSession() {
  if (!useSessionStore.getState().checked) await refresh()
  return useSessionStore.getState().user
}

export async function refreshForRequest(revision: number, authorization: unknown) {
  const session = useSessionStore.getState()
  if (signingOut || !session.accessToken || session.revision !== revision) return null
  if (authorization !== `Bearer ${session.accessToken}`) return session.accessToken
  return refresh()
}

export async function signOut() {
  signingOut = true
  try {
    if (pendingRefresh) await pendingRefresh
    let { accessToken } = useSessionStore.getState()

    const revoke = (token: string) => withCookieLock(async (tabId) => {
      const csrf = await csrfHeaders()
      await authClient.post('/auth/logout', { tab_id: tabId }, {
        headers: { ...csrf, Authorization: `Bearer ${token}` },
      })
    })

    if (accessToken) {
      try {
        await revoke(accessToken)
      } catch (error) {
        if (!isAxiosError(error) || error.response?.status !== 401) throw error
        accessToken = await refresh()
        if (accessToken) await revoke(accessToken)
      }
    }
    clearSession()
  } finally {
    signingOut = false
  }
}
