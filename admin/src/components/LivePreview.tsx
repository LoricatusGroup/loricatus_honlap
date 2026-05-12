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
  const [layoutOverlayMode, setLayoutOverlayMode] = useState(false)

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
    // When the user is in layout-overlay mode, suppress click-to-edit so the
    // overlay drag handles are the only interaction.
    if (layoutOverlayMode) {
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
  }, [startInlineTextEdit, layoutOverlayMode])

  // Re-attach (or detach) the click handler when overlay mode toggles
  useEffect(() => {
    if (!iframeReady) return
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    cleanupClickRef.current?.()
    cleanupClickRef.current = null
    if (layoutOverlayMode) return
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
  }, [layoutOverlayMode, iframeReady, startInlineTextEdit])

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
          onClick={() => setLayoutOverlayMode((m) => !m)}
          className={`px-3 py-1 rounded backdrop-blur ${
            layoutOverlayMode
              ? 'bg-purple-600 text-white'
              : 'bg-gray-700/80 hover:bg-gray-600 text-white'
          }`}
          title="Drag-and-drop az iframe-en a szekciók és kártyák átrendezésére"
        >
          📐 Elrendezés mód {layoutOverlayMode ? 'BE' : 'KI'}
        </button>
        <button
          onClick={reloadIframe}
          className="px-3 py-1 bg-gray-700/80 hover:bg-gray-600 text-white rounded backdrop-blur"
          title="Iframe újratöltése"
        >
          ↻ Frissítés
        </button>
      </div>
      <iframe
        key={`${iframeSrc}-${iframeKey}`}
        ref={iframeRef}
        src={iframeSrc}
        title="Live preview"
        onLoad={handleIframeLoad}
        className="w-full h-full bg-white"
      />

      {iframeReady && (
        <LiveLayoutOverlay
          iframeRef={iframeRef}
          layout={layout}
          onChange={onLayoutChange}
          enabled={layoutOverlayMode}
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
