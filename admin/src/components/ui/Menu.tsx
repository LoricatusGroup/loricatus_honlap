import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

// Small dropdown menu: a trigger button + a glass popover that closes on
// outside-click / Esc. Used to declutter the editor toolbar.
export function Menu({
  label,
  icon,
  active,
  accent,
  align = 'left',
  trigger,
  children,
}: {
  label?: string
  icon?: string
  active?: boolean
  accent?: string
  align?: 'left' | 'right'
  trigger?: (open: boolean) => ReactNode
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      {trigger ? (
        <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`cms-tool${active || open ? ' is-active' : ''}`}
          style={accent ? ({ '--acc': accent } as CSSProperties) : undefined}
        >
          {icon && <span className="mr-0.5">{icon}</span>}
          {label}
          <span className="ml-1 text-[9px] opacity-60">▾</span>
        </button>
      )}
      {open && (
        <div className={`cms-menu ${align === 'right' ? 'right-0' : 'left-0'}`} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  icon,
  label,
  hint,
  active,
  danger,
  onClick,
}: {
  icon?: string
  label: string
  hint?: string
  active?: boolean
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={`cms-menu-item${danger ? ' is-danger' : ''}`}>
      <span className="cms-menu-check">{active ? '✓' : ''}</span>
      {icon && <span className="cms-menu-ico">{icon}</span>}
      <span className="min-w-0 flex-1 text-left">
        {label}
        {hint && <span className="block truncate text-[10px] text-gray-400">{hint}</span>}
      </span>
    </button>
  )
}

export function MenuSep() {
  return <div className="cms-menu-sep" />
}
