import { useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, SITE_ID, type Membership } from '../lib/supabase'
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
import { sanitizeTheme, themesEqual } from '../lib/theme'
import FieldEditor from '../components/FieldEditor'
import ThemeEditor from '../components/ThemeEditor'
import LivePreview, { type OverlayMode } from '../components/LivePreview'
import LayoutEditor from '../components/LayoutEditor'

interface Props {
  user: User
  membership: Membership
}

type Status = { type: 'info' | 'error' | 'success'; text: string } | null

const LOCALE_STORAGE_KEY = 'loricatus-cms-locale'

function SavedAgo({ since }: { since: number }) {
  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])
  const seconds = Math.floor((Date.now() - since) / 1000)
  let text: string
  if (seconds < 30) text = 'most'
  else if (seconds < 60) text = `${seconds} mp-e`
  else if (seconds < 3600) text = `${Math.floor(seconds / 60)} perce`
  else if (seconds < 86400) text = `${Math.floor(seconds / 3600)} órája`
  else text = `${Math.floor(seconds / 86400)} napja`
  return (
    <span className="text-xs text-gray-400" title={new Date(since).toLocaleString()}>
      Utolsó mentés: {text}
    </span>
  )
}

export default function EditorPage({ user, membership }: Props) {
  // Text/advanced capability gate. A text-only member sees just the content
  // editors; all design controls (layout, colours, free positioning) are
  // hidden. save_page() re-enforces this server-side, so the UI hiding is
  // convenience, not the security boundary.
  const canEditAdvanced = membership.can_edit_advanced
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (saved === 'en' || saved === 'it') return saved
    return 'hu'
  })
  const [fields, setFields] = useState<EditableField[]>([])
  const [theme, setTheme] = useState<Record<string, string>>({})
  const [loadedTheme, setLoadedTheme] = useState<Record<string, string>>({})
  const [structure, setStructure] = useState<LayoutStructure | null>(null)
  const [layout, setLayout] = useState<LayoutState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('live')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)

  // Live-preview iframe toolbar state, lifted up so the buttons can live in
  // the main header (clean iframe area, no overlap with the website content).
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('edit')
  const [mobilePreview, setMobilePreview] = useState(false)
  const [showTheme, setShowTheme] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)
  const reloadIframe = () => setIframeKey((k) => k + 1)
  const layoutOverlayMode = overlayMode === 'layout'
  const freeformMode = overlayMode === 'freeform'

  // ── Undo/Redo history ──────────────────────────────────────────────────────
  type Snapshot = {
    fields: EditableField[]
    theme: Record<string, string>
    layout: LayoutState
  }
  const historyRef = useRef<Snapshot[]>([])
  const historyIdxRef = useRef(-1)
  const skipSnapshotRef = useRef(false) // set when restoring (undo/redo)
  const [historyVersion, setHistoryVersion] = useState(0) // forces re-render of undo/redo enabled state
  const MAX_HISTORY = 40
  const SNAPSHOT_DEBOUNCE_MS = 400

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
          .eq('site_id', SITE_ID)
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
        const loadedThemeSan = sanitizeTheme(pageData?.theme)
        setTheme(loadedThemeSan)
        setLoadedTheme(loadedThemeSan)
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
      // Reset undo history when changing locale (each locale gets its own context)
      historyRef.current = []
      historyIdxRef.current = -1
    }
  }, [locale, localeConfig.htmlUrl, localeConfig.pageSlug])

  // Snapshot fields/theme/layout for undo history, debounced so mid-typing
  // edits don't fragment the history into per-keystroke entries.
  useEffect(() => {
    if (loading) return
    if (!layout || !structure) return
    if (skipSnapshotRef.current) {
      skipSnapshotRef.current = false
      return
    }
    const timer = setTimeout(() => {
      const snap: Snapshot = {
        fields: fields.map((f) => ({ ...f })),
        theme: { ...theme },
        layout: JSON.parse(JSON.stringify(layout)),
      }
      // Drop any "forward" history we'd shadow
      const trimmed = historyRef.current.slice(0, historyIdxRef.current + 1)
      trimmed.push(snap)
      // Cap history length
      if (trimmed.length > MAX_HISTORY) trimmed.shift()
      historyRef.current = trimmed
      historyIdxRef.current = trimmed.length - 1
      setHistoryVersion((v) => v + 1)
    }, SNAPSHOT_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [fields, theme, layout, loading, structure])

  const restoreSnapshot = (snap: Snapshot) => {
    skipSnapshotRef.current = true
    setFields(snap.fields.map((f) => ({ ...f })))
    setTheme({ ...snap.theme })
    setLayout(JSON.parse(JSON.stringify(snap.layout)))
  }

  const handleUndo = () => {
    if (historyIdxRef.current <= 0) return
    historyIdxRef.current -= 1
    const snap = historyRef.current[historyIdxRef.current]
    if (snap) restoreSnapshot(snap)
    setHistoryVersion((v) => v + 1)
  }

  const handleRedo = () => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return
    historyIdxRef.current += 1
    const snap = historyRef.current[historyIdxRef.current]
    if (snap) restoreSnapshot(snap)
    setHistoryVersion((v) => v + 1)
  }

  const canUndo = historyIdxRef.current > 0
  const canRedo = historyIdxRef.current < historyRef.current.length - 1
  // historyVersion is referenced so React re-evaluates canUndo/canRedo after a state push
  void historyVersion

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

  const themeDirty = useMemo(() => !themesEqual(theme, loadedTheme), [theme, loadedTheme])

  // Snapshot of exactly what a save persists (content + theme + layout diff).
  // Unsaved-ness is measured against the LAST SAVE, not against the raw HTML
  // defaults — otherwise a page that merely has stored content reads as
  // permanently "dirty" and the auto-save below fires every 5s forever.
  const savedSnapshotRef = useRef<string | null>(null)
  const currentSnapshot = useMemo(() => {
    if (!structure || !layout) return null
    const content: Record<string, string> = {}
    for (const f of fields) if (f.value !== f.defaultValue) content[f.key] = f.value
    return JSON.stringify({ content, theme, layout: diffLayoutState(structure, layout) })
  }, [fields, theme, structure, layout])

  const hasUnsaved =
    currentSnapshot !== null && currentSnapshot !== savedSnapshotRef.current

  // Establish the saved baseline whenever a (re)load settles, so a freshly
  // loaded page is not considered dirty (and locale switches reset it).
  useEffect(() => {
    if (loading) return
    savedSnapshotRef.current = currentSnapshot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

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
    // Write through the save_page RPC: it enforces membership and, for
    // text-only members, discards any theme/layout change server-side.
    const { error } = await supabase.rpc('save_page', {
      p_site: SITE_ID,
      p_slug: localeConfig.pageSlug,
      p_content: content,
      p_theme: theme,
      p_layout: layoutDiff,
    })
    setSaving(false)
    if (error) {
      setStatus({ type: 'error', text: `Mentés sikertelen: ${error.message}` })
      return false
    }
    // Rebase the saved baseline so the auto-save effect goes quiet until the
    // next genuine edit (breaks the perpetual re-save loop). Same shape/order
    // as currentSnapshot so the strings compare equal.
    savedSnapshotRef.current = JSON.stringify({ content, theme, layout: layoutDiff })
    setLoadedTheme(theme)
    setStatus({ type: 'success', text: `Mentve (${localeConfig.label}).` })
    setLastSavedAt(Date.now())
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

  // Auto-save: 5s after a genuine unsaved edit → save draft silently. Fires
  // only when the current snapshot diverges from the last saved one, so a
  // freshly loaded (unedited) page never triggers it.
  const saveRef = useRef(handleSave)
  saveRef.current = handleSave
  useEffect(() => {
    if (loading || saving || publishing) return
    if (currentSnapshot === null || currentSnapshot === savedSnapshotRef.current) return
    const timer = setTimeout(() => {
      saveRef.current()
    }, 5000)
    return () => clearTimeout(timer)
  }, [currentSnapshot, loading, saving, publishing])

  // Keyboard shortcuts. Ctrl/Cmd+S = save, Ctrl/Cmd+Z = undo,
  // Ctrl/Cmd+Shift+Z (or Ctrl+Y) = redo. 1/2/3 = switch view mode (but
  // not when an input is focused).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey
      const target = e.target as HTMLElement | null
      const isTextEntry =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          (target as HTMLElement).isContentEditable)

      if (isMod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!saving && !publishing) handleSave()
        return
      }
      if (isMod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
        return
      }
      if (isMod && ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y')) {
        e.preventDefault()
        handleRedo()
        return
      }
      if (isTextEntry) return
      if (e.key === '1') setViewMode('live')
      else if (e.key === '2' && canEditAdvanced) setViewMode('layout')
      else if (e.key === '3') setViewMode('form')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saving, publishing, canEditAdvanced])

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
                {(changedCount > 0 || layoutDirty || themeDirty) && (
                  <span className="ml-2 text-yellow-400">
                    {changedCount > 0 && <>· {changedCount} módosított mező</>}
                    {layoutDirty && <> · elrendezés módosítva</>}
                    {themeDirty && <> · színek módosítva</>}
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
              {canEditAdvanced && (
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
              )}
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

            {viewMode === 'live' && (
              <div className="flex gap-1 items-center text-xs">
                {canEditAdvanced && (
                  <>
                    <button
                      onClick={() => setShowTheme((s) => !s)}
                      className={`px-2 py-1.5 rounded ${
                        showTheme
                          ? 'bg-pink-600 text-white'
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                      }`}
                      title="Téma színek szerkesztése (élő előnézettel)"
                    >
                      🎨 Színek
                    </button>
                    <button
                      onClick={() =>
                        setOverlayMode((m) => (m === 'layout' ? 'edit' : 'layout'))
                      }
                      className={`px-2 py-1.5 rounded ${
                        layoutOverlayMode
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                      }`}
                      title="Drag-and-drop az iframe-en a szekciók és kártyák átrendezésére"
                    >
                      📐 Elrendezés
                    </button>
                    <button
                      onClick={() =>
                        setOverlayMode((m) => (m === 'freeform' ? 'edit' : 'freeform'))
                      }
                      className={`px-2 py-1.5 rounded ${
                        freeformMode
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                      }`}
                      title="Pixel-szintű szabad pozícionálás (csak desktop nézet)"
                    >
                      🎯 Szabad pozíció
                    </button>
                    {freeformMode && Object.keys(layout.positions ?? {}).length > 0 && (
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              'Minden szabad pozíció törlése? Az elemek visszaállnak default helyükre.',
                            )
                          ) {
                            setLayout({ ...layout, positions: {} })
                          }
                        }}
                        className="px-2 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded"
                        title="Minden pozíció törlése"
                      >
                        ↺ pozíciók
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={() => setMobilePreview((m) => !m)}
                  className={`px-2 py-1.5 rounded ${
                    mobilePreview
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  }`}
                  title="375px szélességű iframe — mobil nézet előnézete"
                >
                  📱 Mobil
                </button>
                <button
                  onClick={reloadIframe}
                  className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded"
                  title="Iframe újratöltése"
                >
                  ↻
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            {lastSavedAt && !status && <SavedAgo since={lastSavedAt} />}
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
            <div className="inline-flex rounded border border-gray-600 overflow-hidden text-xs">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white"
                title="Visszavonás (Ctrl+Z)"
              >
                ↶
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white border-l border-gray-600"
                title="Újra (Ctrl+Shift+Z)"
              >
                ↷
              </button>
            </div>
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
              title="Mentés piszkozatba (Ctrl+S)"
            >
              {saving ? 'Mentés…' : 'Mentés'}
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
          theme={theme}
          iframeSrc={localeConfig.iframeSrc}
          overlayMode={overlayMode}
          mobilePreview={mobilePreview}
          iframeKey={iframeKey}
          onFieldChange={handleFieldChange}
          onLayoutChange={setLayout}
        />
      )}

      {viewMode === 'live' && showTheme && canEditAdvanced && (
        <div className="fixed top-[56px] right-0 bottom-0 w-full max-w-[360px] bg-gray-800 border-l border-gray-700 z-[1200] flex flex-col shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="font-bold">🎨 Színek</h2>
            <button
              onClick={() => setShowTheme(false)}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              title="Bezárás"
            >
              ✕
            </button>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto">
            <p className="text-xs text-gray-400">
              A színek azonnal frissülnek az előnézetben. A mentéshez / közzétételhez
              használd a fenti Mentés / Publikálás gombot.
            </p>
            <ThemeEditor theme={theme} onChange={setTheme} />
            {Object.keys(theme).length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('Minden szín visszaáll az alap színekre?')) setTheme({})
                }}
                className="w-full px-3 py-2 bg-amber-700 hover:bg-amber-600 rounded text-sm"
              >
                ↺ Vissza az alap színekhez
              </button>
            )}
          </div>
        </div>
      )}

      {viewMode === 'layout' && canEditAdvanced && (
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
          {canEditAdvanced && (
            <section className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">Téma színek</h2>
              <ThemeEditor theme={theme} onChange={setTheme} />
            </section>
          )}

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
