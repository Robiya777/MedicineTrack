import { useEffect, useRef, useState, type ReactNode } from 'react'
import './schedule-toolbar.css'

export function ScheduleToolbar({children}: {children: ReactNode}) {
  const marker = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if(marker.current) setStuck(marker.current.getBoundingClientRect().top <= 72)
      })
    }
    update()
    window.addEventListener('scroll', update, {passive:true})
    window.addEventListener('resize', update)
    return () => {cancelAnimationFrame(frame);window.removeEventListener('scroll',update);window.removeEventListener('resize',update)}
  }, [])
  return <><div ref={marker} className="schedule-toolbar-marker" aria-hidden="true" /><div className="schedule-toolbar" data-stuck={stuck}>{children}</div></>
}
