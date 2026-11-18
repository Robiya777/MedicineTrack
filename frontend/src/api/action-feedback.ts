import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
export type ActionFeedback = { key: string; state: 'loading' | 'success' | 'error' | 'close'; title: string; description?: string }
export const feedbackEvent = 'medicinetrack:action-feedback'
type Request = InternalAxiosRequestConfig & { feedbackKey?: string }
const timers = new Map<string, ReturnType<typeof setTimeout>>()
function emit(value: ActionFeedback) { window.dispatchEvent(new CustomEvent(feedbackEvent, {detail:value})) }
function eligible(config: Request) {
  return ['post','put','patch','delete'].includes(config.method?.toLowerCase() || '') && !/\/auth\/(refresh|csrf)|\/notifications\//.test(config.url || '')
}
function success(url: string, method?: string) {
  if(url.endsWith('/auth/login')) return 'Tizimga kirdingiz'
  if(url.endsWith('/auth/logout')) return 'Tizimdan chiqdingiz'
  if(url.endsWith('/accept')) return 'Chaqiruv qabul qilindi'
  if(url.endsWith('/confirm') || url.endsWith('/approve')) return 'Tasdiqlandi'
  if(url.endsWith('/complete')) return 'Hisobot yuborildi'
  if(method==='put' || method==='patch') return 'O‘zgarishlar saqlandi'
  if(method==='delete') return 'O‘chirildi'
  if(url.endsWith('/messages')) return 'Xabar yuborildi'
  return 'Amal bajarildi'
}
export function attachActionFeedback(client: AxiosInstance) {
  client.interceptors.request.use((config: Request) => {
    if(eligible(config)) {
      const key = config.feedbackKey ||= crypto.randomUUID()
      if(!timers.has(key)) timers.set(key,setTimeout(()=>emit({key,state:'loading',title:'Bajarilmoqda…'}),400))
    }
    return config
  })
  client.interceptors.response.use(response => {
    const config = response.config as Request, key = config.feedbackKey
    if(key) {clearTimeout(timers.get(key));timers.delete(key);emit({key,state:'success',title:success(config.url || '', config.method)})}
    return response
  }, (error: unknown) => {
    if(axios.isAxiosError(error)) {
      const key = (error.config as Request | undefined)?.feedbackKey
      if(key) {
        clearTimeout(timers.get(key));timers.delete(key)
        const status=error.response?.status
        emit({key,state:axios.isCancel(error)?'close':'error',title:'Amal bajarilmadi',description:
          status===401 ? 'Login yoki sessiyani tekshirib, qayta urinib ko‘ring.' : status===403 ? 'Bu amal uchun ruxsat mavjud emas.' : status===409 ? 'Ma’lumot yangilangan. Joriy holatni tekshiring.' : status===429 ? 'Urinishlar ko‘paydi. Birozdan keyin qayta urinib ko‘ring.' : status===400 ? 'Kiritilgan ma’lumotlarni tekshiring.' : 'Ulanishni tekshirib, qayta urinib ko‘ring.'})
      }
    }
    return Promise.reject(error)
  })
}
