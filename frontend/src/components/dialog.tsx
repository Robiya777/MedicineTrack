import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

export function Dialog({
  title,
  close,
  children,
  drawer = false,
  pending = false,
}: {
  title: string
  close: () => void
  children: ReactNode
  drawer?: boolean
  pending?: boolean
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
      className={'mt-dialog' + (drawer ? ' mt-drawer' : '')}
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault()
        if (!pending) close()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) close()
      }}
    >
      <header className="mt-dialog-header">
        <h2 id={headingId}>{title}</h2>
        <button
          type="button"
          className="mt-button mt-button-quiet mt-icon-button"
          disabled={pending}
          onClick={close}
          aria-label="Yopish"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      {children}
    </dialog>
  )
}
