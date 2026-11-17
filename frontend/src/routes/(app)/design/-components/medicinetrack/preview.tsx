import { Link } from '@tanstack/react-router'
import {
  ArrowLeft, CheckCheck, CircleAlert,
  Clock3, Filter, HeartPulse, LayoutDashboard, ListFilter, MapPin, Menu, RefreshCw,
  RotateCcw, SearchX, ShieldCheck, SlidersHorizontal, UserRound, UsersRound,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  createPreviewTasks, isOpen, isOverdue, matchesSegment, previewDate,
  previewDoctors, previewFacilities, segments, type PreviewSegment, type PreviewTask,
} from './data'
import { PreviewDialog, TaskDetailDialog } from './dialogs'
import { TaskTable } from './task-table'
import './theme.css'
import './preview.css'

type ViewState = 'normal' | 'loading' | 'empty' | 'error'
const pageSize = 6

export function MedicineTrackPreview() {
  const [snapshot] = useState(() => {
    const now = Date.now()
    return { now, tasks: createPreviewTasks(now) }
  })
  const [now, setNow] = useState(snapshot.now)
  const [segment, setSegment] = useState<PreviewSegment>('all')
  const [doctor, setDoctor] = useState('')
  const [facility, setFacility] = useState('')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [mobileFilters, setMobileFilters] = useState(false)
  const [selected, setSelected] = useState<PreviewTask | null>(null)
  const [viewState, setViewState] = useState<ViewState>('normal')
  const [refreshing, setRefreshing] = useState(false)
  const [notice, setNotice] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  useEffect(() => {
    if (!refreshing) return
    const timer = setTimeout(() => {
      setNow(Date.now())
      setRefreshing(false)
      setNotice('Preview yangilandi.')
    }, 650)
    return () => clearTimeout(timer)
  }, [refreshing])
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const counts = Object.fromEntries(segments.map((item) => [
    item.id, snapshot.tasks.filter((task) => matchesSegment(task, item.id, now)).length,
  ])) as Record<PreviewSegment, number>
  const matching = snapshot.tasks.filter((task) => (
    matchesSegment(task, segment, now) &&
    (!doctor || task.doctorId === doctor) &&
    (!facility || task.facilityId === facility)
  )).sort((a, b) => order === 'asc' ? a.dueAt - b.dueAt : b.dueAt - a.dueAt)
  const visiblePage = Math.min(page, Math.max(1, Math.ceil(matching.length / pageSize)))
  const tasks = matching.slice((visiblePage - 1) * pageSize, visiblePage * pageSize)
  const loading = viewState === 'loading' || refreshing
  const empty = viewState === 'empty' || matching.length === 0
  const filterCount = Number(Boolean(doctor)) + Number(Boolean(facility))

  function selectSegment(next: PreviewSegment) {
    setSegment(next)
    setPage(1)
    setMobileMenu(false)
  }

  function resetFilters() {
    setSegment('all')
    setDoctor('')
    setFacility('')
    setPage(1)
    setViewState('normal')
  }

  function refresh() {
    setViewState('normal')
    setRefreshing(true)
    setNotice('')
  }

  const navigation = (
    <PreviewNavigation segment={segment} counts={counts} select={selectSegment} />
  )

  return (
    <div className="mt-theme mt-preview">
      <a href="#mt-main" className="mt-skip">Asosiy tarkibga o‘tish</a>
      <aside className="mt-sidebar">
        <Brand />
        {navigation}
        <div className="mt-sidebar-bottom">
          <div className="mt-territory"><span><MapPin size={16} aria-hidden="true" />Xizmat hududi</span><strong>Yunusobod tumani</strong></div>
          <Link to="/design" className="mt-return"><ArrowLeft size={16} aria-hidden="true" />Dizayn variantlari</Link>
          <span className="mt-preview-caption"><span aria-hidden="true" />Sintetik preview</span>
        </div>
      </aside>

      <div className="mt-workspace">
        <header className="mt-topbar">
          <button type="button" className="mt-button mt-button-quiet mt-icon-button mt-menu-trigger" aria-label="Menyuni ochish" aria-expanded={mobileMenu} onClick={() => setMobileMenu(true)}><Menu size={22} /></button>
          <div className="mt-topbar-location"><MapPin size={17} aria-hidden="true" /><span>Yunusobod tumani</span></div>
          <div className="mt-topbar-right">
            <span className="mt-demo-label">Dizayn preview</span>
            <div className="mt-profile"><span className="mt-avatar" aria-hidden="true">NA</span><div><strong>Nodira Akramova</strong><span>Hudud koordinatori</span></div></div>
          </div>
        </header>

        <main className="mt-main" id="mt-main">
          <div className="mt-page-heading">
            <div><h1 ref={heading} tabIndex={-1}>Koordinator kabineti</h1><p>Statsionardan keyingi 24 soatlik kuzatuv.</p></div>
            <button type="button" className="mt-button" disabled={refreshing} onClick={refresh}>
              <RefreshCw size={16} className={refreshing ? 'mt-spin' : undefined} aria-hidden="true" />{refreshing ? 'Yangilanmoqda' : 'Yangilash'}
            </button>
          </div>

          <Metrics tasks={snapshot.tasks} now={now} />

          <section className="mt-card mt-queue" aria-labelledby="mt-queue-heading">
            <div className="mt-queue-heading">
              <div><h2 id="mt-queue-heading">Chaqiruvlar navbati</h2><span className="mt-total-count">{snapshot.tasks.length}</span></div>
              <div className="mt-queue-date"><Clock3 size={15} aria-hidden="true" />{previewDate(now, true)}</div>
            </div>

            <div className="mt-segments" role="group" aria-label="Chaqiruv holati">
              {segments.map((item) => (
                <button type="button" key={item.id} aria-pressed={segment === item.id} onClick={() => selectSegment(item.id)}>
                  {item.label}<span>{counts[item.id]}</span>
                </button>
              ))}
            </div>

            <div className="mt-filter-mobile-heading">
              <p>{segment === 'soon' ? 'Keyingi 4 soat ichida' : 'Hududingizdagi chaqiruvlar'}</p>
              <button type="button" className={'mt-button' + (mobileFilters ? ' mt-filter-active' : '')} aria-expanded={mobileFilters} aria-controls="mt-filters" onClick={() => setMobileFilters(!mobileFilters)}>
                <SlidersHorizontal size={15} aria-hidden="true" />Filtrlar{filterCount > 0 ? ' (' + filterCount + ')' : ''}
              </button>
            </div>
            <div id="mt-filters" className={'mt-filters' + (mobileFilters ? ' mt-filters-open' : '')}>
              <div className="mt-field"><label htmlFor="mt-doctor-filter">Mas’ul shifokor</label>
                <select id="mt-doctor-filter" className="mt-input" value={doctor} onChange={(event) => { setDoctor(event.currentTarget.value); setPage(1) }}>
                  <option value="">Barcha shifokorlar</option>
                  {previewDoctors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div className="mt-field"><label htmlFor="mt-facility-filter">Muassasa</label>
                <select id="mt-facility-filter" className="mt-input" value={facility} onChange={(event) => { setFacility(event.currentTarget.value); setPage(1) }}>
                  <option value="">Barcha muassasalar</option>
                  {previewFacilities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <button type="button" className="mt-clear-filters" onClick={resetFilters} disabled={segment === 'all' && !filterCount}>
                <RotateCcw size={14} aria-hidden="true" />Tozalash
              </button>
              <p className="mt-queue-scope">{segment === 'soon' ? 'Keyingi 4 soatda muddati tugaydi' : 'Vaqt zonasi — Toshkent'}</p>
            </div>

            <div className="mt-queue-content" aria-busy={loading}>
              {loading ? <LoadingRows /> : viewState === 'error' ? (
                <QueueState error recover={refresh} />
              ) : empty ? (
                <QueueState recover={resetFilters} />
              ) : (
                <TaskTable
                  tasks={tasks} total={matching.length} page={visiblePage} pageSize={pageSize} now={now} order={order}
                  onOrder={() => { setOrder(order === 'asc' ? 'desc' : 'asc'); setPage(1) }}
                  onPage={setPage} onSelect={setSelected}
                />
              )}
            </div>
          </section>

          <footer className="mt-page-footer">
            <p><ShieldCheck size={15} aria-hidden="true" />Sintetik ma’lumotlar</p>
            <p className="mt-numeric">Yangilangan vaqt {new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' }).format(now)}</p>
          </footer>
          <details className="mt-preview-controls">
            <summary><ListFilter size={15} aria-hidden="true" />Preview holatlari</summary>
            <div className="mt-field"><label htmlFor="mt-preview-state">Jadval holatini ko‘rish</label>
              <select id="mt-preview-state" className="mt-input" value={viewState} onChange={(event) => {
                const state = event.currentTarget.value
                if (['normal', 'loading', 'empty', 'error'].includes(state)) setViewState(state as ViewState)
              }}>
                <option value="normal">Oddiy holat</option>
                <option value="loading">Yuklanish</option>
                <option value="empty">Bo‘sh ro‘yxat</option>
                <option value="error">Ulanish xatosi</option>
              </select>
            </div>
          </details>
          <p className="mt-sr-only" role="status">{notice}</p>
        </main>
      </div>

      {mobileMenu && (
        <PreviewDialog title="MedicineTrack" close={() => setMobileMenu(false)} drawer>
          {navigation}
          <div className="mt-drawer-bottom"><span>Yunusobod tumani</span><Link to="/design" className="mt-return"><ArrowLeft size={16} aria-hidden="true" />Dizayn variantlari</Link></div>
        </PreviewDialog>
      )}
      {selected && <TaskDetailDialog task={selected} close={() => setSelected(null)} />}
    </div>
  )
}

function Brand() {
  return <div className="mt-brand"><span><HeartPulse size={23} strokeWidth={1.8} aria-hidden="true" /></span><strong>MedicineTrack</strong></div>
}

function PreviewNavigation({ segment, counts, select }: {
  segment: PreviewSegment
  counts: Record<PreviewSegment, number>
  select: (segment: PreviewSegment) => void
}) {
  const items = [
    { id: 'all' as const, label: 'Chaqiruvlar', Icon: LayoutDashboard },
    { id: 'unassigned' as const, label: 'Mas’ulsiz', Icon: UserRound },
    { id: 'soon' as const, label: 'Muddati yaqin', Icon: Clock3 },
    { id: 'overdue' as const, label: 'Kechikkan', Icon: CircleAlert },
  ]
  return (
    <nav className="mt-navigation" aria-label="Koordinator bo‘limlari">
      {items.map(({ id, label, Icon }) => (
        <button key={id} type="button" aria-current={segment === id ? 'page' : undefined} onClick={() => select(id)}>
          <Icon size={19} strokeWidth={1.7} aria-hidden="true" /><span>{label}</span>
          {id !== 'all' && <span className={'mt-nav-count' + (id === 'overdue' ? ' mt-nav-count-danger' : '')}>{counts[id]}</span>}
        </button>
      ))}
    </nav>
  )
}

function Metrics({ tasks, now }: { tasks: PreviewTask[]; now: number }) {
  const completed = tasks.filter((task) => task.status === 'COMPLETED')
  const onTime = completed.filter((task) => task.completedAt !== null && task.completedAt <= task.dueAt).length
  const assessed = tasks.filter((task) => task.status !== 'CANCELLED' && (task.status === 'COMPLETED' || task.dueAt < now)).length
  const metrics = [
    { label: 'Aktiv chaqiruvlar', value: tasks.filter(isOpen).length, Icon: UsersRound, kind: 'primary' },
    { label: 'Mas’ulsiz', value: tasks.filter((task) => task.status === 'UNASSIGNED').length, Icon: UserRound, kind: 'warning' },
    { label: 'Kechikkan', value: tasks.filter((task) => isOverdue(task, now)).length, Icon: Clock3, kind: 'danger' },
    { label: 'O‘z vaqtida bajarish', value: assessed ? Math.round(onTime / assessed * 100) + '%' : '—', Icon: CheckCheck, kind: 'primary' },
  ]
  return (
    <section aria-label="Hudud bo‘yicha ko‘rsatkichlar" className="mt-metrics">
      {metrics.map(({ label, value, Icon, kind }) => (
        <div className="mt-card mt-metric" key={label}>
          <div className="mt-metric-top"><span>{label}</span><span className={'mt-metric-icon mt-metric-icon-' + kind}><Icon size={19} strokeWidth={1.7} aria-hidden="true" /></span></div>
          <div className="mt-metric-value mt-numeric">{value}</div>
          {label === 'O‘z vaqtida bajarish' && <span className="mt-metric-denominator">{onTime} / {assessed} chaqiruv</span>}
        </div>
      ))}
    </section>
  )
}

function LoadingRows() {
  return <div className="mt-loading" role="status"><span className="mt-sr-only">Chaqiruvlar yuklanmoqda…</span>{Array.from({ length: 5 }, (_, index) => (
    <div key={index} className="mt-skeleton-row" aria-hidden="true"><i /><div><b /><span /></div><b /><span /></div>
  ))}</div>
}

function QueueState({ error = false, recover }: { error?: boolean; recover: () => void }) {
  const Icon = error ? CircleAlert : SearchX
  return (
    <div className={'mt-empty-state' + (error ? ' mt-error-state' : '')}>
      <span className="mt-empty-icon"><Icon size={27} strokeWidth={1.6} aria-hidden="true" /></span>
      <h3>{error ? 'Chaqiruvlar yuklanmadi' : 'Chaqiruv topilmadi'}</h3>
      <p role={error ? 'alert' : 'status'}>{error ? 'Ulanishni tekshirib, qayta urinib ko‘ring.' : 'Boshqa filtrlarni tanlang yoki ularni tozalang.'}</p>
      <button type="button" className="mt-button mt-button-primary" onClick={recover}>{error ? <RefreshCw size={16} aria-hidden="true" /> : <Filter size={16} aria-hidden="true" />}{error ? 'Qayta urinish' : 'Filtrlarni tozalash'}</button>
    </div>
  )
}
