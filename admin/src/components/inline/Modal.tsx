import { useEffect, type ReactNode } from 'react'

interface Props {
  label: string
  caption?: ReactNode
  maxWidth?: string // Tailwind max-w-* class
  onClose: () => void
  children: ReactNode
  footer: ReactNode
}

// Shared premium glass dialog shell used by every inline editor modal.
// Backdrop click and Escape both close.
export default function Modal({
  label,
  caption,
  maxWidth = 'max-w-xl',
  onClose,
  children,
  footer,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="cms-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`cms-modal-panel flex max-h-[90vh] w-full ${maxWidth} flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-5 pb-4">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-tight text-white">{label}</h3>
            {caption ? (
              <p className="mt-1 text-xs leading-relaxed text-gray-400">{caption}</p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Bezárás"
            onClick={onClose}
            className="cms-icon-btn -mr-1.5 -mt-1 shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6">{children}</div>

        <div className="flex shrink-0 justify-end gap-2 px-6 pb-5 pt-4">{footer}</div>
      </div>
    </div>
  )
}
