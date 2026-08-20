import type { EditableField, FieldType } from './types'

const ATTR_TYPE_MAP: Record<string, FieldType> = {
  'data-edit': 'text',
  'data-edit-html': 'html',
  'data-edit-src': 'image',
  'data-edit-href': 'href',
  'data-edit-color': 'color',
  'data-edit-target': 'target',
  'data-edit-content': 'content',
  'data-edit-video': 'video',
  'data-edit-placeholder': 'placeholder',
  'data-edit-bg': 'bg',
}

const SECTION_LABELS: Record<string, string> = {
  page: 'Oldal beállítások (SEO)',
  og: 'Közösségi megosztás (OG)',
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
  rolunk: 'Rólunk oldal',
}

function readValue(el: Element, type: FieldType): string {
  if (type === 'bg') {
    // Background images live in the inline style, not in an attribute. The
    // value carries image, position and size as "url | position | size".
    const style = el.getAttribute('style') || ''
    const url = /url\(\s*['\"]?([^'\")]+)['\"]?\s*\)/.exec(style)?.[1] || ''
    const pos = /background-position\s*:\s*([^;]+)/i.exec(style)?.[1]?.trim() || 'center'
    const size = /background-size\s*:\s*([^;]+)/i.exec(style)?.[1]?.trim() || 'cover'
    return `${url} | ${pos} | ${size}`
  }
  if (type === 'text') return (el.textContent || '').trim()
  if (type === 'html') return el.innerHTML.trim()
  if (type === 'image') return el.getAttribute('src') || ''
  if (type === 'href') return el.getAttribute('href') || ''
  if (type === 'color') return el.getAttribute('style') || ''
  if (type === 'target') return el.getAttribute('data-target') || ''
  if (type === 'content') return el.getAttribute('content') || ''
  if (type === 'placeholder') return el.getAttribute('placeholder') || ''
  if (type === 'video') {
    const f = el.tagName === 'IFRAME' ? el : el.querySelector('iframe')
    const v = el.querySelector('video')
    return f?.getAttribute('src') || v?.getAttribute('src') || ''
  }
  return ''
}

// Hungarian words for the common field-key tokens, so a key like
// "portfolio-4-image" reads as "Projektek · 4. kép" instead of "Portfolio 4 image".
const WORD_HU: Record<string, string> = {
  title: 'cím', subtitle: 'alcím', desc: 'leírás', description: 'leírás',
  label: 'felirat', value: 'érték', name: 'név', body: 'kifejtés',
  image: 'kép', img: 'kép', src: 'kép', icon: 'ikon', logo: 'logó',
  href: 'link', link: 'link', url: 'link', target: 'cél',
  cat: 'kategória', category: 'kategória', tag: 'címke',
  num: 'szám', number: 'szám', suffix: 'utótag', prefix: 'előtag',
  cta: 'gomb', button: 'gomb', badge: 'jelvény',
  primary: 'elsődleges', secondary: 'másodlagos',
  bg: 'háttér', background: 'háttér',
  menu: 'menü', phone: 'telefon', email: 'e-mail', address: 'cím',
  hours: 'nyitvatartás', meta: 'meta', stat: 'statisztika', hint: 'tipp',
  ph: 'mintaszöveg (szürke segédszöveg)',
  // AI-összehasonlító sáv a footerben
  ai: 'AI-gombok', prompt: 'kérdés az asszisztensnek', lead: 'felirat', note: 'magyarázat',
  // section words used inside nav-menu-* keys
  services: 'Szolgáltatások', about: 'Rólunk', equipment: 'Eszközpark',
  portfolio: 'Projektek', contact: 'Kapcsolat',
  line1: '1. sor', line2: '2. sor', line3: '3. sor', line: 'sor',
  // Rólunk oldal: fülek és elemtípusok
  kockazat: 'Kockázat', eletciklus: 'Életciklus', esettanulmany: 'Esettanulmány',
  focim: 'főcím', cim: 'cím', alcim: 'alcím', szoveg: 'szöveg',
  pont: 'felsorolás', idezet: 'idézet', kepalairas: 'képaláírás',
}

function translatePart(p: string): string {
  if (/^\d+$/.test(p)) return `${p}.`
  return WORD_HU[p] ?? p
}

// Human-readable Hungarian field label: "<Section> · <translated rest>".
function humanLabel(key: string): string {
  const parts = key.split('-')
  const section = SECTION_LABELS[parts[0]] ?? parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
  const rest = parts.slice(1).map(translatePart).filter(Boolean)
  return rest.length ? `${section} · ${rest.join(' ')}` : section
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
