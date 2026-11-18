import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

export function Dialog({
  title,
  close,
  children,
  drawer = false,
  pending = false,
  actions,
  scrollBody = false,
}: {
  title: string
  close: () => void
  children: ReactNode
  drawer?: boolean
  pending?: boolean
  actions?: ReactNode
  scrollBody?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  useEffect(() => {
    const node = dialog.current
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    node?.showModal()
    return () => {
      node?.close()
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      className={`fixed inset-0 z-50 m-auto w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-xs ${drawer ? 'sm:max-w-xl' : ''} ${scrollBody ? 'max-h-[calc(100dvh-2rem)] overflow-hidden' : ''}`}
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault()
        if (!pending) close()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) close()
      }}
    >
      <header className="mb-5 flex shrink-0 gap-3 items-center justify-between border-b border-line pb-4">
        <h2
          id={headingId}
          className="text-xl font-bold tracking-tight text-ink"
        >
          {title}
        </h2>
        <div className="ml-auto flex shrink-0 items-center gap-2">
        {actions}
        <button
          type="button"
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted transition hover:bg-page hover:text-ink disabled:opacity-50"
          disabled={pending}
          onClick={close}
          aria-label="Yopish"
        >
          <X size={20} aria-hidden="true" />
        </button>
        </div>
      </header>
      <div className={scrollBody ? "max-h-[calc(100dvh-10rem)] overflow-y-auto overscroll-contain space-y-4 pr-1" : "space-y-4"}>{children}</div>
    </dialog>
  )
}
