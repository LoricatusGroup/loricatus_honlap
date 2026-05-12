import type { EditableField, FieldType } from './types'

const ATTR_TYPE_MAP: Record<string, FieldType> = {
  'data-edit': 'text',
  'data-edit-html': 'html',
  'data-edit-src': 'image',
  'data-edit-href': 'href',
  'data-edit-color': 'color',
  'data-edit-target': 'target',
  'data-edit-content': 'content',
}

const SECTION_LABELS: Record<string, string> = {
  page: 'Oldal beállítások (SEO)',
  nav: 'Navigáció',
  hero: 'Hero',
  services: 'Szolgáltatások',
  service: 'Szolgáltatás-kártya',
  about: 'Rólunk',
  equipment: 'Eszközpark',
  portfolio: 'Projektek',
  partner: 'Partner',
  partners: 'Partnerek',
  testi: 'Vélemény',
  testimonials: 'Vélemények',
  contact: 'Kapcsolat',
  footer: 'Footer',
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

function humanLabel(key: string): string {
  const parts = key.split('-')
  return parts
    .map((p, i) => (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(' ')
}

function sectionFromKey(key: string): string {
  const first = key.split('-')[0]
  return SECTION_LABELS[first] ?? first.charAt(0).toUpperCase() + first.slice(1)
}

export async function parseEditableFields(htmlUrl = '../index.html'): Promise<EditableField[]> {
  const res = await fetch(htmlUrl, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch ${htmlUrl}: ${res.status}`)
  const html = await res.text()

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const fields: EditableField[] = []
  const seen = new Set<string>()

  for (const [attr, type] of Object.entries(ATTR_TYPE_MAP)) {
    doc.querySelectorAll(`[${attr}]`).forEach((el) => {
      const key = el.getAttribute(attr)
      if (!key || seen.has(key)) return
      seen.add(key)
      const value = readValue(el, type)
      fields.push({
        key,
        type,
        label: humanLabel(key),
        section: sectionFromKey(key),
        value,
        defaultValue: value,
      })
    })
  }

  return fields
}
