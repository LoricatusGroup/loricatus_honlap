import { useEffect, useLayoutEffect, useState } from 'react'

export type TourStep = {
  target?: string // data-tour="<value>"; omit for a centered step
  title: string
  body: string
  show?: boolean // include this step (default true)
}

type Rect = { top: number; left: number; width: number; height: number }

// Lightweight guided-tour overlay: dims the screen, spotlights the target
// element, and shows a tooltip card with prev/next/skip. No external deps.
export default function Tour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const active = steps.filter((s) => s.show !== false)
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  // Clamp so the tour never indexes past the end if the visible-step set
  // shrinks mid-tour (a `show` condition flipping); avoids reading undefined.
  const idx = Math.min(i, Math.max(0, active.length - 1))
  const step = active[idx]

  const measure = () => {
    if (!step?.target) {
      setRect(null)
      return
    }
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
    if (!el) {
      setRect(null)
      return
    }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }

  const next = () => {
    if (idx >= active.length - 1) onClose()
    else setI(idx + 1)
  }

  // If there is nothing to show, close on the next tick (never setState during render).
  useEffect(() => {
    if (active.length === 0) onClose()
  }, [active.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(measure, [idx]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }) // re-bind each render so `step` is current

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') setI(Math.max(0, idx - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  if (!step) return null

  const pad = 6
  const hole = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null

  // Tooltip position: below the target if there's room, else above; centered if no target.
  const cardW = 320
  let cardStyle: React.CSSProperties
  if (hole) {
    const belowRoom = window.innerHeight - (hole.top + hole.height)
    const top = belowRoom > 180 ? hole.top + hole.height + 12 : Math.max(12, hole.top - 12 - 170)
    let left = hole.left + hole.width / 2 - cardW / 2
    left = Math.max(12, Math.min(left, window.innerWidth - cardW - 12))
    cardStyle = { position: 'fixed', top, left, width: cardW }
  } else {
    cardStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: cardW,
    }
  }

  return (
    <div className="fixed inset-0 z-[3000]">
      {/* Dimmer: full-screen tint, or a spotlight hole via a big box-shadow */}
      {hole ? (
        <div
          style={{
            position: 'fixed',
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            borderRadius: 12,
            boxShadow: '0 0 0 9999px rgba(8,10,15,0.62)',
            border: '2px solid rgba(129,140,248,0.9)',
            pointerEvents: 'none',
            transition: 'all 0.2s ease',
          }}
        />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,15,0.62)' }} />
      )}

      <div className="cms-modal-panel p-5" style={cardStyle}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            {idx + 1} / {active.length}
          </span>
          <button onClick={onClose} className="cms-icon-btn -mr-1.5 -mt-1" aria-label="Kihagyás">
            ✕
          </button>
        </div>
        <h3 className="text-[15px] font-semibold text-white">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-300">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <button onClick={onClose} className="cms-btn-ghost !px-2 !text-xs">
            Kihagyom
          </button>
          <div className="flex gap-1.5">
            {idx > 0 && (
              <button onClick={() => setI(idx - 1)} className="cms-btn-secondary !py-1.5 !text-xs">
                Vissza
              </button>
            )}
            <button onClick={next} className="cms-btn-primary !py-1.5 !text-xs">
              {idx >= active.length - 1 ? 'Kész ✓' : 'Tovább →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
