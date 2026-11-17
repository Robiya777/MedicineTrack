import axios, { CanceledError, type InternalAxiosRequestConfig } from 'axios'
import { useSessionStore } from '../state/session'
import { refreshForRequest } from './session'

const apiBaseUrl = '/api/v1'

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  allowAbsoluteUrls: false,
  timeout: 5000,
})

type SessionRequest = InternalAxiosRequestConfig & {
  sessionRevision?: number
  retried?: boolean
}

apiClient.interceptors.request.use((config: SessionRequest) => {
  const { accessToken, revision } = useSessionStore.getState()

  if (config.retried && config.sessionRevision !== revision) throw new CanceledError()
  if (config.baseURL === apiBaseUrl && accessToken) {
    config.sessionRevision = revision
    config.headers.set('Authorization', `Bearer ${accessToken}`)
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => {
    const { sessionRevision } = response.config as SessionRequest
    if (sessionRevision !== undefined && sessionRevision !== useSessionStore.getState().revision) {
      throw new CanceledError()
    }
    return response
  },
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) throw error

    const request: SessionRequest | undefined = error.config
    if (error.response?.status !== 401 || request?.sessionRevision === undefined || request.retried) {
      throw error
    }
    const token = await refreshForRequest(request.sessionRevision, request.headers.get('Authorization'))
    if (!token) throw error

    request.retried = true
    return apiClient.request(request)
  },
)

export async function checkBackendReadiness(signal: AbortSignal) {
  const response = await apiClient.get('/health/ready', { baseURL: '/', signal })

  // A host may fall back to the SPA's index.html for an unconfigured health route.
  if (String(response.headers['content-type']).toLowerCase().includes('text/html')) {
    throw new Error('Backend tayyorligi manzili HTML qaytardi.')
  }

  return true
}
