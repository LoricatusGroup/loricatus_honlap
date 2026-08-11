// Pure DOM helpers that operate on the live-preview iframe's contentDocument.
// No React. Same-origin iframe — direct DOM access is allowed.

import type { EditableField, FieldType, LayoutState } from './types'
import { applyVideoTo } from './video'

const EDIT_ATTR_BY_TYPE: Record<FieldType, string> = {
  text: 'data-edit',
  html: 'data-edit-html',
  image: 'data-edit-src',
  href: 'data-edit-href',
  color: 'data-edit-color',
  target: 'data-edit-target',
  content: 'data-edit-content',
  video: 'data-edit-video',
  placeholder: 'data-edit-placeholder',
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
/* Reveal the service "Bővebben" disclosure and its body — even when empty or
   collapsed — so a description can be added/edited in the CMS, although the
   published page hides an empty one. */
details.service-more,
details.service-more > .service-body { display: block !important; }
[data-edit-html]:empty {
  min-height: 1.2em;
  min-width: 6em;
}
/* A video player swallows clicks. Disable pointer events on the embed/file in
   edit mode so a click lands on the data-edit-video wrapper and opens the video
   editor instead of playing/seeking. */
[data-edit-video] iframe, iframe[data-edit-video], [data-edit-video] video { pointer-events: none !important; }
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
  } else if (type === 'placeholder') {
    el.setAttribute('placeholder', value)
  } else if (type === 'video') {
    // data-edit-video lives on the wrapper; embeds go to the <iframe>, uploaded
    // files to a <video> (created if missing).
    applyVideoTo(el, value)
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

// Live-preview the theme colours in the iframe by writing the same
// <style id="cms-theme"> block that scripts/inject-content.js bakes at publish
// time: `:root { --<key>: <value> }` for each provided key. Passing an empty
// theme clears the block (falls back to style.css defaults) — this also wipes
// any stale block already baked into the loaded page.
export function applyThemeToIframe(doc: Document, theme: Record<string, string>): void {
  const keys = Object.keys(theme).filter((k) => theme[k])
  let styleEl = doc.getElementById('cms-theme') as HTMLStyleElement | null
  if (!keys.length) {
    if (styleEl) styleEl.textContent = ''
    return
  }
  if (!styleEl) {
    styleEl = doc.createElement('style')
    styleEl.id = 'cms-theme'
    doc.head.appendChild(styleEl)
  }
  const rules = keys.map((k) => `  --${k}: ${theme[k]};`).join('\n')
  styleEl.textContent = `:root {\n${rules}\n}`
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

    // Resolve the editable under the cursor. First the target's ancestor chain;
    // if that finds nothing (e.g. the click landed on a caption overlay painted
    // ON TOP of an editable image, as in the portfolio cards), scan the full
    // paint stack at the click point so the covered image is still reachable.
    let editable = target.closest(ATTR_SELECTOR)
    if (!editable && typeof doc.elementsFromPoint === 'function') {
      const stack = doc.elementsFromPoint(e.clientX, e.clientY)
      editable = stack.find((el) => (el as Element).matches?.(ATTR_SELECTOR)) ?? null
    }

    // Don't hijack a click on the element currently being edited (the user
    // is just positioning the cursor inside contenteditable).
    if (editable?.classList.contains('cms-editing')) return

    // In edit mode NO site behaviour should run — swallow every click so the
    // page's own handlers (lightbox gallery, smooth-scroll, nav jumps, inline
    // onclick, form submit, …) never fire and trap the editor. Open the field
    // editor when the click resolved to an editable element.
    e.preventDefault()
    e.stopPropagation()
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
    if (target.closest('a[href], button, input, textarea, select')) {
      e.stopPropagation()
      e.stopImmediatePropagation?.()
    }
  }
  doc.addEventListener('mousedown', mdHandler, { capture: true })

  // Defensive layer: physically neutralise inline onclick handlers and
  // anchor hrefs that point to in-page anchors. Capture-phase stopPropagation
  // SHOULD prevent the bubble-phase / target-phase listeners from firing, but
  // browsers have proved finicky here, so we belt-and-braces by stripping the
  // attribute outright. Originals are restored on cleanup.
  type Restore = () => void
  const restoreFns: Restore[] = []

  doc.querySelectorAll('button').forEach((el) => {
    const onclick = el.getAttribute('onclick')
    if (onclick) {
      el.removeAttribute('onclick')
      // Also clear the onclick property in case it was set programmatically
      ;(el as HTMLButtonElement).onclick = null
      restoreFns.push(() => el.setAttribute('onclick', onclick))
    }
    // Buttons inside a <form> default to type=submit; reading el.type here
    // captures that. If the user clicks a submit-button while in edit mode
    // we don't want the form to submit either. Switch to type=button.
    const origType = el.getAttribute('type')
    if ((el as HTMLButtonElement).type === 'submit') {
      el.setAttribute('type', 'button')
      restoreFns.push(() => {
        if (origType === null) el.removeAttribute('type')
        else el.setAttribute('type', origType)
      })
    }
  })

  doc.querySelectorAll('a[href^="#"]').forEach((el) => {
    // Anchor hash navigations also trigger smooth scroll. preventDefault is
    // supposed to handle this, but we'll also temporarily blank the href so
    // even a browser quirk can't navigate.
    const orig = el.getAttribute('href')
    if (orig) {
      el.setAttribute('data-cms-orig-href', orig)
      el.setAttribute('href', 'javascript:void(0)')
      restoreFns.push(() => {
        el.setAttribute('href', orig)
        el.removeAttribute('data-cms-orig-href')
      })
    }
  })

  return () => {
    doc.removeEventListener('click', handler, { capture: true })
    doc.removeEventListener('mousedown', mdHandler, { capture: true })
    restoreFns.forEach((fn) => fn())
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

// ──────────────────────────────────────────────────────────────────────────────
// Positionable IDs — desktop-only free-form pixel offsets via transform
// ──────────────────────────────────────────────────────────────────────────────

// Threshold below which iframe-side positions are NOT applied (mobile/tablet).
// Mirrors the @media query used by the publish-time CSS.
export const POSITION_DESKTOP_MIN_PX = 1024

// Encode the stable position ID for a given DOM element.
export function positionIdForElement(el: Element): string | null {
  const s = el.getAttribute('data-section')
  if (s) return `section:${s}`
  const li = el.getAttribute('data-list-item')
  if (li) return `item:${li}`
  for (const attr of EDIT_ATTRS) {
    const v = el.getAttribute(attr)
    if (v) return `edit:${v}`
  }
  return null
}

// Find a DOM element given a position ID encoded by positionIdForElement.
export function findPositionableElement(doc: Document, id: string): Element | null {
  const colonIdx = id.indexOf(':')
  if (colonIdx < 0) return null
  const kind = id.substring(0, colonIdx)
  const value = id.substring(colonIdx + 1)
  if (kind === 'section') {
    return doc.querySelector(`[data-section="${escapeAttr(value)}"]`)
  }
  if (kind === 'item') {
    return doc.querySelector(`[data-list-item="${escapeAttr(value)}"]`)
  }
  if (kind === 'edit') {
    // Try each data-edit* attribute
    for (const attr of EDIT_ATTRS) {
      const el = doc.querySelector(`[${attr}="${escapeAttr(value)}"]`)
      if (el) return el
    }
  }
  return null
}

// Enumerate every positionable element in the iframe document. Used by
// LiveFreeformOverlay to render drag handles. Excludes elements inside <head>.
export function collectPositionableElements(doc: Document): Array<{
  id: string
  el: Element
}> {
  const seen = new Set<string>()
  const result: Array<{ id: string; el: Element }> = []
  const selector = [
    '[data-section]',
    '[data-list-item]',
    ...EDIT_ATTRS.map((a) => `[${a}]`),
  ].join(',')
  doc.querySelectorAll(selector).forEach((el) => {
    // Skip elements inside <head> (not visible/draggable)
    if (el.closest('head')) return
    // Skip the meta/title elements that are technically editable but not visible
    if (el.tagName === 'TITLE' || el.tagName === 'META') return
    const id = positionIdForElement(el)
    if (!id || seen.has(id)) return
    seen.add(id)
    result.push({ id, el })
  })
  return result
}

// Apply free-form pixel offsets to elements via inline transform.
// Iframe-side guard: only apply when iframe viewport is >= 1024px wide so we
// match the @media query used at publish time.
export function applyPositions(
  doc: Document,
  positions: LayoutState['positions'],
): void {
  if (!positions) return

  const win = doc.defaultView
  const desktop = win ? win.innerWidth >= POSITION_DESKTOP_MIN_PX : true

  // First clear any previous CMS-applied transforms (data-cms-positioned marker)
  doc.querySelectorAll('[data-cms-positioned]').forEach((el) => {
    ;(el as HTMLElement).style.transform = ''
    el.removeAttribute('data-cms-positioned')
  })

  if (!desktop) return

  for (const [id, pos] of Object.entries(positions)) {
    if (!pos || (pos.x === 0 && pos.y === 0)) continue
    const el = findPositionableElement(doc, id)
    if (!el) continue
    ;(el as HTMLElement).style.transform = `translate(${pos.x}px, ${pos.y}px)`
    el.setAttribute('data-cms-positioned', '')
  }
}

// Clone a catalog partial (HTML string) into the iframe doc as a section
// instance, rewriting data-section + data-edit*/data-list keys from the template
// prefix to the instance id. Mirrors scripts/inject-content.js buildAddedSection.
function buildSectionForPreview(doc: Document, html: string, id: string): Element | null {
  const src = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-section]')
  if (!src) return null
  const prefix = (src.getAttribute('data-section') || '') + '-'
  const el = doc.importNode(src, true) as Element
  el.setAttribute('data-section', id)
  const rewrite = (node: Element) => {
    for (const attr of EDIT_ATTRS) {
      const v = node.getAttribute(attr)
      if (v && v.startsWith(prefix)) node.setAttribute(attr, id + '-' + v.slice(prefix.length))
    }
    for (const attr of ['data-list-item', 'data-list']) {
      const v = node.getAttribute(attr)
      if (v && v.startsWith(prefix)) node.setAttribute(attr, id + '-' + v.slice(prefix.length))
    }
  }
  rewrite(el)
  el.querySelectorAll('*').forEach((n) => rewrite(n as Element))
  return el
}

// Insert catalog sections from layout.added_sections into the preview (idempotent),
// before <footer>. Needs the partial HTML cached in `partials`; a template not yet
// cached is skipped and materialized on a later sync once loaded.
export function materializeAddedSections(
  doc: Document,
  layout: LayoutState,
  partials: Record<string, string>,
): void {
  const footer = doc.querySelector('footer')
  for (const entry of layout.added_sections ?? []) {
    if (!entry?.id || !entry.template) continue
    if (doc.querySelector(`[data-section="${escapeAttr(entry.id)}"]`)) continue
    const html = partials[entry.template]
    if (!html) continue
    const el = buildSectionForPreview(doc, html, entry.id)
    if (!el) continue
    if (footer) doc.body.insertBefore(el, footer)
    else doc.body.appendChild(el)
  }
}

// Remove preview added-sections (asec-*) no longer in added_sections.
export function removeStraySections(doc: Document, layout: LayoutState): void {
  const keep = new Set((layout.added_sections ?? []).map((e) => e.id).filter(Boolean))
  doc.querySelectorAll('[data-section]').forEach((el) => {
    const id = el.getAttribute('data-section')
    if (id && id.startsWith('asec-') && !keep.has(id)) el.remove()
  })
}

export function applyLayout(
  doc: Document,
  layout: LayoutState,
  sectionPartials: Record<string, string> = {},
): void {
  // 0. Materialize / remove catalog sections
  materializeAddedSections(doc, layout, sectionPartials)
  removeStraySections(doc, layout)
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
  // 7. Free-form positions (transform: translate)
  applyPositions(doc, layout.positions)
}
