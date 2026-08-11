// Loads the curated section catalog (sections/catalog.json + sections/<t>.html,
// served same-origin) and turns a partial into editable fields whose keys are
// rewritten from the template prefix to the instance id — mirroring
// scripts/inject-content.js buildAddedSection so preview == published output.

import type { CatalogEntry, EditableField, FieldType } from './types'

const EDIT_ATTR_TYPE: Record<string, FieldType> = {
  'data-edit': 'text',
  'data-edit-html': 'html',
  'data-edit-src': 'image',
  'data-edit-href': 'href',
  'data-edit-color': 'color',
  'data-edit-target': 'target',
  'data-edit-content': 'content',
  'data-edit-video': 'video',
  'data-edit-placeholder': 'placeholder',
}
const EDIT_ATTRS = Object.keys(EDIT_ATTR_TYPE)

export const ADDED_SECTION_PREFIX = 'asec-'

let catalogCache: CatalogEntry[] | null = null
const partialCache = new Map<string, string>()

export async function loadCatalog(): Promise<CatalogEntry[]> {
  if (catalogCache) return catalogCache
  const res = await fetch('/sections/catalog.json', { cache: 'no-store' })
  if (!res.ok) throw new Error(`catalog.json: ${res.status}`)
  const data = (await res.json()) as CatalogEntry[]
  catalogCache = Array.isArray(data) ? data : []
  return catalogCache
}

export async function loadPartial(template: string): Promise<string> {
  const cached = partialCache.get(template)
  if (cached != null) return cached
  const res = await fetch(`/sections/${encodeURIComponent(template)}.html`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`section ${template}: ${res.status}`)
  const html = await res.text()
  partialCache.set(template, html)
  return html
}

export function generateSectionId(): string {
  const rand = Math.floor(Math.random() * 36 ** 6)
    .toString(36)
    .padStart(6, '0')
  return `${ADDED_SECTION_PREFIX}${rand}`
}

const SUFFIX_HU: Record<string, string> = {
  tag: 'címke', title: 'cím', subtitle: 'alcím', desc: 'leírás', body: 'szöveg',
  button: 'gomb', 'button-href': 'gomb linkje',
  button2: '2. gomb', 'button2-href': '2. gomb linkje',
  q1: '1. kérdés', q2: '2. kérdés', q3: '3. kérdés', q4: '4. kérdés',
  a1: '1. válasz', a2: '2. válasz', a3: '3. válasz', a4: '4. válasz',
  // features / cards cards
  'c1-icon': '1. kártya – ikon', 'c1-title': '1. kártya – cím', 'c1-desc': '1. kártya – leírás',
  'c1-link': '1. kártya – link', 'c1-linklabel': '1. kártya – link szövege',
  'c2-icon': '2. kártya – ikon', 'c2-title': '2. kártya – cím', 'c2-desc': '2. kártya – leírás',
  'c2-link': '2. kártya – link', 'c2-linklabel': '2. kártya – link szövege',
  'c3-icon': '3. kártya – ikon', 'c3-title': '3. kártya – cím', 'c3-desc': '3. kártya – leírás',
  'c3-link': '3. kártya – link', 'c3-linklabel': '3. kártya – link szövege',
  // steps
  's1-title': '1. lépés – cím', 's1-desc': '1. lépés – leírás',
  's2-title': '2. lépés – cím', 's2-desc': '2. lépés – leírás',
  's3-title': '3. lépés – cím', 's3-desc': '3. lépés – leírás',
  // stats
  'n1-num': '1. adat – szám', 'n1-label': '1. adat – felirat',
  'n2-num': '2. adat – szám', 'n2-label': '2. adat – felirat',
  'n3-num': '3. adat – szám', 'n3-label': '3. adat – felirat',
  // checklist
  'i1-title': '1. pont – cím', 'i1-desc': '1. pont – leírás',
  'i2-title': '2. pont – cím', 'i2-desc': '2. pont – leírás',
  'i3-title': '3. pont – cím', 'i3-desc': '3. pont – leírás',
  'i4-title': '4. pont – cím', 'i4-desc': '4. pont – leírás',
  // testimonial
  quote: 'idézet', author: 'név / cég', role: 'beosztás',
  // media + contact
  image: 'kép', email: 'e-mail', 'email-href': 'e-mail link',
  phone: 'telefon', 'phone-href': 'telefon link',
  // case study
  client: 'ügyfél · helyszín',
  'challenge-title': 'kihívás – felirat', challenge: 'kihívás – szöveg',
  'solution-title': 'megoldás – felirat', solution: 'megoldás – szöveg',
  'result-title': 'eredmény – felirat', result: 'eredmény – szöveg',
  // video
  embed: 'videó linkje vagy feltöltött fájl',
}

function readValue(el: Element, type: FieldType): string {
  if (type === 'text') return (el.textContent || '').trim()
  if (type === 'html') return el.innerHTML.trim()
  if (type === 'image') return el.getAttribute('src') || ''
  if (type === 'video') {
    const f = el.tagName === 'IFRAME' ? el : el.querySelector('iframe')
    const v = el.querySelector('video')
    return f?.getAttribute('src') || v?.getAttribute('src') || ''
  }
  if (type === 'href') return el.getAttribute('href') || ''
  if (type === 'color') return el.getAttribute('style') || ''
  if (type === 'target') return el.getAttribute('data-target') || ''
  if (type === 'content') return el.getAttribute('content') || ''
  if (type === 'placeholder') return el.getAttribute('placeholder') || ''
  return ''
}

// Parse a catalog partial into editable fields for one instance. Keys are
// rewritten template-prefix → instanceId; values come from savedContent (if
// present) else the partial's own default. defaultValue is '' so every field
// always persists (added sections have no baked HTML default at first).
export function parsePartialFields(
  html: string,
  instanceId: string,
  sectionLabel: string,
  savedContent: Record<string, string>,
): EditableField[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const root = doc.querySelector('[data-section]')
  if (!root) return []
  const prefix = (root.getAttribute('data-section') || '') + '-'

  const fields: EditableField[] = []
  const seen = new Set<string>()
  for (const attr of EDIT_ATTRS) {
    root.querySelectorAll(`[${attr}]`).forEach((el) => {
      const rawKey = el.getAttribute(attr)
      if (!rawKey) return
      const key = rawKey.startsWith(prefix)
        ? instanceId + '-' + rawKey.slice(prefix.length)
        : rawKey
      if (seen.has(key)) return
      seen.add(key)
      const type = EDIT_ATTR_TYPE[attr]
      const suffix = key.startsWith(instanceId + '-') ? key.slice(instanceId.length + 1) : key
      fields.push({
        key,
        type,
        label: `${sectionLabel} · ${SUFFIX_HU[suffix] ?? suffix}`,
        section: sectionLabel,
        value: savedContent[key] ?? readValue(el, type),
        defaultValue: '',
      })
    })
  }
  return fields
}
