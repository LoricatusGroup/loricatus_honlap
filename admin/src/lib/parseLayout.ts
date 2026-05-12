// Parse layout structure from the published index.html: which sections exist,
// which lists exist, and what item IDs each list contains in its original order.
// Also derives a default LayoutState (= identity order, nothing hidden) which
// is merged with whatever is stored in Supabase.

import type {
  EditableField,
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
  'nav-menu': 'Navigáció menüpontok',
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

  // list_order: keep all saved entries (including user-added items not in
  // structure), then append any missing originals at the end.
  const list_order: Record<string, string[]> = {}
  for (const list of structure.lists) {
    const savedList = Array.isArray(saved.list_order?.[list.name])
      ? saved.list_order![list.name]
      : []
    const filtList = [...savedList]
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

// "service-1" → "service" ; "about-value-1" → "about-value"
export function getItemPrefix(itemId: string): string {
  return itemId.replace(/-[^-]+$/, '')
}

// Generate a short unique ID for a newly-added item: "service" → "service-x7k2"
export function generateItemId(prefix: string): string {
  const rand = Math.floor(Math.random() * 36 ** 5).toString(36).padStart(5, '0')
  return `${prefix}-${rand}`
}

// An item is "added" if it's in the saved list_order but not among the
// original items discovered from HTML.
export function isAddedItem(structure: LayoutStructure, itemId: string): boolean {
  for (const list of structure.lists) {
    if (list.itemIds.includes(itemId)) return false
  }
  return true
}

// Given a field key like "service-x7k2-title", return the item ID that owns it
// (e.g., "service-x7k2"). Picks the longest itemId prefix that matches.
export function findOwningItemId(
  fieldKey: string,
  allItemIds: string[],
): string | null {
  let best: string | null = null
  for (const id of allItemIds) {
    if (fieldKey === id || fieldKey.startsWith(id + '-')) {
      if (!best || id.length > best.length) best = id
    }
  }
  return best
}

// Bootstrap virtual fields for all "added" items found in the saved layout.
// Each added item gets one virtual EditableField per template-suffix the
// admin discovered for the template (e.g., title/desc/link/image for services).
// value = content[newKey] ?? template's current value ;  defaultValue = ""
// so any value the user keeps still gets persisted in content (clones are
// independent snapshots of the template at add-time).
export function bootstrapVirtualFields(
  structure: LayoutStructure,
  layout: LayoutState,
  htmlFields: EditableField[],
  savedContent: Record<string, string>,
): EditableField[] {
  const virtual: EditableField[] = []

  for (const list of structure.lists) {
    const templateId = list.itemIds[0]
    if (!templateId) continue
    const templateFields = htmlFields.filter((f) => f.key.startsWith(templateId + '-'))
    if (!templateFields.length) continue

    const order = layout.list_order[list.name] ?? list.itemIds
    for (const itemId of order) {
      if (list.itemIds.includes(itemId)) continue // original, already in htmlFields
      // Added item — synthesize fields from template
      for (const tf of templateFields) {
        const suffix = tf.key.substring(templateId.length + 1)
        const newKey = `${itemId}-${suffix}`
        const templateValue = tf.value
        const savedValue = savedContent[newKey]
        virtual.push({
          key: newKey,
          type: tf.type,
          label: tf.label,
          section: tf.section,
          value: savedValue ?? templateValue,
          // Empty defaultValue → buildContent will always save this key
          // (added items must persist all values, they have no HTML default).
          defaultValue: '',
        })
      }
    }
  }

  return virtual
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
