export type FieldType = 'text' | 'html' | 'image' | 'href' | 'color' | 'target' | 'content'

export type EditableField = {
  key: string
  type: FieldType
  label: string
  section: string
  value: string
  defaultValue: string
}

export type PageContent = {
  id: string
  page_slug: string
  content: Record<string, string>
  theme: Record<string, string>
  updated_at: string
  published_at: string | null
}

export type ViewMode = 'live' | 'form' | 'layout'

export type Locale = 'hu' | 'en' | 'it'

export interface LocaleConfig {
  code: Locale
  label: string
  flag: string
  pageSlug: string  // page_content.page_slug value
  htmlUrl: string   // path used by parseEditableFields / parseLayoutStructure
  iframeSrc: string // iframe src to load the live page
  filePath: string  // relative path in the repo for publish (Node-side)
}

export const LOCALES: LocaleConfig[] = [
  {
    code: 'hu',
    label: 'Magyar',
    flag: '🇭🇺',
    pageSlug: 'index',
    htmlUrl: '../index.html',
    iframeSrc: '/',
    filePath: 'index.html',
  },
  {
    code: 'en',
    label: 'English',
    flag: '🇬🇧',
    pageSlug: 'index-en',
    htmlUrl: '../en/index.html',
    iframeSrc: '/en/',
    filePath: 'en/index.html',
  },
  {
    code: 'it',
    label: 'Italiano',
    flag: '🇮🇹',
    pageSlug: 'index-it',
    htmlUrl: '../it/index.html',
    iframeSrc: '/it/',
    filePath: 'it/index.html',
  },
]

export function getLocale(code: Locale): LocaleConfig {
  const config = LOCALES.find((l) => l.code === code)
  if (!config) throw new Error(`Unknown locale: ${code}`)
  return config
}

export type SectionInfo = {
  name: string        // "hero", "services", ...
  label: string       // "Hero", "Szolgáltatások", ...
}

export type ListInfo = {
  name: string        // "services", "portfolio", ...
  label: string       // "Szolgáltatások kártyák"
  itemIds: string[]   // ["service-1", "service-2", ...] — original order from HTML
  itemLabels: Record<string, string>  // { "service-1": "Légi Fotó & Videó", ... }
}

export type LayoutStructure = {
  sections: SectionInfo[]      // original order from HTML
  lists: ListInfo[]
}

export type Position = { x: number; y: number }

// A catalog section instance inserted via the editor. `id` starts with "asec-"
// and prefixes all the instance's data-edit keys; `template` is the catalog name.
export type AddedSection = { id: string; template: string }

export type LayoutState = {
  section_order: string[]                 // current order (CMS may have reordered)
  section_hidden: Record<string, boolean>
  list_order: Record<string, string[]>    // per-list current order
  item_hidden: Record<string, boolean>
  positions: Record<string, Position>     // free-form pixel offsets keyed by positionable ID
  added_sections: AddedSection[]          // catalog sections inserted via the editor
}

// One entry in sections/catalog.json (the curated block library).
export type CatalogEntry = { template: string; label: string; description: string }
