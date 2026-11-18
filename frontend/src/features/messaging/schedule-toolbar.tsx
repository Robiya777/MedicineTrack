import { useEffect, useRef, useState, type ReactNode } from 'react'
import './schedule-toolbar.css'

export function ScheduleToolbar({children}: {children: ReactNode}) {
  const marker = useRef<HTMLDivElement>(null)
  const toolbar = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if(marker.current) setStuck(marker.current.getBoundingClientRect().top <= 72)
      })
    }
    const node = toolbar.current
    const resize = new ResizeObserver(() => {
      if(node) node.parentElement?.style.setProperty('--schedule-toolbar-height', `${node.getBoundingClientRect().height}px`)
    })
    if(node) resize.observe(node)
    update()
    window.addEventListener('scroll', update, {passive:true})
    window.addEventListener('resize', update)
    return () => {resize.disconnect();cancelAnimationFrame(frame);window.removeEventListener('scroll',update);window.removeEventListener('resize',update)}
  }, [])
  return <><div ref={marker} className="schedule-toolbar-marker" aria-hidden="true" /><div ref={toolbar} className="schedule-toolbar" data-stuck={stuck}>{children}</div></>
}
