import axios from 'axios'
import { useSessionStore } from '../state/session'

const apiBaseUrl = '/api/v1'

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  allowAbsoluteUrls: false,
  timeout: 5000,
})

apiClient.interceptors.request.use((config) => {
  const { accessToken } = useSessionStore.getState()

  if (config.baseURL === apiBaseUrl && accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`)
  }

  return config
})

export async function checkBackendReadiness(signal: AbortSignal) {
  const response = await apiClient.get('/health/ready', { baseURL: '/', signal })

  // A host may fall back to the SPA's index.html for an unconfigured health route.
  if (String(response.headers['content-type']).toLowerCase().includes('text/html')) {
    throw new Error('Backend tayyorligi manzili HTML qaytardi.')
  }

  return true
}
