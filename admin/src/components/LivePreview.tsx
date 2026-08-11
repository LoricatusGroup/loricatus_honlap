import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditableField, LayoutState } from '../lib/types'
import {
  applyAllEdits,
  applyLayout,
  applyThemeToIframe,
  attachEditClickHandler,
  injectEditorStyles,
  markChangedElements,
  setEditingClass,
} from '../lib/iframeBridge'
import HtmlEditModal from './inline/HtmlEditModal'
import ImageEditModal from './inline/ImageEditModal'
import HrefEditModal, { type PageLink } from './inline/HrefEditModal'
import NumberEditModal from './inline/NumberEditModal'
import ContentEditModal from './inline/ContentEditModal'
import VideoEditModal from './inline/VideoEditModal'
import LiveLayoutOverlay from './LiveLayoutOverlay'
import LiveFreeformOverlay from './LiveFreeformOverlay'

export type OverlayMode = 'edit' | 'layout' | 'freeform'

interface Props {
  fields: EditableField[]
  layout: LayoutState
  theme: Record<string, string>
  iframeSrc: string
  overlayMode: OverlayMode
  mobilePreview: boolean
  iframeKey: number
  sectionPartials: Record<string, string>
  pageLinks: PageLink[]
  onFieldChange: (key: string, value: string) => void
  onLayoutChange: (next: LayoutState) => void
}

type ModalState =
  | { kind: 'html'; field: EditableField }
  | { kind: 'image'; field: EditableField }
  | { kind: 'href'; field: EditableField }
  | { kind: 'number'; field: EditableField }
  | { kind: 'content'; field: EditableField }
  | { kind: 'video'; field: EditableField }
  | null

export default function LivePreview({
  fields,
  layout,
  theme,
  iframeSrc,
  overlayMode,
  mobilePreview,
  iframeKey,
  sectionPartials,
  pageLinks,
  onFieldChange,
  onLayoutChange,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const fieldsRef = useRef(fields)
  const layoutRef = useRef(layout)
  const themeRef = useRef(theme)
  const partialsRef = useRef(sectionPartials)
  const onChangeRef = useRef(onFieldChange)
  const cleanupClickRef = useRef<(() => void) | null>(null)
  const inlineCleanupRef = useRef<(() => void) | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [iframeReady, setIframeReady] = useState(false)
  const layoutOverlayMode = overlayMode === 'layout'
  const freeformMode = overlayMode === 'freeform'

  // Keep refs current so click handler always sees latest state
  useEffect(() => {
    fieldsRef.current = fields
    layoutRef.current = layout
    themeRef.current = theme
    partialsRef.current = sectionPartials
    onChangeRef.current = onFieldChange
  }, [fields, layout, theme, sectionPartials, onFieldChange])

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
    applyLayout(doc, layoutRef.current, partialsRef.current)
    applyAllEdits(doc, fieldsRef.current)
    markChangedElements(doc, fieldsRef.current)
    applyThemeToIframe(doc, themeRef.current)

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
      } else if (type === 'content' || type === 'placeholder') {
        setModal({ kind: 'content', field })
      } else if (type === 'video') {
        setModal({ kind: 'video', field })
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
      } else if (type === 'content' || type === 'placeholder') {
        setModal({ kind: 'content', field })
      } else if (type === 'video') {
        setModal({ kind: 'video', field })
      }
    })
  }, [overlayMode, iframeReady, startInlineTextEdit])

  // Sync iframe DOM with field/layout/theme changes (from any source)
  useEffect(() => {
    if (!iframeReady) return
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    applyLayout(doc, layout, sectionPartials)
    applyAllEdits(doc, fields)
    markChangedElements(doc, fields)
    applyThemeToIframe(doc, theme)
  }, [fields, layout, theme, sectionPartials, iframeReady])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupClickRef.current?.()
      inlineCleanupRef.current?.()
    }
  }, [])

  const closeModal = () => setModal(null)

  // When the parent bumps iframeKey, tear down handlers + mark not-ready so
  // handleIframeLoad re-runs cleanly against the fresh document.
  useEffect(() => {
    cleanupClickRef.current?.()
    cleanupClickRef.current = null
    inlineCleanupRef.current?.()
    inlineCleanupRef.current = null
    setIframeReady(false)
  }, [iframeKey])

  return (
    <div className="relative w-full h-[calc(100vh-72px)] bg-gray-950">
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
          pageLinks={pageLinks}
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

      {modal?.kind === 'video' && (
        <VideoEditModal
          label={modal.field.label}
          initialValue={modal.field.value}
          onSave={(v) => onChangeRef.current(modal.field.key, v)}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
