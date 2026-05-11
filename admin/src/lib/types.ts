export type FieldType = 'text' | 'html' | 'image' | 'href' | 'color'

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
