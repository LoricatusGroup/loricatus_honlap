// Pure DOM helpers that operate on the live-preview iframe's contentDocument.
// No React. Same-origin iframe — direct DOM access is allowed.

import type { EditableField, FieldType, LayoutState } from './types'

const EDIT_ATTR_BY_TYPE: Record<FieldType, string> = {
  text: 'data-edit',
  html: 'data-edit-html',
  image: 'data-edit-src',
  href: 'data-edit-href',
  color: 'data-edit-color',
  target: 'data-edit-target',
  content: 'data-edit-content',
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
  else if (type === 'target') {
    // data-target drives the stat-count-up animation. Update the attribute
    // (next page load will animate to the new value) AND the textContent so
    // the user sees the change immediately in the live preview.
    el.setAttribute('data-target', value)
    el.textContent = value
  } else if (type === 'content') {
    el.setAttribute('content', value)
  }
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
    // Always neutralise links and buttons inside the iframe (anchor jumps,
    // inline onclick scrolls, the language switcher pills, etc.) so they
    // never navigate away or run their site behaviour while editing.
    const interactive = target.closest('a[href], button')

    if (!editable && !interactive) return

    // Don't hijack a click on the element currently being edited (the user
    // is just positioning the cursor inside contenteditable).
    if (editable?.classList.contains('cms-editing')) return

    e.preventDefault()
    e.stopPropagation()
    // stopImmediatePropagation so any same-element listeners script.js may
    // have attached in capture phase ALSO don't fire.
    e.stopImmediatePropagation?.()

    if (editable) {
      const info = infoFromElement(editable)
      if (info) onClick(info)
    }
  }
  doc.addEventListener('click', handler, { capture: true })
  // mousedown is also worth swallowing — some scripts use it instead of click
  // (and contenteditable focus must not race with a parallel mousedown).
  const mdHandler = (e: MouseEvent) => {
    const target = e.target as { closest?: (sel: string) => Element | null } | null
    if (!target || typeof target.closest !== 'function') return
    if (target.closest('a[href], button')) {
      // Don't preventDefault on mousedown — that would block contenteditable
      // focus on editable buttons. Just stop the iframe site's mousedown
      // listeners from running their own logic.
      e.stopPropagation()
      e.stopImmediatePropagation?.()
    }
  }
  doc.addEventListener('mousedown', mdHandler, { capture: true })
  return () => {
    doc.removeEventListener('click', handler, { capture: true })
    doc.removeEventListener('mousedown', mdHandler, { capture: true })
  }
}

export function setEditingClass(el: Element, on: boolean): void {
  if (on) el.classList.add('cms-editing')
  else el.classList.remove('cms-editing')
}

// ──────────────────────────────────────────────────────────────────────────────
// Layout (reorder + hide) — mirrors scripts/inject-content.js
// ──────────────────────────────────────────────────────────────────────────────

// Reorder matching children in-place WITHOUT disturbing non-matching siblings.
// Inserts each target before the next sibling of the original LAST match,
// so e.g. <nav> stays first and <footer> stays last even though they have no
// idAttr.
// Clone a list-item element, rewriting its data-list-item and all descendant
// data-edit* attributes to use newId instead of templateId.
export function cloneListItem(
  templateEl: Element,
  templateId: string,
  newId: string,
): Element {
  const clone = templateEl.cloneNode(true) as Element
  clone.setAttribute('data-list-item', newId)
  const prefix = templateId + '-'
  const rewrite = (el: Element) => {
    for (const attr of EDIT_ATTRS) {
      const v = el.getAttribute(attr)
      if (v && v.startsWith(prefix)) {
        el.setAttribute(attr, newId + '-' + v.substring(prefix.length))
      }
    }
  }
  rewrite(clone)
  clone.querySelectorAll('*').forEach(rewrite)
  return clone
}

// Ensure every itemId mentioned in layout.list_order exists in the iframe DOM,
// cloning the first existing item as a template when needed.
export function materializeAddedItems(doc: Document, layout: LayoutState): void {
  for (const [listName, order] of Object.entries(layout.list_order ?? {})) {
    const listEl = doc.querySelector(`[data-list="${escapeAttr(listName)}"]`)
    if (!listEl) continue
    const existing = Array.from(listEl.querySelectorAll('[data-list-item]'))
    if (!existing.length) continue
    const templateEl = existing[0]
    const templateId = templateEl.getAttribute('data-list-item')!
    const existingIds = new Set(existing.map((el) => el.getAttribute('data-list-item')!))
    for (const id of order) {
      if (existingIds.has(id)) continue
      listEl.appendChild(cloneListItem(templateEl, templateId, id))
    }
  }
}

// Remove DOM items whose data-list-item is not present in layout.list_order
// (the user deleted an added item, or layout simply has fewer entries).
// Only runs for lists that have a list_order entry — empty/missing list_order
// means "no user changes to this list", leave it alone.
export function removeStrayItems(doc: Document, layout: LayoutState): void {
  for (const [listName, order] of Object.entries(layout.list_order ?? {})) {
    if (!order.length) continue
    const orderSet = new Set(order)
    const listEl = doc.querySelector(`[data-list="${escapeAttr(listName)}"]`)
    if (!listEl) continue
    listEl.querySelectorAll('[data-list-item]').forEach((el) => {
      const id = el.getAttribute('data-list-item')
      if (id && !orderSet.has(id)) el.remove()
    })
  }
}

function reorderChildren(parent: Element | null, idAttr: string, order: string[]): void {
  if (!parent || !order.length) return
  const byId = new Map<string, Element>()
  let referenceNode: Element | null = null
  Array.from(parent.children).forEach((child) => {
    const id = child.getAttribute(idAttr)
    if (id) {
      byId.set(id, child)
      referenceNode = child.nextElementSibling
    }
  })
  const placed = new Set<string>()
  for (const id of order) {
    const el = byId.get(id)
    if (el) {
      parent.insertBefore(el, referenceNode)
      placed.add(id)
    }
  }
  // Append leftover matches (not in order array) just before the reference,
  // keeping them within the original "matches zone".
  for (const [id, el] of byId) {
    if (!placed.has(id)) parent.insertBefore(el, referenceNode)
  }
}

export function applyLayout(doc: Document, layout: LayoutState): void {
  // 1. Materialize added items (clone templates for items in list_order not yet in DOM)
  materializeAddedItems(doc, layout)
  // 2. Remove items present in DOM but not in list_order (deletions)
  removeStrayItems(doc, layout)
  // 3. Sections reorder
  if (Array.isArray(layout.section_order) && layout.section_order.length) {
    reorderChildren(doc.body, 'data-section', layout.section_order)
  }
  // 4. List item orders
  for (const [listName, order] of Object.entries(layout.list_order ?? {})) {
    const listEl = doc.querySelector(`[data-list="${escapeAttr(listName)}"]`)
    if (listEl) reorderChildren(listEl, 'data-list-item', order)
  }
  // 5. Section visibility
  for (const [name, hidden] of Object.entries(layout.section_hidden ?? {})) {
    const el = doc.querySelector(`[data-section="${escapeAttr(name)}"]`)
    if (!el) continue
    if (hidden) el.setAttribute('hidden', '')
    else el.removeAttribute('hidden')
  }
  // 6. Item visibility
  for (const [id, hidden] of Object.entries(layout.item_hidden ?? {})) {
    const el = doc.querySelector(`[data-list-item="${escapeAttr(id)}"]`)
    if (!el) continue
    if (hidden) el.setAttribute('hidden', '')
    else el.removeAttribute('hidden')
  }
}
