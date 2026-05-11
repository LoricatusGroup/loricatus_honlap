import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { parseEditableFields } from '../lib/parseHtml'
import {
  parseLayoutStructure,
  mergeLayoutState,
  diffLayoutState,
} from '../lib/parseLayout'
import type {
  EditableField,
  LayoutState,
  LayoutStructure,
  ViewMode,
} from '../lib/types'
import FieldEditor from '../components/FieldEditor'
import ThemeEditor from '../components/ThemeEditor'
import LivePreview from '../components/LivePreview'
import LayoutEditor from '../components/LayoutEditor'

interface Props {
  user: User
}

type Status = { type: 'info' | 'error' | 'success'; text: string } | null

export default function EditorPage({ user }: Props) {
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

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [htmlFields, layoutStructure] = await Promise.all([
          parseEditableFields(),
          parseLayoutStructure(),
        ])
        const { data: pageData, error } = await supabase
          .from('page_content')
          .select('*')
          .eq('page_slug', 'index')
          .single()
        if (error) throw error

        if (cancelled) return

        const savedContent = (pageData?.content ?? {}) as Record<string, string>
        const mergedFields = htmlFields.map((f) => ({
          ...f,
          value: savedContent[f.key] ?? f.defaultValue,
        }))

        setFields(mergedFields)
        setTheme(pageData?.theme ?? {})
        setStructure(layoutStructure)
        setLayout(mergeLayoutState(layoutStructure, pageData?.layout))
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
  }, [])

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

  const handleFieldChange = (key: string, value: string) => {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)))
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
      .update({
        content,
        theme,
        layout: layoutDiff,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('page_slug', 'index')
    setSaving(false)
    if (error) {
      setStatus({ type: 'error', text: `Mentés sikertelen: ${error.message}` })
      return false
    }
    setStatus({ type: 'success', text: 'Mentve.' })
    return true
  }

  const handlePublish = async () => {
    setPublishing(true)
    const saved = await handleSave()
    if (!saved) {
      setPublishing(false)
      return
    }

    const { error } = await supabase.functions.invoke('publish-site')
    setPublishing(false)

    if (error) {
      setStatus({ type: 'error', text: `Publikálás sikertelen: ${error.message}` })
    } else {
      setStatus({
        type: 'success',
        text: 'Publikálás elindítva. A weboldal ~1 perc múlva frissül.',
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        Mezők betöltése…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-6">
        <div className="max-w-lg bg-red-900/50 p-6 rounded">
          <h2 className="text-xl font-bold mb-2">Betöltési hiba</h2>
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
          <div className="flex items-center gap-4">
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
              <button
                onClick={() => setViewMode('live')}
                className={`px-3 py-1.5 ${
                  viewMode === 'live'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                title="Az élő oldalon kattintva szerkeszthetsz"
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
                title="Szekciók és kártyák átrendezése, elrejtése"
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
                title="Klasszikus űrlap minden mezővel"
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
              {publishing ? 'Publikálás…' : 'Publikálás'}
            </button>
          </div>
        </div>
      </header>

      {viewMode === 'live' && (
        <LivePreview fields={fields} layout={layout} onFieldChange={handleFieldChange} />
      )}

      {viewMode === 'layout' && (
        <LayoutEditor structure={structure} state={layout} onChange={setLayout} />
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
