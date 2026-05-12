import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import type { LayoutState, Position } from '../lib/types'
import {
  collectPositionableElements,
  POSITION_DESKTOP_MIN_PX,
} from '../lib/iframeBridge'

interface HandleData {
  id: string
  el: Element
  top: number          // parent-page coordinates (incl. scroll)
  left: number
  width: number
  height: number
}

interface Props {
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  layout: LayoutState
  onChange: (next: LayoutState) => void
  enabled: boolean
}

export default function LiveFreeformOverlay({ iframeRef, layout, onChange, enabled }: Props) {
  const [handles, setHandles] = useState<HandleData[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const positionsRef = useRef(layout.positions)
  const onChangeRef = useRef(onChange)
  const layoutRef = useRef(layout)

  useEffect(() => {
    positionsRef.current = layout.positions
    onChangeRef.current = onChange
    layoutRef.current = layout
  }, [layout, onChange])

  // Recompute handle positions when enabled, iframe changes, or layout changes,
  // plus on iframe scroll / window resize / iframe DOM mutations.
  useEffect(() => {
    if (!enabled) {
      setHandles([])
      return
    }
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    const win = iframe?.contentWindow
    if (!iframe || !doc || !win) return

    // Bail out below desktop breakpoint
    if (win.innerWidth < POSITION_DESKTOP_MIN_PX) {
      setHandles([])
      return
    }

    let rafId: number | null = null
    const compute = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        // Position handles in the WRAPPER's coordinate space (the iframe's
        // offsetParent, which is the LivePreview's position:relative div) —
        // NOT document/viewport space. iframe.offsetTop is the iframe's
        // distance from the wrapper's content-box top; element.getBoundingClientRect
        // is iframe-viewport-relative (i.e. 0 at iframe's content-box top,
        // factoring in any internal iframe scroll).
        const ifTop = iframe.offsetTop
        const ifLeft = iframe.offsetLeft
        const items = collectPositionableElements(doc)
        const next: HandleData[] = []
        for (const { id, el } of items) {
          if ((el as HTMLElement).hidden) continue
          const r = (el as HTMLElement).getBoundingClientRect()
          if (r.height === 0 || r.width === 0) continue
          next.push({
            id,
            el,
            top: ifTop + r.top,
            left: ifLeft + r.left,
            width: r.width,
            height: r.height,
          })
        }
        setHandles(next)
      })
    }

    compute()
    doc.addEventListener('scroll', compute, { passive: true, capture: true })
    window.addEventListener('resize', compute)

    const observer = new MutationObserver(compute)
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'style'],
    })

    return () => {
      doc.removeEventListener('scroll', compute, { capture: true } as EventListenerOptions)
      window.removeEventListener('resize', compute)
      observer.disconnect()
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [enabled, iframeRef, layout])

  const startDrag = (handle: HandleData, e: ReactMouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDraggingId(handle.id)

    const iframe = iframeRef.current
    if (iframe) iframe.style.pointerEvents = 'none'
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'

    const startX = e.clientX
    const startY = e.clientY
    const startPos: Position = positionsRef.current?.[handle.id] ?? { x: 0, y: 0 }
    const el = handle.el as HTMLElement

    let liveX = startPos.x
    let liveY = startPos.y

    const onMove = (ev: globalThis.MouseEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      liveX = startPos.x + dx
      liveY = startPos.y + dy
      // Apply directly to DOM for smooth interaction; commit to state on mouseup
      el.style.transform = `translate(${liveX}px, ${liveY}px)`
      el.setAttribute('data-cms-positioned', '')
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (iframe) iframe.style.pointerEvents = ''
      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      // Commit final position
      const current = layoutRef.current
      const nextPositions = { ...(current.positions ?? {}) }
      if (liveX === 0 && liveY === 0) {
        delete nextPositions[handle.id]
      } else {
        nextPositions[handle.id] = { x: Math.round(liveX), y: Math.round(liveY) }
      }
      onChangeRef.current({ ...current, positions: nextPositions })
      setDraggingId(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const resetPosition = (id: string) => {
    const current = layoutRef.current
    const next = { ...(current.positions ?? {}) }
    delete next[id]
    onChangeRef.current({ ...current, positions: next })
  }

  if (!enabled) return null

  return (
    <>
      {handles.map((h) => {
        const isModified = !!positionsRef.current?.[h.id]
        return (
          <HandleBox
            key={h.id}
            data={h}
            dragging={draggingId === h.id}
            modified={isModified}
            onMouseDown={(e) => startDrag(h, e)}
            onReset={() => resetPosition(h.id)}
          />
        )
      })}
    </>
  )
}

interface HandleBoxProps {
  data: HandleData
  dragging: boolean
  modified: boolean
  onMouseDown: (e: ReactMouseEvent) => void
  onReset: () => void
}

function HandleBox({ data, dragging, modified, onMouseDown, onReset }: HandleBoxProps) {
  const idLabel = data.id.includes(':') ? data.id.split(':')[1] : data.id

  // Outline is visual-only (pointer-events: none) so mouse-wheel scrolling
  // still reaches the iframe underneath. Drag from the small ⊕ corner icon.
  return (
    <div
      style={{
        position: 'absolute',
        top: data.top,
        left: data.left,
        width: data.width,
        height: data.height,
        zIndex: 1100,
        outline: dragging
          ? '2px solid #16a34a'
          : modified
          ? '1px solid rgba(245, 158, 11, 0.7)'
          : '1px dashed rgba(34, 197, 94, 0.35)',
        outlineOffset: -1,
        background: dragging ? 'rgba(22,163,74,0.10)' : 'transparent',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          display: 'flex',
          gap: 2,
        }}
      >
        <button
          type="button"
          onMouseDown={onMouseDown}
          className="bg-green-600/85 hover:bg-green-600 text-white text-[11px] leading-none px-1 py-0.5 rounded-br shadow-sm active:scale-95"
          style={{
            cursor: 'grab',
            userSelect: 'none',
            pointerEvents: 'auto',
          }}
          title={`⊕ ${idLabel} — húzd új helyre`}
        >
          ⊕
        </button>
        {modified && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onReset()
            }}
            className="bg-amber-600/85 hover:bg-amber-600 text-white text-[11px] leading-none px-1 py-0.5 rounded-br shadow-sm"
            style={{ pointerEvents: 'auto' }}
            title={`Visszaállít — ${idLabel}`}
          >
            ↺
          </button>
        )}
      </div>
    </div>
  )
}
