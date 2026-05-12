import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import type { LayoutState } from '../lib/types'

type Kind = 'section' | 'item'

interface HandleData {
  kind: Kind
  id: string          // section name OR list-item ID
  listName?: string    // for items, the data-list value
  top: number          // parent-document px (page coordinates incl. scroll)
  left: number
  width: number
  height: number
}

interface DropIndicator {
  id: string
  position: 'before' | 'after'
}

interface Props {
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  layout: LayoutState
  onChange: (next: LayoutState) => void
  enabled: boolean
}

export default function LiveLayoutOverlay({ iframeRef, layout, onChange, enabled }: Props) {
  const [handles, setHandles] = useState<HandleData[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [drop, setDrop] = useState<DropIndicator | null>(null)
  const dropRef = useRef<DropIndicator | null>(null)
  const onChangeRef = useRef(onChange)
  const layoutRef = useRef(layout)

  useEffect(() => {
    onChangeRef.current = onChange
    layoutRef.current = layout
  }, [onChange, layout])

  // Recompute handle positions when enabled, iframe changes, or layout changes,
  // plus on iframe scroll / window resize.
  useEffect(() => {
    if (!enabled) {
      setHandles([])
      return
    }
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    if (!iframe || !doc) return

    let rafId: number | null = null
    const compute = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        // Wrapper-relative coordinates: iframe.offsetTop/Left is the iframe's
        // position within its position:relative parent (the LivePreview wrapper).
        // element.getBoundingClientRect is already iframe-viewport-relative
        // (factors in internal iframe scroll).
        const ifTop = iframe.offsetTop
        const ifLeft = iframe.offsetLeft
        const next: HandleData[] = []

        doc.querySelectorAll('[data-section]').forEach((el) => {
          if ((el as HTMLElement).hidden) return
          const id = el.getAttribute('data-section')
          if (!id) return
          const r = (el as HTMLElement).getBoundingClientRect()
          if (r.height === 0) return
          next.push({
            kind: 'section',
            id,
            top: ifTop + r.top,
            left: ifLeft + r.left,
            width: r.width,
            height: r.height,
          })
        })

        doc.querySelectorAll('[data-list]').forEach((listEl) => {
          const listName = listEl.getAttribute('data-list')
          if (!listName) return
          listEl.querySelectorAll('[data-list-item]').forEach((itemEl) => {
            if ((itemEl as HTMLElement).hidden) return
            const id = itemEl.getAttribute('data-list-item')
            if (!id) return
            const r = (itemEl as HTMLElement).getBoundingClientRect()
            if (r.height === 0) return
            next.push({
              kind: 'item',
              id,
              listName,
              top: ifTop + r.top,
              left: ifLeft + r.left,
              width: r.width,
              height: r.height,
            })
          })
        })

        setHandles(next)
      })
    }

    compute()
    doc.addEventListener('scroll', compute, { passive: true, capture: true })
    window.addEventListener('resize', compute)

    // Watch for DOM mutations in the iframe (e.g., layout state changes that
    // re-clone nodes) so handles re-align.
    const observer = new MutationObserver(compute)
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] })

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
    dropRef.current = null
    setDrop(null)

    const iframe = iframeRef.current
    if (iframe) iframe.style.pointerEvents = 'none'
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'

    const onMove = (ev: globalThis.MouseEvent) => {
      const doc = iframe?.contentDocument
      if (!iframe || !doc) return
      const iframeRect = iframe.getBoundingClientRect()
      const x = ev.clientX - iframeRect.left
      const y = ev.clientY - iframeRect.top
      if (x < 0 || y < 0 || x > iframeRect.width || y > iframeRect.height) {
        dropRef.current = null
        setDrop(null)
        return
      }
      const el = doc.elementFromPoint(x, y)
      if (!el) {
        dropRef.current = null
        setDrop(null)
        return
      }
      const selector = handle.kind === 'section' ? '[data-section]' : '[data-list-item]'
      const target = (el as Element).closest(selector)
      if (!target) {
        dropRef.current = null
        setDrop(null)
        return
      }
      const targetId =
        handle.kind === 'section'
          ? target.getAttribute('data-section')
          : target.getAttribute('data-list-item')
      if (!targetId || targetId === handle.id) {
        dropRef.current = null
        setDrop(null)
        return
      }
      if (handle.kind === 'item') {
        const targetListEl = target.closest('[data-list]')
        if (!targetListEl || targetListEl.getAttribute('data-list') !== handle.listName) {
          dropRef.current = null
          setDrop(null)
          return
        }
      }
      const tr = (target as HTMLElement).getBoundingClientRect()
      const midY = tr.top + tr.height / 2
      const position: 'before' | 'after' = ev.clientY < midY ? 'before' : 'after'
      const newDrop: DropIndicator = { id: targetId, position }
      dropRef.current = newDrop
      setDrop(newDrop)
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (iframe) iframe.style.pointerEvents = ''
      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      const final = dropRef.current
      if (final && final.id !== handle.id) {
        commitMove(handle, final)
      }
      setDraggingId(null)
      setDrop(null)
      dropRef.current = null
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const commitMove = (handle: HandleData, target: DropIndicator) => {
    const state = layoutRef.current
    if (handle.kind === 'section') {
      const order = state.section_order
      const fromIdx = order.indexOf(handle.id)
      const toIdx = order.indexOf(target.id)
      if (fromIdx < 0 || toIdx < 0) return
      let dest = target.position === 'before' ? toIdx : toIdx + 1
      if (fromIdx < dest) dest -= 1
      const moved = arrayMove(order, fromIdx, dest)
      onChangeRef.current({ ...state, section_order: moved })
    } else {
      if (!handle.listName) return
      const order = state.list_order[handle.listName] ?? []
      const fromIdx = order.indexOf(handle.id)
      const toIdx = order.indexOf(target.id)
      if (fromIdx < 0 || toIdx < 0) return
      let dest = target.position === 'before' ? toIdx : toIdx + 1
      if (fromIdx < dest) dest -= 1
      const moved = arrayMove(order, fromIdx, dest)
      onChangeRef.current({
        ...state,
        list_order: { ...state.list_order, [handle.listName]: moved },
      })
    }
  }

  if (!enabled) return null

  return (
    <>
      {handles.map((h) => (
        <HandleOverlay
          key={`${h.kind}:${h.id}`}
          data={h}
          dragging={draggingId === h.id}
          dropPosition={drop?.id === h.id ? drop.position : null}
          onMouseDown={(e) => startDrag(h, e)}
        />
      ))}
    </>
  )
}

interface HandleOverlayProps {
  data: HandleData
  dragging: boolean
  dropPosition: 'before' | 'after' | null
  onMouseDown: (e: ReactMouseEvent) => void
}

function HandleOverlay({ data, dragging, dropPosition, onMouseDown }: HandleOverlayProps) {
  const sectionStyle = data.kind === 'section'
  const baseColor = sectionStyle ? 'bg-purple-600' : 'bg-blue-600'

  return (
    <div
      style={{
        position: 'absolute',
        top: data.top,
        left: data.left,
        width: data.width,
        height: data.height,
        pointerEvents: 'none',
        zIndex: 1000,
        outline: dragging ? '2px solid #3b82f6' : '1px dashed rgba(255,255,255,0.25)',
        outlineOffset: -1,
        background: dragging ? 'rgba(59,130,246,0.1)' : 'transparent',
      }}
    >
      {/* Drop position indicator */}
      {dropPosition === 'before' && (
        <div
          style={{
            position: 'absolute',
            top: -3,
            left: 0,
            right: 0,
            height: 4,
            background: '#22c55e',
            borderRadius: 2,
          }}
        />
      )}
      {dropPosition === 'after' && (
        <div
          style={{
            position: 'absolute',
            bottom: -3,
            left: 0,
            right: 0,
            height: 4,
            background: '#22c55e',
            borderRadius: 2,
          }}
        />
      )}
      {/* Drag handle */}
      <button
        type="button"
        onMouseDown={onMouseDown}
        className={`${baseColor} text-white text-xs px-2 py-1 rounded-br font-mono shadow-md hover:opacity-90 active:scale-95`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'auto',
          cursor: 'grab',
          userSelect: 'none',
        }}
        title={`${data.kind === 'section' ? 'Szekció' : 'Kártya'}: ${data.id}`}
      >
        ☰ {data.id}
      </button>
    </div>
  )
}
