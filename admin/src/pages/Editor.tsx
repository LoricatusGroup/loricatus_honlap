import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { parseEditableFields } from '../lib/parseHtml'
import {
  parseLayoutStructure,
  mergeLayoutState,
  diffLayoutState,
  bootstrapVirtualFields,
  getItemPrefix,
  generateItemId,
} from '../lib/parseLayout'
import type {
  EditableField,
  Locale,
  LayoutState,
  LayoutStructure,
  ViewMode,
} from '../lib/types'
import { LOCALES, getLocale } from '../lib/types'
import FieldEditor from '../components/FieldEditor'
import ThemeEditor from '../components/ThemeEditor'
import LivePreview from '../components/LivePreview'
import LayoutEditor from '../components/LayoutEditor'

interface Props {
  user: User
}

type Status = { type: 'info' | 'error' | 'success'; text: string } | null

const LOCALE_STORAGE_KEY = 'loricatus-cms-locale'

export default function EditorPage({ user }: Props) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (saved === 'en' || saved === 'it') return saved
    return 'hu'
  })
  const [fields, setFields] = useState<EditableField[]>([])
  const [theme, setTheme] = useState<Record<string, string>>({})
  const [structure, setStructure] = useState<LayoutStructure | null>(null)
  const [layout, setLayout] = useState<LayoutState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('live')

  const localeConfig = getLocale(locale)

  // (Re)load everything whenever locale changes.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setFields([])
    setStructure(null)
    setLayout(null)

    const load = async () => {
      try {
        const [htmlFields, layoutStructure] = await Promise.all([
          parseEditableFields(localeConfig.htmlUrl),
          parseLayoutStructure(localeConfig.htmlUrl),
        ])
        const { data: pageData, error } = await supabase
          .from('page_content')
          .select('*')
          .eq('page_slug', localeConfig.pageSlug)
          .maybeSingle()
        if (error) throw error

        if (cancelled) return

        const savedContent = (pageData?.content ?? {}) as Record<string, string>
        const mergedFields = htmlFields.map((f) => ({
          ...f,
          value: savedContent[f.key] ?? f.defaultValue,
        }))
        const merged = mergeLayoutState(layoutStructure, pageData?.layout)
        const virtualFields = bootstrapVirtualFields(
          layoutStructure,
          merged,
          mergedFields,
          savedContent,
        )

        setFields([...mergedFields, ...virtualFields])
        setTheme(pageData?.theme ?? {})
        setStructure(layoutStructure)
        setLayout(merged)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [locale, localeConfig.htmlUrl, localeConfig.pageSlug])

  const grouped = useMemo(() => {
    const map = new Map<string, EditableField[]>()
    for (const f of fields) {
      const arr = map.get(f.section) ?? []
      arr.push(f)
      map.set(f.section, arr)
    }
    return Array.from(map.entries())
  }, [fields])

  const changedCount = useMemo(
    () => fields.filter((f) => f.value !== f.defaultValue).length,
    [fields],
  )

  const layoutDirty = useMemo(() => {
    if (!structure || !layout) return false
    return Object.keys(diffLayoutState(structure, layout)).length > 0
  }, [structure, layout])

  const hasUnsaved = changedCount > 0 || layoutDirty

  const setLocale = (next: Locale) => {
    if (next === locale) return
    if (
      hasUnsaved &&
      !window.confirm(
        'Vannak mentetlen változások. Tényleg váltasz nyelvre? A változások elvesznek.',
      )
    ) {
      return
    }
    localStorage.setItem(LOCALE_STORAGE_KEY, next)
    setStatus(null)
    setLocaleState(next)
  }

  const handleFieldChange = (key: string, value: string) => {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)))
  }

  const handleAddItem = (listName: string) => {
    if (!structure || !layout) return
    const list = structure.lists.find((l) => l.name === listName)
    if (!list) return
    const templateId = list.itemIds[0]
    if (!templateId) return
    const prefix = getItemPrefix(templateId)
    const newId = generateItemId(prefix)

    const templateFields = fields.filter((f) => f.key.startsWith(templateId + '-'))
    const newFields: EditableField[] = templateFields.map((tf) => ({
      ...tf,
      key: newId + tf.key.substring(templateId.length),
      value: tf.value,
      defaultValue: '',
    }))

    setFields((prev) => [...prev, ...newFields])
    setLayout((prev) => {
      if (!prev) return prev
      const order = prev.list_order[listName] ?? list.itemIds
      return {
        ...prev,
        list_order: { ...prev.list_order, [listName]: [...order, newId] },
      }
    })
  }

  const handleDeleteItem = (listName: string, itemId: string) => {
    if (!layout) return
    setFields((prev) => prev.filter((f) => !f.key.startsWith(itemId + '-')))
    setLayout((prev) => {
      if (!prev) return prev
      const order = prev.list_order[listName] ?? []
      const nextHidden = { ...prev.item_hidden }
      delete nextHidden[itemId]
      return {
        ...prev,
        list_order: {
          ...prev.list_order,
          [listName]: order.filter((id) => id !== itemId),
        },
        item_hidden: nextHidden,
      }
    })
  }

  const buildContent = (): Record<string, string> => {
    const content: Record<string, string> = {}
    for (const f of fields) {
      if (f.value !== f.defaultValue) content[f.key] = f.value
    }
    return content
  }

  const handleSave = async (): Promise<boolean> => {
    if (!structure || !layout) return false
    setSaving(true)
    setStatus(null)
    const content = buildContent()
    const layoutDiff = diffLayoutState(structure, layout)
    const { error } = await supabase
      .from('page_content')
      .upsert(
        {
          page_slug: localeConfig.pageSlug,
          content,
          theme,
          layout: layoutDiff,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'page_slug' },
      )
    setSaving(false)
    if (error) {
      setStatus({ type: 'error', text: `Mentés sikertelen: ${error.message}` })
      return false
    }
    setStatus({ type: 'success', text: `Mentve (${localeConfig.label}).` })
    return true
  }

  const handlePublish = async () => {
    setPublishing(true)
    const saved = await handleSave()
    if (!saved) {
      setPublishing(false)
      return
    }

    const { error } = await supabase.functions.invoke('publish-site', {
      body: { locale },
    })
    setPublishing(false)

    if (error) {
      setStatus({ type: 'error', text: `Publikálás sikertelen: ${error.message}` })
    } else {
      setStatus({
        type: 'success',
        text: `Publikálás elindítva (${localeConfig.label}). A weboldal ~1 perc múlva frissül.`,
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        Mezők betöltése ({localeConfig.label})…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-6">
        <div className="max-w-lg bg-red-900/50 p-6 rounded">
          <h2 className="text-xl font-bold mb-2">Betöltési hiba</h2>
          <p className="text-sm mb-2">Locale: {localeConfig.label}</p>
          <p className="text-sm">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 rounded text-sm"
          >
            Újrapróbálom
          </button>
        </div>
      </div>
    )
  }

  if (!layout || !structure) return null

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-20">
        <div className="px-4 sm:px-6 py-3 flex flex-wrap gap-3 justify-between items-center">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold leading-tight">Loricatus Editor</h1>
              <p className="text-xs text-gray-400">
                {user.email}
                {(changedCount > 0 || layoutDirty) && (
                  <span className="ml-2 text-yellow-400">
                    {changedCount > 0 && <>· {changedCount} módosított mező</>}
                    {layoutDirty && <> · elrendezés módosítva</>}
                  </span>
                )}
              </p>
            </div>

            <div className="inline-flex rounded border border-gray-600 overflow-hidden text-xs">
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLocale(l.code)}
                  className={`px-3 py-1.5 ${
                    locale === l.code
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  } ${l.code !== 'hu' ? 'border-l border-gray-600' : ''}`}
                  title={`Váltás: ${l.label}`}
                >
                  {l.flag} {l.code.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="inline-flex rounded border border-gray-600 overflow-hidden text-xs">
              <button
                onClick={() => setViewMode('live')}
                className={`px-3 py-1.5 ${
                  viewMode === 'live'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Élő szerkesztés
              </button>
              <button
                onClick={() => setViewMode('layout')}
                className={`px-3 py-1.5 border-l border-gray-600 ${
                  viewMode === 'layout'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Elrendezés
              </button>
              <button
                onClick={() => setViewMode('form')}
                className={`px-3 py-1.5 border-l border-gray-600 ${
                  viewMode === 'form'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Lista
              </button>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            {status && (
              <span
                className={`text-xs ${
                  status.type === 'error'
                    ? 'text-red-300'
                    : status.type === 'success'
                    ? 'text-green-300'
                    : 'text-blue-300'
                }`}
              >
                {status.text}
              </span>
            )}
            <button
              onClick={() => supabase.auth.signOut()}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs"
            >
              Kijelentkezés
            </button>
            <button
              onClick={handleSave}
              disabled={saving || publishing}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:cursor-not-allowed rounded text-xs font-medium"
            >
              {saving ? 'Mentés…' : 'Mentés piszkozatba'}
            </button>
            <button
              onClick={handlePublish}
              disabled={saving || publishing}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-900 disabled:cursor-not-allowed rounded text-xs font-medium"
            >
              {publishing ? 'Publikálás…' : `Publikálás (${locale.toUpperCase()})`}
            </button>
          </div>
        </div>
      </header>

      {viewMode === 'live' && (
        <LivePreview
          fields={fields}
          layout={layout}
          iframeSrc={localeConfig.iframeSrc}
          onFieldChange={handleFieldChange}
          onLayoutChange={setLayout}
        />
      )}

      {viewMode === 'layout' && (
        <LayoutEditor
          structure={structure}
          state={layout}
          fields={fields}
          onChange={setLayout}
          onAddItem={handleAddItem}
          onDeleteItem={handleDeleteItem}
        />
      )}

      {viewMode === 'form' && (
        <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
          <section className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Téma színek</h2>
            <ThemeEditor theme={theme} onChange={setTheme} />
          </section>

          {grouped.map(([section, sectionFields]) => (
            <section key={section} className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">{section}</h2>
              <div className="space-y-4">
                {sectionFields.map((field) => (
                  <FieldEditor
                    key={field.key}
                    field={field}
                    onChange={(value) => handleFieldChange(field.key, value)}
                  />
                ))}
              </div>
            </section>
          ))}
        </main>
      )}
    </div>
  )
}
