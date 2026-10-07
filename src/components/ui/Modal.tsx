import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

const widths = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  size?: keyof typeof widths
  footer?: ReactNode
  children: ReactNode
  /** Form gönderilirken yanlışlıkla kapanmasın. */
  dismissible?: boolean
}

/** Native <dialog> üzerine kurulu modal: odak yönetimi ve Esc ile kapanma tarayıcıdan gelir. */
export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  size = 'md',
  footer,
  children,
  dismissible = true,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        if (dismissible) onClose()
      }}
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose()
      }}
      className={cn(
        'm-auto w-[calc(100%-2rem)] overflow-visible bg-transparent p-0 text-ink-100 backdrop:animate-fade-in',
        widths[size],
      )}
    >
      {open && (
        <div className="panel flex max-h-[min(88vh,900px)] animate-rise flex-col !bg-ink-850/95 shadow-2xl shadow-black/60">
          <div className="flex items-start justify-between gap-4 border-b border-white/6 px-6 py-4">
            <div className="flex min-w-0 items-center gap-3">
              {icon && (
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-400/20">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-base font-semibold">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-ink-400">{description}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={!dismissible}
              className="rounded-md p-1 text-ink-400 transition hover:bg-white/6 hover:text-ink-100 disabled:opacity-40"
              aria-label="Kapat"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-white/6 bg-black/10 px-6 py-3.5">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}
