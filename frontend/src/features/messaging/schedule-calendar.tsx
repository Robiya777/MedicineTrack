import { useRef, useState } from 'react'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import { Dialog, inputStyle, primaryButton, secondaryButton } from '@/components/ui'

type Interval = { start: string; end: string }
const days = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba']
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
const time = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
export function ScheduleCalendar({ intervals, change, singleLabel }: {
  intervals: (Interval & { weekday: number })[]
  change: (value: (Interval & { weekday: number })[]) => void
  singleLabel?: string
}) {
  const [day, setDay] = useState(0)
  const [edit, setEdit] = useState<{ weekday: number; index: number; start: string; end: string } | null>(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{weekday:number; start:number; end:number} | null>(null)
  const suppressClick = useRef(false)
  const drag = useRef<{weekday:number; start:number; index:number} | null>(null)
  const labels = singleLabel ? [singleLabel] : days
  function open(weekday: number, start = '09:00', end = '10:00', index = -1) {
    setError(''); setEdit({weekday, start, end, index})
  }
  function apply() {
    if (!edit) return
    const next = intervals.filter((_, i) => i !== edit.index)
    if (!edit.start || !edit.end || edit.start >= edit.end || next.some(i => i.weekday === edit.weekday && i.start < edit.end && i.end > edit.start)) {
      setError('Vaqtlar to‘g‘ri tartibda bo‘lishi va boshqa oraliq bilan kesishmasligi kerak.'); return
    }
    change([...next, {weekday: edit.weekday, start: edit.start, end: edit.end}]); setEdit(null)
  }
  return <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
      <div className="flex items-center gap-2 text-sm font-semibold"><CalendarDays size={18} aria-hidden="true" />{singleLabel || 'Haftalik ish vaqti'}</div>
      <button type="button" className={secondaryButton} onClick={() => open(day)}><Plus size={16} aria-hidden="true" />Oraliq</button>
      <p className="w-full text-xs text-muted">Vaqtni bosib yoki pastga tortib belgilang. Blokni bosib tahrirlang.</p>
    </div>
    {!singleLabel && <div className="flex gap-1 overflow-x-auto p-2 md:hidden" aria-label="Hafta kuni">{labels.map((label, i) => <button type="button" key={label} aria-pressed={day === i} onClick={() => setDay(i)} className={`min-h-11 rounded-lg px-3 text-sm ${day === i ? 'bg-primary text-white' : 'text-muted'}`}>{label.slice(0, 3)}</button>)}</div>}
    <div className="max-h-[580px] overflow-auto overscroll-contain" ref={node => { if(node && !node.dataset.ready) {node.scrollTop = 6 * 48; node.dataset.ready='true'} }}>
      <div className={`sticky top-0 z-20 grid border-b border-line bg-surface ${singleLabel ? 'grid-cols-[52px_1fr]' : 'grid-cols-[52px_1fr] md:grid-cols-[52px_repeat(7,minmax(0,1fr))]'}`}>
        <span className="p-2 text-[10px] text-muted">Soat</span>{labels.map((label,i) => <div key={label} className={`border-l border-line p-3 text-center text-xs font-semibold ${!singleLabel && i !== day ? 'hidden md:block' : ''}`}>{label}</div>)}
      </div>
      <div className={`grid ${singleLabel ? 'grid-cols-[52px_1fr]' : 'grid-cols-[52px_1fr] md:grid-cols-[52px_repeat(7,minmax(0,1fr))]'}`}>
        <div className="relative h-[1152px] text-[10px] tabular-nums text-muted">{Array.from({length:24},(_,i)=><span key={i} className="absolute right-2" style={{top:i*48+3}}>{String(i).padStart(2,'0')}:00</span>)}</div>
        {labels.map((label,weekday) => <div key={label} className={`relative h-[1152px] border-l border-line bg-[repeating-linear-gradient(to_bottom,transparent_0px,transparent_23px,#edf2ef_23px,#edf2ef_24px)] ${!singleLabel && weekday !== day ? 'hidden md:block' : ''}`}
          onPointerDown={e => {
            if(e.target !== e.currentTarget || e.button !== 0 || e.pointerType === 'touch') return
            const start = Math.min(1410,Math.max(0,Math.floor((e.clientY-e.currentTarget.getBoundingClientRect().top)/12)*15))
            drag.current={weekday,start,index:-1};e.currentTarget.setPointerCapture(e.pointerId);setPreview({weekday,start,end:start+30})
          }}
          onPointerMove={e=>{if(!drag.current)return;const end=Math.min(1439,Math.max(0,Math.round((e.clientY-e.currentTarget.getBoundingClientRect().top)/12)*15));setPreview({weekday,start:Math.min(drag.current.start,end),end:Math.max(drag.current.start+15,end)})}}
          onPointerUp={()=>{suppressClick.current=true;if(preview && drag.current)open(weekday,time(preview.start),time(preview.end),drag.current.index);drag.current=null;setPreview(null)}}
          onPointerCancel={()=>{drag.current=null;setPreview(null)}}
          onClick={e=>{if(suppressClick.current){suppressClick.current=false;return}if(e.target===e.currentTarget && e.detail===1 && !edit) {const start=Math.min(1380,Math.floor((e.clientY-e.currentTarget.getBoundingClientRect().top)/48)*60);open(weekday,time(start),time(start+60))}}}>
          {intervals.map((interval,index)=>interval.weekday===weekday && <button type="button" key={index} onClick={()=>open(weekday,interval.start,interval.end,index)} className="absolute left-1 right-1 overflow-hidden rounded-lg border-l-[3px] border-primary bg-mint px-2 py-1 text-left text-xs text-primary-hover shadow-xs" style={{top:minutes(interval.start)*.8,height:Math.max(20,(minutes(interval.end)-minutes(interval.start))*.8)}}>
            <strong className="block">Ish vaqti</strong><span className="tabular-nums">{interval.start}–{interval.end}</span>
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize border-b-2 border-primary/40" onPointerDown={e=>{e.stopPropagation();const column=e.currentTarget.parentElement?.parentElement;column?.setPointerCapture(e.pointerId);drag.current={weekday,start:minutes(interval.start),index};setPreview({weekday,start:minutes(interval.start),end:minutes(interval.end)})}} />
          </button>)}
          {preview?.weekday===weekday && <div className="pointer-events-none absolute inset-x-1 z-10 rounded-lg border border-dashed border-primary bg-primary/20 p-1 text-xs text-primary" style={{top:preview.start*.8,height:(preview.end-preview.start)*.8}}>{time(preview.start)}–{time(preview.end)}</div>}
        </div>)}
      </div>
    </div>
    {edit && <Dialog title={edit.index < 0 ? 'Ish vaqti qo‘shish' : 'Ish vaqtini tahrirlash'} close={()=>setEdit(null)}>
      <p className="text-sm text-muted">{labels[edit.weekday]}</p>
      <div className="grid grid-cols-2 gap-4"><label className="text-sm">Boshlanish<input aria-label="Boshlanish" type="time" className={inputStyle} value={edit.start} onChange={e=>setEdit({...edit,start:e.target.value})} /></label><label className="text-sm">Tugash<input aria-label="Tugash" type="time" className={inputStyle} value={edit.end} onChange={e=>setEdit({...edit,end:e.target.value})} /></label></div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">{edit.index>=0 && <button type="button" className={secondaryButton} onClick={()=>{change(intervals.filter((_,i)=>i!==edit.index));setEdit(null)}}><Trash2 size={16} aria-hidden="true" />O‘chirish</button>}<button type="button" className={secondaryButton} onClick={()=>setEdit(null)}>Bekor qilish</button><button type="button" className={primaryButton} onClick={apply}>Qo‘llash</button></div>
    </Dialog>}
  </div>
}
