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

export type LayoutState = {
  section_order: string[]                 // current order (CMS may have reordered)
  section_hidden: Record<string, boolean>
  list_order: Record<string, string[]>    // per-list current order
  item_hidden: Record<string, boolean>
}
