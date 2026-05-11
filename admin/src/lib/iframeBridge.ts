// Pure DOM helpers that operate on the live-preview iframe's contentDocument.
// No React. Same-origin iframe — direct DOM access is allowed.

import type { EditableField, FieldType } from './types'

const EDIT_ATTR_BY_TYPE: Record<FieldType, string> = {
  text: 'data-edit',
  html: 'data-edit-html',
  image: 'data-edit-src',
  href: 'data-edit-href',
  color: 'data-edit-color',
}

export const EDIT_ATTRS = Object.values(EDIT_ATTR_BY_TYPE)

const ATTR_SELECTOR = EDIT_ATTRS.map((a) => `[${a}]`).join(',')

const OVERLAY_STYLE_ID = 'cms-editor-overlay'

const OVERLAY_CSS = `
${EDIT_ATTRS.map((a) => `[${a}]`).join(',')} {
  outline: 1px dashed transparent;
  outline-offset: 2px;
  cursor: pointer !important;
  transition: outline-color .15s, background-color .15s;
}
${EDIT_ATTRS.map((a) => `[${a}]:hover`).join(',')} {
  outline-color: #3b82f6;
  background-color: rgba(59,130,246,0.06);
}
.cms-editing {
  outline: 2px solid #3b82f6 !important;
  background-color: rgba(59,130,246,0.08) !important;
  cursor: text !important;
  white-space: pre-wrap;
}
.cms-changed {
  outline-color: #f59e0b !important;
}
`

export function injectEditorStyles(doc: Document): void {
  if (doc.getElementById(OVERLAY_STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = OVERLAY_STYLE_ID
  style.textContent = OVERLAY_CSS
  doc.head.appendChild(style)
}

function escapeAttr(s: string): string {
  return s.replace(/["\\]/g, '\\$&')
}

export function findElement(
  doc: Document,
  type: FieldType,
  key: string,
): Element | null {
  const attr = EDIT_ATTR_BY_TYPE[type]
  return doc.querySelector(`[${attr}="${escapeAttr(key)}"]`)
}

export function applyOneEdit(
  doc: Document,
  type: FieldType,
  key: string,
  value: string,
): void {
  const el = findElement(doc, type, key)
  if (!el) return
  if (type === 'text') el.textContent = value
  else if (type === 'html') el.innerHTML = value
  else if (type === 'image') el.setAttribute('src', value)
  else if (type === 'href') el.setAttribute('href', value)
  else if (type === 'color') el.setAttribute('style', value)
}

export function applyAllEdits(doc: Document, fields: EditableField[]): void {
  for (const f of fields) {
    if (f.value !== f.defaultValue) {
      applyOneEdit(doc, f.type, f.key, f.value)
    }
  }
}

export function markChangedElements(doc: Document, fields: EditableField[]): void {
  // Clear stale markers first
  doc.querySelectorAll('.cms-changed').forEach((el) => el.classList.remove('cms-changed'))
  for (const f of fields) {
    if (f.value !== f.defaultValue) {
      const el = findElement(doc, f.type, f.key)
      el?.classList.add('cms-changed')
    }
  }
}

export interface IframeClickInfo {
  attr: string
  key: string
  type: FieldType
  element: Element
}

function infoFromElement(el: Element): IframeClickInfo | null {
  for (const [type, attr] of Object.entries(EDIT_ATTR_BY_TYPE)) {
    const key = el.getAttribute(attr)
    if (key) return { attr, key, type: type as FieldType, element: el }
  }
  return null
}

export function attachEditClickHandler(
  doc: Document,
  onClick: (info: IframeClickInfo) => void,
): () => void {
  const handler = (e: MouseEvent) => {
    // Duck-type instead of `instanceof Element`: iframe elements belong to the
    // iframe's realm, so they fail `instanceof window.Element` in the parent.
    const target = e.target as { closest?: (sel: string) => Element | null } | null
    if (!target || typeof target.closest !== 'function') return
    const editable = target.closest(ATTR_SELECTOR)
    if (!editable) return
    // Don't hijack clicks on elements that are currently being edited
    if (editable.classList.contains('cms-editing')) return
    e.preventDefault()
    e.stopPropagation()
    const info = infoFromElement(editable)
    if (info) onClick(info)
  }
  doc.addEventListener('click', handler, { capture: true })
  return () => doc.removeEventListener('click', handler, { capture: true })
}

export function setEditingClass(el: Element, on: boolean): void {
  if (on) el.classList.add('cms-editing')
  else el.classList.remove('cms-editing')
}
