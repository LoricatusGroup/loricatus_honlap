import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditableField, LayoutState } from '../lib/types'
import {
  applyAllEdits,
  applyLayout,
  attachEditClickHandler,
  injectEditorStyles,
  markChangedElements,
  setEditingClass,
} from '../lib/iframeBridge'
import HtmlEditModal from './inline/HtmlEditModal'
import ImageEditModal from './inline/ImageEditModal'
import HrefEditModal from './inline/HrefEditModal'
import NumberEditModal from './inline/NumberEditModal'
import ContentEditModal from './inline/ContentEditModal'
import LiveLayoutOverlay from './LiveLayoutOverlay'
import LiveFreeformOverlay from './LiveFreeformOverlay'

interface Props {
  fields: EditableField[]
  layout: LayoutState
  iframeSrc: string
  onFieldChange: (key: string, value: string) => void
  onLayoutChange: (next: LayoutState) => void
}

type ModalState =
  | { kind: 'html'; field: EditableField }
  | { kind: 'image'; field: EditableField }
  | { kind: 'href'; field: EditableField }
  | { kind: 'number'; field: EditableField }
  | { kind: 'content'; field: EditableField }
  | null

export default function LivePreview({
  fields,
  layout,
  iframeSrc,
  onFieldChange,
  onLayoutChange,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const fieldsRef = useRef(fields)
  const layoutRef = useRef(layout)
  const onChangeRef = useRef(onFieldChange)
  const cleanupClickRef = useRef<(() => void) | null>(null)
  const inlineCleanupRef = useRef<(() => void) | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [iframeKey, setIframeKey] = useState(0)
  const [iframeReady, setIframeReady] = useState(false)
  type OverlayMode = 'edit' | 'layout' | 'freeform'
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('edit')
  const layoutOverlayMode = overlayMode === 'layout'
  const freeformMode = overlayMode === 'freeform'
  const [mobilePreview, setMobilePreview] = useState(false)

  // Keep refs current so click handler always sees latest state
  useEffect(() => {
    fieldsRef.current = fields
    layoutRef.current = layout
    onChangeRef.current = onFieldChange
  }, [fields, layout, onFieldChange])

  const startInlineTextEdit = useCallback((element: Element, field: EditableField) => {
    // Tear down any previous inline edit
    inlineCleanupRef.current?.()

    const el = element as HTMLElement
    const originalValue = field.value
    el.setAttribute('contenteditable', 'true')
    setEditingClass(el, true)
    el.focus()

    // Place cursor at end of text
    const doc = el.ownerDocument
    const range = doc.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const sel = doc.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)

    let committed = false

    const teardown = () => {
      el.removeEventListener('blur', onBlur)
      el.removeEventListener('keydown', onKeyDown)
      el.removeAttribute('contenteditable')
      setEditingClass(el, false)
      inlineCleanupRef.current = null
    }

    const commit = () => {
      if (committed) return
      committed = true
      const next = (el.textContent || '').trim()
      teardown()
      if (next !== originalValue) {
        onChangeRef.current(field.key, next)
      }
    }

    const cancel = () => {
      if (committed) return
      committed = true
      el.textContent = originalValue
      teardown()
    }

    const onBlur = () => commit()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        commit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancel()
      }
    }

    el.addEventListener('blur', onBlur)
    el.addEventListener('keydown', onKeyDown)
    inlineCleanupRef.current = teardown
  }, [])

  const handleIframeLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return

    injectEditorStyles(doc)
    applyLayout(doc, layoutRef.current)
    applyAllEdits(doc, fieldsRef.current)
    markChangedElements(doc, fieldsRef.current)

    cleanupClickRef.current?.()
    // When in layout or freeform mode, suppress click-to-edit so the overlay
    // drag handles are the only interaction.
    if (overlayMode !== 'edit') {
      setIframeReady(true)
      return
    }
    cleanupClickRef.current = attachEditClickHandler(doc, ({ key, type, element }) => {
      const field = fieldsRef.current.find((f) => f.key === key)
      if (!field) return
      if (type === 'text') {
        startInlineTextEdit(element, field)
      } else if (type === 'html') {
        setModal({ kind: 'html', field })
      } else if (type === 'image') {
        setModal({ kind: 'image', field })
      } else if (type === 'href') {
        setModal({ kind: 'href', field })
      } else if (type === 'target') {
        setModal({ kind: 'number', field })
      } else if (type === 'content') {
        setModal({ kind: 'content', field })
      }
    })

    setIframeReady(true)
  }, [startInlineTextEdit, overlayMode])

  // Re-attach (or detach) the click handler when overlay mode toggles
  useEffect(() => {
    if (!iframeReady) return
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    cleanupClickRef.current?.()
    cleanupClickRef.current = null
    if (overlayMode !== 'edit') return
    cleanupClickRef.current = attachEditClickHandler(doc, ({ key, type, element }) => {
      const field = fieldsRef.current.find((f) => f.key === key)
      if (!field) return
      if (type === 'text') {
        startInlineTextEdit(element, field)
      } else if (type === 'html') {
        setModal({ kind: 'html', field })
      } else if (type === 'image') {
        setModal({ kind: 'image', field })
      } else if (type === 'href') {
        setModal({ kind: 'href', field })
      } else if (type === 'target') {
        setModal({ kind: 'number', field })
      } else if (type === 'content') {
        setModal({ kind: 'content', field })
      }
    })
  }, [overlayMode, iframeReady, startInlineTextEdit])

  // Sync iframe DOM with field/layout changes (from any source)
  useEffect(() => {
    if (!iframeReady) return
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    applyLayout(doc, layout)
    applyAllEdits(doc, fields)
    markChangedElements(doc, fields)
  }, [fields, layout, iframeReady])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupClickRef.current?.()
      inlineCleanupRef.current?.()
    }
  }, [])

  const closeModal = () => setModal(null)

  const reloadIframe = () => {
    cleanupClickRef.current?.()
    cleanupClickRef.current = null
    inlineCleanupRef.current?.()
    inlineCleanupRef.current = null
    setIframeReady(false)
    setIframeKey((k) => k + 1)
  }

  return (
    <div className="relative w-full h-[calc(100vh-72px)] bg-gray-950">
      <div className="absolute top-2 right-4 z-[1100] flex gap-2 text-xs">
        <button
          onClick={() =>
            setOverlayMode((m) => (m === 'layout' ? 'edit' : 'layout'))
          }
          className={`px-3 py-1 rounded backdrop-blur ${
            layoutOverlayMode
              ? 'bg-purple-600 text-white'
              : 'bg-gray-700/80 hover:bg-gray-600 text-white'
          }`}
          title="Drag-and-drop az iframe-en a szekciók és kártyák átrendezésére"
        >
          📐 Elrendezés {layoutOverlayMode ? 'BE' : 'KI'}
        </button>
        <button
          onClick={() =>
            setOverlayMode((m) => (m === 'freeform' ? 'edit' : 'freeform'))
          }
          className={`px-3 py-1 rounded backdrop-blur ${
            freeformMode
              ? 'bg-green-600 text-white'
              : 'bg-gray-700/80 hover:bg-gray-600 text-white'
          }`}
          title="Pixel-szintű szabad pozícionálás (csak desktop nézet)"
        >
          🎯 Szabad pozíció {freeformMode ? 'BE' : 'KI'}
        </button>
        {freeformMode && Object.keys(layout.positions ?? {}).length > 0 && (
          <button
            onClick={() => {
              if (
                window.confirm(
                  'Minden szabad pozíció törlése? Az elemek visszaállnak default helyükre.',
                )
              ) {
                onLayoutChange({ ...layout, positions: {} })
              }
            }}
            className="px-3 py-1 bg-amber-700/80 hover:bg-amber-600 text-white rounded backdrop-blur"
            title="Minden pozíció törlése"
          >
            ↺ Mindent visszaállít
          </button>
        )}
        <button
          onClick={() => setMobilePreview((m) => !m)}
          className={`px-3 py-1 rounded backdrop-blur ${
            mobilePreview
              ? 'bg-orange-600 text-white'
              : 'bg-gray-700/80 hover:bg-gray-600 text-white'
          }`}
          title="375px szélességű iframe — mobil nézet előnézete"
        >
          📱 Mobil {mobilePreview ? 'BE' : 'KI'}
        </button>
        <button
          onClick={reloadIframe}
          className="px-3 py-1 bg-gray-700/80 hover:bg-gray-600 text-white rounded backdrop-blur"
          title="Iframe újratöltése"
        >
          ↻ Frissítés
        </button>
      </div>
      {overlayMode !== 'edit' && (
        <div
          className={`absolute top-12 left-1/2 -translate-x-1/2 z-[1100] text-xs px-3 py-1.5 rounded-full shadow-md backdrop-blur ${
            layoutOverlayMode
              ? 'bg-purple-900/80 text-purple-100'
              : 'bg-green-900/80 text-green-100'
          }`}
        >
          {layoutOverlayMode &&
            '📐 Húzd a ☰ ikonokat — drop helyét zöld csík mutatja. Szekciók csak szekciókkal, kártyák csak listán belül.'}
          {freeformMode &&
            '🎯 Húzd a ⊕ ikonokat — pixel-szintű mozgatás. Shift = 10px snap. Csak desktop nézeten érvényesül.'}
        </div>
      )}

      <iframe
        key={`${iframeSrc}-${iframeKey}`}
        ref={iframeRef}
        src={iframeSrc}
        title="Live preview"
        onLoad={handleIframeLoad}
        style={
          mobilePreview
            ? {
                width: '375px',
                margin: '0 auto',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 0 24px rgba(0,0,0,0.5)',
                display: 'block',
                height: '100%',
              }
            : undefined
        }
        className={mobilePreview ? 'bg-white' : 'w-full h-full bg-white'}
      />

      {iframeReady && (
        <LiveLayoutOverlay
          iframeRef={iframeRef}
          layout={layout}
          onChange={onLayoutChange}
          enabled={layoutOverlayMode}
        />
      )}

      {iframeReady && (
        <LiveFreeformOverlay
          iframeRef={iframeRef}
          layout={layout}
          onChange={onLayoutChange}
          enabled={freeformMode}
        />
      )}

      {modal?.kind === 'html' && (
        <HtmlEditModal
          label={modal.field.label}
          initialValue={modal.field.value}
          onSave={(v) => onChangeRef.current(modal.field.key, v)}
          onClose={closeModal}
        />
      )}

      {modal?.kind === 'image' && (
        <ImageEditModal
          label={modal.field.label}
          initialValue={modal.field.value}
          onSave={(v) => onChangeRef.current(modal.field.key, v)}
          onClose={closeModal}
        />
      )}

      {modal?.kind === 'href' && (
        <HrefEditModal
          label={modal.field.label}
          initialValue={modal.field.value}
          onSave={(v) => onChangeRef.current(modal.field.key, v)}
          onClose={closeModal}
        />
      )}

      {modal?.kind === 'number' && (
        <NumberEditModal
          label={modal.field.label}
          initialValue={modal.field.value}
          onSave={(v) => onChangeRef.current(modal.field.key, v)}
          onClose={closeModal}
        />
      )}

      {modal?.kind === 'content' && (
        <ContentEditModal
          label={modal.field.label}
          initialValue={modal.field.value}
          onSave={(v) => onChangeRef.current(modal.field.key, v)}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
