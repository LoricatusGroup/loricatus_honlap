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
  q1: '1. kérdés', q2: '2. kérdés', q3: '3. kérdés', q4: '4. kérdés',
  a1: '1. válasz', a2: '2. válasz', a3: '3. válasz', a4: '4. válasz',
}

function readValue(el: Element, type: FieldType): string {
  if (type === 'text') return (el.textContent || '').trim()
  if (type === 'html') return el.innerHTML.trim()
  if (type === 'image') return el.getAttribute('src') || ''
  if (type === 'href') return el.getAttribute('href') || ''
  if (type === 'color') return el.getAttribute('style') || ''
  if (type === 'target') return el.getAttribute('data-target') || ''
  if (type === 'content') return el.getAttribute('content') || ''
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
