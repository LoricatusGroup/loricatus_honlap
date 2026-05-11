// Parse layout structure from the published index.html: which sections exist,
// which lists exist, and what item IDs each list contains in its original order.
// Also derives a default LayoutState (= identity order, nothing hidden) which
// is merged with whatever is stored in Supabase.

import type {
  LayoutStructure,
  LayoutState,
  SectionInfo,
  ListInfo,
} from './types'

const SECTION_LABELS: Record<string, string> = {
  hero: 'Hero',
  services: 'Szolgáltatások',
  about: 'Rólunk',
  equipment: 'Eszközpark',
  portfolio: 'Projektek',
  partners: 'Partnerek',
  testimonials: 'Vélemények',
  contact: 'Kapcsolat',
}

const LIST_LABELS: Record<string, string> = {
  services: 'Szolgáltatás-kártyák',
  'about-values': 'Értékeink-kártyák',
  equipment: 'Eszköz-kártyák',
  portfolio: 'Projekt-kártyák',
  partners: 'Partner-logók',
  testimonials: 'Vélemény-kártyák',
}

function labelForSection(name: string): string {
  return SECTION_LABELS[name] ?? name
}

function labelForList(name: string): string {
  return LIST_LABELS[name] ?? name
}

// Best-effort human label for a list item: pick a data-edit text inside it.
function labelForItem(itemEl: Element, listName: string, itemId: string): string {
  // Preferred order of keys to try by list type
  const priorities: Record<string, string[]> = {
    services: ['title'],
    'about-values': ['title'],
    equipment: ['title'],
    portfolio: ['category', 'title'],
    partners: ['link', 'image'],
    testimonials: ['author', 'quote'],
  }
  const suffixes = priorities[listName] ?? ['title']
  for (const suf of suffixes) {
    const candidate = itemEl.querySelector(`[data-edit$="-${suf}"]`)
    if (candidate?.textContent) return candidate.textContent.trim().slice(0, 60)
  }
  // Fallback: first data-edit text we find
  const anyText = itemEl.querySelector('[data-edit]')
  if (anyText?.textContent) return anyText.textContent.trim().slice(0, 60)
  return itemId
}

export async function parseLayoutStructure(
  htmlUrl = '../index.html',
): Promise<LayoutStructure> {
  const res = await fetch(htmlUrl, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch ${htmlUrl}: ${res.status}`)
  const html = await res.text()
  const doc = new DOMParser().parseFromString(html, 'text/html')

  const sections: SectionInfo[] = []
  doc.querySelectorAll('[data-section]').forEach((el) => {
    const name = el.getAttribute('data-section')
    if (!name) return
    sections.push({ name, label: labelForSection(name) })
  })

  const lists: ListInfo[] = []
  doc.querySelectorAll('[data-list]').forEach((listEl) => {
    const name = listEl.getAttribute('data-list')
    if (!name) return
    const items = Array.from(listEl.querySelectorAll('[data-list-item]'))
    const itemIds = items.map((i) => i.getAttribute('data-list-item')!).filter(Boolean)
    const itemLabels: Record<string, string> = {}
    items.forEach((i) => {
      const id = i.getAttribute('data-list-item')
      if (id) itemLabels[id] = labelForItem(i, name, id)
    })
    lists.push({ name, label: labelForList(name), itemIds, itemLabels })
  })

  return { sections, lists }
}

export function defaultLayoutState(structure: LayoutStructure): LayoutState {
  return {
    section_order: structure.sections.map((s) => s.name),
    section_hidden: {},
    list_order: Object.fromEntries(
      structure.lists.map((l) => [l.name, [...l.itemIds]]),
    ),
    item_hidden: {},
  }
}

export function mergeLayoutState(
  structure: LayoutStructure,
  saved: Partial<LayoutState> | null | undefined,
): LayoutState {
  const def = defaultLayoutState(structure)
  if (!saved) return def

  // section_order: keep saved entries that still exist, append any new sections
  const validSections = new Set(structure.sections.map((s) => s.name))
  const savedSectionOrder = Array.isArray(saved.section_order) ? saved.section_order : []
  const filtered = savedSectionOrder.filter((s) => validSections.has(s))
  for (const s of def.section_order) if (!filtered.includes(s)) filtered.push(s)

  // list_order: same idea per list
  const list_order: Record<string, string[]> = {}
  for (const list of structure.lists) {
    const validItems = new Set(list.itemIds)
    const savedList = Array.isArray(saved.list_order?.[list.name])
      ? saved.list_order![list.name]
      : []
    const filtList = savedList.filter((i) => validItems.has(i))
    for (const i of list.itemIds) if (!filtList.includes(i)) filtList.push(i)
    list_order[list.name] = filtList
  }

  return {
    section_order: filtered,
    section_hidden: saved.section_hidden ?? {},
    list_order,
    item_hidden: saved.item_hidden ?? {},
  }
}

// Build the minimal layout JSON to save: only non-default values.
export function diffLayoutState(
  structure: LayoutStructure,
  state: LayoutState,
): Partial<LayoutState> {
  const out: Partial<LayoutState> = {}

  const defaultSections = structure.sections.map((s) => s.name)
  if (
    state.section_order.length !== defaultSections.length ||
    state.section_order.some((s, i) => s !== defaultSections[i])
  ) {
    out.section_order = state.section_order
  }

  const hiddenSections = Object.fromEntries(
    Object.entries(state.section_hidden).filter(([, v]) => v),
  )
  if (Object.keys(hiddenSections).length) out.section_hidden = hiddenSections

  const listDiff: Record<string, string[]> = {}
  for (const list of structure.lists) {
    const current = state.list_order[list.name] ?? list.itemIds
    if (
      current.length !== list.itemIds.length ||
      current.some((id, i) => id !== list.itemIds[i])
    ) {
      listDiff[list.name] = current
    }
  }
  if (Object.keys(listDiff).length) out.list_order = listDiff

  const hiddenItems = Object.fromEntries(
    Object.entries(state.item_hidden).filter(([, v]) => v),
  )
  if (Object.keys(hiddenItems).length) out.item_hidden = hiddenItems

  return out
}
