import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Phone, MapPin, ShieldAlert, Navigation, ExternalLink } from 'lucide-react'
import {
  acknowledgeEmergency, assistantConfigQuery, assistantKeys, emergenciesQuery, shareEmergencyLocation,
  type Assessment, type Emergency, type LocationInput,
} from '@/api/assistant'
import { messagingKeys, sendMessage } from '@/api/messaging'
import { Dialog, Notice, RequestError, primaryButton, secondaryButton } from '@/components/ui'
import { formatTashkentDateTime } from '@/lib/date'
import { useIdempotentMutation } from '@/hooks/use-idempotent-mutation'
import { useSessionStore } from '@/state/session'

const risks = { EMERGENCY: 'Shoshilinch belgi', DOCTOR_REVIEW: 'Shifokor ko‘rigi kerak', SELF_MONITOR: 'Kuzatuvni davom ettiring', NEEDS_INFO: 'Aniqlashtirish kerak' }
export function EmergencyPhone() {
  return <a href="tel:103" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"><Phone size={18} aria-hidden="true" />103<span className="hidden sm:inline"> · Telefon qilish</span></a>
}
export function AssistantIntroduction() {
  const config = useQuery(assistantConfigQuery())
  return <aside className="mt-card space-y-3 p-5" aria-label="AI yordamchi haqida">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">AI yordamchi · DEMO</h2><EmergencyPhone /></div>
    <p className="text-sm">Alomatni suhbatga yozing. Kalitsiz demo qoidalar asosida aniqlashtiruvchi savollar beradi va xavfli belgida demo SOS yaratadi. Tashxis va dori dozasini belgilamaydi; shifokor javobi alohida keladi.</p>
    <p className="text-sm font-semibold text-red-800">Demo tez yordamni chaqirmaydi. Og‘ir holatda chat javobini kutmang, O‘zbekistonda 103 ga telefon qiling.</p>
    {config.isPending && <Notice>Yordamchi holati tekshirilmoqda…</Notice>}
    {config.data && !config.data.enabled && <Notice>Bu serverda demo yordamchi o‘chirilgan. Xabaringiz shifokorga yuboriladi.</Notice>}
    {config.isError && <RequestError error={config.error} retry={() => void config.refetch()} />}
  </aside>
}
export function AssistantReply({ assessment, conversationId, interactive }: { assessment: Assessment; conversationId: string; interactive: boolean }) {
  const client = useQueryClient()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!interactive) return
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [interactive])
  const response = useIdempotentMutation((text: string, key) => sendMessage(conversationId, text, key, assessment.id), {
    onSuccess: () => { void client.invalidateQueries({ queryKey: messagingKeys.all }); void client.invalidateQueries({ queryKey: assistantKeys.all }) },
    onError: () => { void client.invalidateQueries({ queryKey: messagingKeys.all }) },
  })
  const questionCurrent = Date.parse(assessment.reply_at || assessment.created_at) > now - 30 * 60_000
  return <section className="space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-ink" aria-label="AI demo javobi">
    <p className="font-bold">AI yordamchi · DEMO <span className={'ml-2 text-sm ' + (assessment.risk === 'EMERGENCY' ? 'text-red-800' : 'text-teal-800')}>{risks[assessment.risk]}</span></p>
    {assessment.reply_reason === 'DOCTORS_OFFLINE' && <p className="text-xs text-muted">Shifokorlar hozir oflayn bo‘lgani uchun yordamchi javob berdi.</p>}
    {assessment.reply_reason === 'NO_REPLY_60S' && <p className="text-xs text-muted">Shifokorlardan 1 daqiqada javob kelmagani uchun yordamchi javob berdi.</p>}
    <p className="whitespace-pre-wrap wrap-break-word">{assessment.reply}</p>
    {assessment.question.text && <p className="font-semibold">{assessment.question.text}</p>}
    {interactive && questionCurrent && assessment.question.choices?.length ? <div className="flex flex-wrap gap-2">
      {assessment.question.choices.map((choice) => <button key={choice} type="button" className={secondaryButton} disabled={response.isPending || response.isSuccess} onClick={() => response.mutate(choice)}>{choice}</button>)}
    </div> : null}
    {response.error && <RequestError error={response.error} />}
    <p className="text-xs text-muted">{assessment.disclaimer}</p>
    {assessment.emergency && <EmergencyCard incident={assessment.emergency} compact />}
  </section>
}
export function EmergencyBoard() {
  const config = useQuery(assistantConfigQuery())
  const [page, setPage] = useState(1)
  const rows = useQuery({ ...emergenciesQuery(page), enabled: config.data?.enabled === true })
  if (config.isError) return <RequestError error={config.error} retry={() => void config.refetch()} />
  if (!config.data?.enabled) return null
  return <section id="demo-sos" className="mt-card space-y-4 p-5" aria-label="Demo SOS kuzatuvi">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-bold"><ShieldAlert size={22} aria-hidden="true" />Demo SOS kuzatuvi</h2><button type="button" className={secondaryButton} onClick={() => void rows.refetch()} disabled={rows.isFetching}>SOSni yangilash</button></div>
    <p className="text-sm text-red-800">Haqiqiy tez yordam chaqirilmaydi. Bu ichki demo ogohlantirishlari; xodim tasdig‘i dispetcher tasdig‘i emas.</p>
    {rows.isPending && <Notice>SOS yozuvlari yuklanmoqda…</Notice>}
    {rows.isError && <RequestError error={rows.error} retry={() => void rows.refetch()} />}
    {!rows.isError && rows.data?.results.map((row) => <EmergencyCard key={row.id} incident={row} />)}
    {rows.data?.count === 0 && <Notice>Demo SOS hali yo‘q.</Notice>}
    {rows.data && rows.data.count > 10 && <nav aria-label="SOS sahifalari" className="flex flex-wrap items-center gap-3"><button className={secondaryButton} disabled={!rows.data.previous || rows.isFetching} onClick={() => setPage(page - 1)}>Oldingi SOSlar</button><span>{page}-sahifa · Jami {rows.data.count}</span><button className={secondaryButton} disabled={!rows.data.next || rows.isFetching} onClick={() => setPage(page + 1)}>Keyingi SOSlar</button></nav>}
  </section>
}
function EmergencyCard({ incident, compact = false }: { incident: Emergency; compact?: boolean }) {
  const user = useSessionStore((s) => s.user)!
  const client = useQueryClient()
  const [locationDialog, setLocationDialog] = useState(false)
  const acknowledge = useIdempotentMutation((_: undefined, key) => acknowledgeEmergency(incident.id, key), { onSuccess: refresh })
  function refresh() {
    void client.invalidateQueries({ queryKey: assistantKeys.all })
    void client.invalidateQueries({ queryKey: messagingKeys.all })
  }
  const location = incident.location
  const details = <>
    <p className="break-all text-xs text-muted">{incident.reference}</p>
    <p className="text-sm">Ro‘yxatdagi manzil: {incident.registered_address || 'Kiritilmagan'}</p>
    {incident.contact && <p className="text-sm">Bemor telefoni: {incident.contact}</p>}
    {location ? <div className="max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-xs" aria-label="Ulashilgan lokatsiya">
      <div className="location-preview relative flex h-28 items-center justify-center overflow-hidden bg-mint" aria-hidden="true"><span className="absolute -left-8 top-8 h-5 w-[130%] -rotate-12 border-y-2 border-white bg-white/60"/><span className="absolute left-1/3 top-0 h-full w-5 rotate-12 border-x-2 border-white bg-white/60"/><span className="relative flex size-14 items-center justify-center rounded-full border-4 border-white bg-primary text-white shadow-md"><MapPin size={27}/></span></div>
      <div className="space-y-2 p-4"><p className="flex items-center gap-2 text-sm font-semibold"><Navigation size={16} className="text-primary" aria-hidden="true"/>{location.source === 'DEMO' ? 'Namoyish lokatsiyasi' : 'Ulashilgan lokatsiya'}</p>
      <p className="text-xs text-muted">{location.source === 'DEMO' ? 'Bemorning GPSi emas · namoyish nuqtasi' : 'Qurilmadan bir marta ulashilgan · jonli kuzatuv emas'}</p>
      <p className="text-xs tabular-nums text-muted">{location.latitude}, {location.longitude}{location.accuracy_m !== null ? ` · ±${Math.round(location.accuracy_m)} m` : ''}</p>
      <p className="text-xs text-muted">{formatTashkentDateTime(location.recorded_at)}</p></div>
      <a className="flex min-h-11 items-center justify-center gap-2 border-t border-line bg-page px-4 py-3 text-sm font-semibold text-primary hover:bg-mint" href={`https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=17/${location.latitude}/${location.longitude}`} target="_blank" rel="noopener noreferrer">Xaritada ochish<ExternalLink size={15} aria-hidden="true"/></a>
    </div> : <Notice>Lokatsiya hali ulashilmagan. Ro‘yxatdagi manzil GPS o‘rniga ishlatilmaydi.</Notice>}
    {user.role === 'PATIENT' && <button type="button" className={secondaryButton} onClick={() => setLocationDialog(true)}>Lokatsiyani ulashish</button>}
    {['DOCTOR', 'COORDINATOR'].includes(user.role) && !incident.acknowledged_at && <button type="button" className={primaryButton} disabled={acknowledge.isPending} onClick={() => acknowledge.mutate(undefined)}>SOSni ko‘rdim</button>}
    {acknowledge.error && <RequestError error={acknowledge.error} />}
    <details><summary className="cursor-pointer text-sm font-semibold">Demo jarayon tarixi</summary><ol className="mt-2 space-y-2">{incident.events.map((event) => <li key={event.id} className="text-sm"><p>{event.detail}</p><time className="text-xs text-muted">{formatTashkentDateTime(event.created_at)}</time></li>)}</ol></details>
  </>
  return <article className="space-y-3 rounded-xl border border-red-200 bg-white p-4" aria-label="Demo SOS tafsiloti">
    <div className="flex flex-wrap items-center gap-2"><strong>{incident.patient_name}</strong><span className="mt-status mt-status-danger">DEMO SOS</span><span className="text-xs text-muted">{formatTashkentDateTime(incident.created_at)}</span></div>
    <p className="text-sm font-semibold text-red-800">{incident.notice}</p>
    <p className="text-sm">{incident.reasons.map((reason) => reason.label).join(' · ')}</p>
    <EmergencyPhone />
    <p className="text-sm">{incident.acknowledged_at ? `Tibbiyot xodimi ko‘rdi: ${formatTashkentDateTime(incident.acknowledged_at)}` : 'Tibbiyot xodimining tasdig‘i kutilmoqda.'}</p>
    {compact ? <details><summary className="cursor-pointer text-sm font-semibold text-primary">SOS tafsilotlari va lokatsiya</summary><div className="mt-3 space-y-3">{details}</div></details> : details}
    {locationDialog && <LocationDialog id={incident.id} close={() => setLocationDialog(false)} shared={refresh} />}
  </article>
}
function LocationDialog({ id, close, shared }: { id: string; close: () => void; shared: () => void }) {
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [retryInput, setRetryInput] = useState<LocationInput | null>(null)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  const mutation = useIdempotentMutation((input: LocationInput, key) => shareEmergencyLocation(id, input, key), { onSuccess: () => { shared(); close() } })
  function send(input: LocationInput) {
    setError(''); setRetryInput(input); mutation.mutate(input)
  }
  function locate() {
    setError('')
    if (!navigator.geolocation) { setError('Bu brauzerda lokatsiya mavjud emas. Namoyish lokatsiyasini tanlashingiz mumkin.'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition((position) => {
      if (!active.current) return
      setLocating(false)
      send({ consent: true, source: 'DEVICE', latitude: position.coords.latitude.toFixed(6), longitude: position.coords.longitude.toFixed(6), accuracy_m: Math.min(position.coords.accuracy, 100000), recorded_at: new Date(position.timestamp).toISOString() })
    }, () => {
      if (!active.current) return
      setLocating(false); setError('Lokatsiya olinmadi. Ruxsat va GPSni tekshirib qayta urinib ko‘ring. Hech qanday koordinata yuborilmadi.')
    }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 })
  }
  const pending = locating || mutation.isPending
  return <Dialog title="Lokatsiyani ulashishga rozilik" close={close} pending={pending}>
    <p>Bir martalik koordinatalar faqat sizga mas’ul shifokor va ruxsatli koordinatorlarga ko‘rsatiladi. Ular haqiqiy 103 xizmatiga yuborilmaydi. Joylashuv fon rejimida kuzatilmaydi.</p>
    <p className="text-sm">Namoyish lokatsiyasi Toshkentdagi oldindan belgilangan nuqta bo‘lib, bemorning haqiqiy joyi sifatida belgilanmaydi.</p>
    <EmergencyPhone />
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    {mutation.error && <RequestError error={mutation.error} />}
    <div className="flex flex-wrap gap-3"><button className={primaryButton} disabled={pending} onClick={locate}>{locating ? 'GPS aniqlanmoqda…' : 'Roziman, GPSni yuborish'}</button><button className={secondaryButton} disabled={pending} onClick={() => send({ consent: true, source: 'DEMO' })}>Roziman, namoyish nuqtasini yuborish</button>{mutation.isError && retryInput && <button className={secondaryButton} disabled={pending} onClick={() => send(retryInput)}>Yuborishni qayta urinish</button>}<button className={secondaryButton} disabled={pending} onClick={close}>Bekor qilish</button></div>
  </Dialog>
}
