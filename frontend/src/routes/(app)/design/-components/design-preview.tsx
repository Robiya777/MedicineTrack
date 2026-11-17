import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { Activity, ArrowLeft, Building2, ClipboardList, LayoutGrid, LockKeyhole, RotateCcw, Settings2, Stethoscope, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { isScreenId, isVariantId, roleIds, roles, screenIds, screens, variantIds, variants } from './catalog'
import type { ScreenId, VariantId } from './catalog'
import { note, resetDemo, useDemo } from './demo'
import { Activation, AiReview, DischargeForm, DischargeSummary, Login, NewPatient } from './forms-screens'
import { DoseHistory, MedicationDraft, MedicationReview, Medications } from './medication-screens'
import { Admin, Chat, PatientHome, StatusUpdate, Unanswered, WorkSchedule } from './patient-screens'
import { Discharges, DoctorReport, DoctorTasks, Patients, Queue, TaskDetail } from './workflow-screens'
import { MedicineTrackPreview } from './medicinetrack/preview'
import './design.css'

const route = getRouteApi('/(app)/design/$variant/$screen/')
const roleIcons = { access: LockKeyhole, hospital: Building2, coordinator: ClipboardList, doctor: Stethoscope, patient: UserRound, admin: Settings2 }

export function DesignPreview() {
  const { designVariant } = route.useRouteContext()
  return designVariant === 'medicinetrack' ? <MedicineTrackPreview /> : <LegacyDesignPreview />
}

function LegacyDesignPreview() {
  const { designVariant: variant, designScreen: screen } = route.useRouteContext()
  const navigate = useNavigate()
  const title = useRef<HTMLHeadingElement>(null)
  const [resetCount, setResetCount] = useState(0)
  const { role, name } = screens[screen]
  const roleScreens = screenIds.filter((id) => screens[id].role === role)
  const notice = useDemo((demo) => demo.notice)

  useEffect(() => {
    title.current?.focus({ preventScroll: true })
  }, [screen])

  return <div className="dp-preview" data-variant={variant}>
    <a href="#design-content" className="dp-skip">Asosiy tarkibga o‘tish</a>
    <header className="dp-review-bar">
      <Link to="/design" className="dp-gallery-link" aria-label="Variantlar"><ArrowLeft size={18} aria-hidden /> <span>Variantlar</span></Link>
      <nav className="dp-variant-nav" aria-label="Dizayn variantlari">
        {variantIds.map((id, index) => <Link
          key={id} to="/design/$variant/$screen" params={{ variant: id, screen }}
          aria-current={id === variant ? 'true' : undefined} aria-label={variants[id].name}
        ><span className="dp-variant-index">{index + 1}</span><span className="dp-variant-name">{variants[id].name}</span></Link>)}
      </nav>
      <select className="dp-variant-select" aria-label="Dizayn varianti" value={variant} onChange={(event) => {
        const next = event.target.value
        if (isVariantId(next)) void navigate({ to: '/design/$variant/$screen', params: { variant: next, screen } })
      }}>
        {variantIds.map((id) => <option key={id} value={id}>{variants[id].name}</option>)}
      </select>
      <button className="dp-button dp-reset" type="button" aria-label="Demoni tiklash" onClick={() => {
        resetDemo()
        note('Demo boshlang‘ich holatga qaytarildi.')
        setResetCount((previous) => previous + 1)
      }}><RotateCcw size={17} aria-hidden /> <span>Demoni tiklash</span></button>
    </header>
    <div className="dp-shell">
      <aside className="dp-sidebar">
        <Link to="/design" className="dp-brand" aria-label="MedicineTrack variantlari"><span><Activity size={20} aria-hidden /></span><strong>MedicineTrack</strong></Link>
        <nav className="dp-role-nav" aria-label="Demo rollari">
          {roleIds.map((id) => {
            const Icon = roleIcons[id]
            return <Link to="/design/$variant/$screen" params={{ variant, screen: roles[id].defaultScreen }} key={id}
              aria-current={role === id ? 'true' : undefined}><Icon size={19} aria-hidden />{roles[id].name}</Link>
          })}
        </nav>
        <span className="dp-local-marker"><span /> Sintetik demo</span>
      </aside>
      <div className="dp-workspace">
        <nav className="dp-screen-nav" aria-label={roles[role].name + ' sahifalari'}>
          {roleScreens.map((id) =>
            <Link key={id} to="/design/$variant/$screen" params={{ variant, screen: id }}
              aria-current={screen === id ? 'page' : undefined}>{screens[id].name}</Link>,
          )}
        </nav>
        <nav className="dp-mobile-navigation" aria-label="Demo navigatsiyasi">
          <label>Kabinet<select aria-label="Kabinet" value={role} onChange={(event) => {
            const next = roleIds.find((id) => id === event.target.value)
            if (next) void navigate({ to: '/design/$variant/$screen', params: { variant, screen: roles[next].defaultScreen } })
          }}>
            {roleIds.map((id) => <option key={id} value={id}>{roles[id].name}</option>)}
          </select></label>
          <label>Sahifa<select aria-label="Sahifa" value={screen} onChange={(event) => {
            const next = event.target.value
            if (isScreenId(next)) void navigate({ to: '/design/$variant/$screen', params: { variant, screen: next } })
          }}>
            {roleScreens.map((id) => <option key={id} value={id}>{screens[id].name}</option>)}
          </select></label>
        </nav>
        <main className="dp-workspace-content" id="design-content">
          <div className="dp-heading">
            <p><LayoutGrid size={15} aria-hidden /> {roles[role].name}</p>
            <h1 ref={title} tabIndex={-1}>{name}</h1>
          </div>
          <div role="status" className={notice ? 'dp-notice' : 'sr-only'}>{notice}</div>
          <div className="dp-screen-body"><ScreenContent key={screen + resetCount} variant={variant} screen={screen} /></div>
        </main>
      </div>
    </div>
  </div>
}

function ScreenContent({ variant, screen }: { variant: VariantId; screen: ScreenId }) {
  switch (screen) {
    case 'login': return <Login variant={variant} />
    case 'activation': return <Activation variant={variant} />
    case 'discharges': return <Discharges variant={variant} />
    case 'patients': return <Patients />
    case 'new-patient': return <NewPatient variant={variant} />
    case 'new-discharge': return <DischargeForm variant={variant} />
    case 'ai-review': return <AiReview />
    case 'confirm-discharge': return <DischargeSummary variant={variant} />
    case 'hospital-task': return <TaskDetail role="hospital" />
    case 'draft-medication': return <MedicationDraft variant={variant} />
    case 'queue': return <Queue variant={variant} />
    case 'coordinator-task': return <TaskDetail role="coordinator" />
    case 'unanswered': return <Unanswered />
    case 'work-schedule': return <WorkSchedule />
    case 'doctor-tasks': return <DoctorTasks variant={variant} />
    case 'doctor-task': return <TaskDetail role="doctor" />
    case 'contact-attempt': return <DoctorReport variant={variant} contact />
    case 'visit-report': return <DoctorReport variant={variant} />
    case 'doctor-chat': return <Chat role="doctor" />
    case 'medication-review': return <MedicationReview />
    case 'doctor-history': return <DoseHistory doctor />
    case 'patient-home': return <PatientHome />
    case 'patient-chat': return <Chat role="patient" />
    case 'status-update': return <StatusUpdate variant={variant} />
    case 'medications': return <Medications />
    case 'dose-history': return <DoseHistory />
    case 'admin': return <Admin />
  }
}
