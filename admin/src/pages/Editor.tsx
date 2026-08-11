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
  CatalogEntry,
} from '../lib/types'
import { LOCALES, getLocale } from '../lib/types'
import {
  loadFullManifest,
  resolvePageConfig,
  pageNavLabel,
  type PagesManifest,
} from '../lib/pages'
import PageManager from '../components/PageManager'
import BlogManager from '../components/BlogManager'
import VersionHistory from '../components/VersionHistory'
import { snapshotVersion } from '../lib/versions'
import { Menu, MenuItem, MenuSep } from '../components/ui/Menu'
import Tour, { type TourStep } from '../components/Tour'
import {
  loadCatalog,
  loadPartial,
  parsePartialFields,
  generateSectionId,
} from '../lib/sectionCatalog'
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
  // Multi-page: the page manifest (pages.json) + the currently edited page id.
  const [pagesManifest, setPagesManifest] = useState<PagesManifest | null>(null)
  const [page, setPage] = useState<string>('home')
  const [fields, setFields] = useState<EditableField[]>([])
  const [theme, setTheme] = useState<Record<string, string>>({})
  const [loadedTheme, setLoadedTheme] = useState<Record<string, string>>({})
  const [structure, setStructure] = useState<LayoutStructure | null>(null)
  const [layout, setLayout] = useState<LayoutState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // A just-created page whose HTML isn't published yet (404) — show a friendly
  // "still building" state instead of a raw fetch error. `retryTick` re-runs the
  // load so the building screen auto-opens the editor once the page is live.
  const [pageBuilding, setPageBuilding] = useState(false)
  const [retryTick, setRetryTick] = useState(0)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('live')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)

  // Optimistic concurrency. `revRef` holds the rev we loaded; save_page rejects
  // a write whose expected rev has moved on (someone else saved meanwhile). On
  // conflict we surface a banner + a refresh button and suspend auto-save so we
  // never clobber the other editor's work.
  const revRef = useRef<number>(0)
  const [conflict, setConflict] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Section catalog (curated block library). `sectionPartials` caches fetched
  // partial HTML per template so the preview can materialize added sections.
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [sectionPartials, setSectionPartials] = useState<Record<string, string>>({})

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

  // Load the page manifest (base pages.json + editor-created pages). Until it
  // arrives, the editor behaves exactly like the single-page version (home).
  const refreshManifest = () =>
    loadFullManifest().then((m) => {
      if (m) setPagesManifest(m)
      return m
    })
  useEffect(() => {
    refreshManifest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [showPages, setShowPages] = useState(false)
  const [showBlog, setShowBlog] = useState(false)

  // Guided tour: auto-open once, the first time the editor finishes loading.
  const [showTour, setShowTour] = useState(false)
  const tourAutoRef = useRef(false)
  const closeTour = () => {
    setShowTour(false)
    localStorage.setItem('loricatus-cms-tour-seen', '1')
  }
  useEffect(() => {
    if (loading || tourAutoRef.current) return
    tourAutoRef.current = true
    if (!localStorage.getItem('loricatus-cms-tour-seen')) {
      const t = setTimeout(() => setShowTour(true), 500)
      return () => clearTimeout(t)
    }
  }, [loading])

  // Page-aware config. Resolves (page, locale) from the manifest; falls back to
  // the locale's home page while the manifest is still loading. Keeps the same
  // shape/name as before so the rest of the component is unchanged.
  const localeConfig = useMemo(() => {
    const lc = getLocale(locale)
    if (pagesManifest) {
      const rc = resolvePageConfig(pagesManifest, page, locale)
      if (rc) return { ...rc, label: lc.label }
    }
    return {
      pageSlug: lc.pageSlug,
      htmlUrl: lc.htmlUrl,
      iframeSrc: lc.iframeSrc,
      filePath: lc.filePath,
      label: lc.label,
    }
  }, [pagesManifest, page, locale])

  // Internal link targets for the href editor: every page (current locale) +
  // the contact form. Lets the owner point a button at a page without typing a URL.
  const pageLinks = useMemo(() => {
    if (!pagesManifest) return []
    const home = pagesManifest.pages.find((p) => p.id === 'home')
    const homeUrl = home?.locales[locale]?.url || '/'
    const links = pagesManifest.pages
      .map((p) => {
        const loc = p.locales[locale]
        return loc ? { label: pageNavLabel(p, locale), url: loc.url } : null
      })
      .filter((x): x is { label: string; url: string } => x !== null)
    links.push({ label: 'Kapcsolat / űrlap', url: homeUrl + '#contact' })
    return links
  }, [pagesManifest, locale])

  // (Re)load everything whenever locale changes.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setPageBuilding(false)
    setConflict(false)
    setFields([])
    setStructure(null)
    setLayout(null)
    const isDynamicPage = !!pagesManifest?.pages.find((p) => p.id === page)?._dynamic

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

        // Remember the rev we loaded — save_page compares against it to detect a
        // concurrent save. A brand-new page (no row) starts at 0.
        revRef.current = (pageData?.rev as number | undefined) ?? 0
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

        // Added catalog sections not yet baked into the HTML: fetch their
        // partials + synthesize editable fields (baked ones already come from
        // htmlFields / structure). The partials cache lets the preview render them.
        const cat = await loadCatalog().catch(() => [] as CatalogEntry[])
        const bakedSections = new Set(layoutStructure.sections.map((s) => s.name))
        const partials: Record<string, string> = {}
        const sectionFields: EditableField[] = []
        for (const entry of merged.added_sections) {
          if (bakedSections.has(entry.id)) continue
          try {
            const html = await loadPartial(entry.template)
            partials[entry.template] = html
            const label = cat.find((c) => c.template === entry.template)?.label ?? 'Új szekció'
            sectionFields.push(...parsePartialFields(html, entry.id, label, savedContent))
          } catch {
            /* partial unavailable — skip this section */
          }
        }

        if (cancelled) return

        setCatalog(cat)
        setSectionPartials(partials)
        setFields([...mergedFields, ...virtualFields, ...sectionFields])
        const loadedThemeSan = sanitizeTheme(pageData?.theme)
        setTheme(loadedThemeSan)
        setLoadedTheme(loadedThemeSan)
        setStructure(layoutStructure)
        setLayout(merged)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        // A dynamic page that 404s just hasn't finished its first publish yet.
        if (isDynamicPage && /Failed to fetch|:\s*404/.test(msg)) {
          setPageBuilding(true)
        } else {
          setLoadError(msg)
        }
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      // Reset undo history when changing page/locale (each gets its own context)
      historyRef.current = []
      historyIdxRef.current = -1
    }
  }, [locale, page, localeConfig.htmlUrl, localeConfig.pageSlug, retryTick])

  // While a page is still building, retry the load automatically every 12s so
  // the editor opens by itself once the first publish finishes.
  useEffect(() => {
    if (!pageBuilding) return
    const id = setInterval(() => setRetryTick((t) => t + 1), 12000)
    return () => clearInterval(id)
  }, [pageBuilding])

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

  // Insert a catalog section: fetch its partial, synthesize its fields, and add
  // it to added_sections + the section order. The preview picks it up via the
  // sectionPartials cache. Advanced-only (gated in the UI + by save_page).
  const handleAddSection = async (template: string) => {
    if (!layout) return
    try {
      const html = await loadPartial(template)
      const id = generateSectionId()
      const label = catalog.find((c) => c.template === template)?.label ?? 'Új szekció'
      const newFields = parsePartialFields(html, id, label, {})
      setSectionPartials((prev) => ({ ...prev, [template]: html }))
      setFields((prev) => [...prev, ...newFields])
      setLayout((prev) =>
        prev
          ? {
              ...prev,
              added_sections: [...prev.added_sections, { id, template }],
              section_order: [...prev.section_order, id],
            }
          : prev,
      )
      // Jump to the live view so the new section is immediately visible and
      // editable — no Save needed. (The preview materializes it from the
      // in-memory layout + partial.)
      setViewMode('live')
      setOverlayMode('edit')
      setStatus({
        type: 'success',
        text: `„${label}" szekció beszúrva — már látod és szerkesztheted itt lent. A weboldalra a Publikálással kerül ki.`,
      })
    } catch (err) {
      setStatus({
        type: 'error',
        text: `Szekció betöltése sikertelen: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  const handleRemoveSection = (id: string) => {
    if (!layout) return
    if (!window.confirm('Biztosan törlöd ezt a beszúrt szekciót?')) return
    setFields((prev) => prev.filter((f) => f.key !== id && !f.key.startsWith(id + '-')))
    setLayout((prev) => {
      if (!prev) return prev
      const nextHidden = { ...prev.section_hidden }
      delete nextHidden[id]
      return {
        ...prev,
        added_sections: prev.added_sections.filter((s) => s.id !== id),
        section_order: prev.section_order.filter((s) => s !== id),
        section_hidden: nextHidden,
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
    // A pending conflict blocks saving until the user refreshes — otherwise we'd
    // clobber the concurrent edit we just warned them about.
    if (conflict) return false
    setSaving(true)
    setStatus(null)
    const content = buildContent()
    const layoutDiff = diffLayoutState(structure, layout)
    // Write through the save_page RPC: it enforces membership, discards any
    // theme/layout change from text-only members, and rejects the write if the
    // stored rev moved on (a concurrent save) so we never overwrite it.
    const { data, error } = await supabase.rpc('save_page', {
      p_site: SITE_ID,
      p_slug: localeConfig.pageSlug,
      p_content: content,
      p_theme: theme,
      p_layout: layoutDiff,
      p_expected_rev: revRef.current,
    })
    setSaving(false)
    if (error) {
      // Optimistic-lock conflict (SQLSTATE 40001 / 'conflict:' message).
      if (error.code === '40001' || /conflict:/i.test(error.message || '')) {
        setConflict(true)
        setStatus({
          type: 'error',
          text: 'Valaki más módosította ezt az oldalt — mentés leállítva.',
        })
        return false
      }
      setStatus({ type: 'error', text: `Mentés sikertelen: ${error.message}` })
      return false
    }
    // save_page returns the new rev; track it so the next save compares correctly.
    if (typeof data === 'number') revRef.current = data
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
      body: { locale, page },
    })
    setPublishing(false)

    if (error) {
      setStatus({ type: 'error', text: `Publikálás sikertelen: ${error.message}` })
    } else {
      // Record this publish in the page's version history (audit log + restore
      // point). Best-effort: a failure here must never fail the publish itself.
      snapshotVersion(localeConfig.pageSlug).catch(() => {})
      setStatus({
        type: 'success',
        text: `Publikálás elindítva (${localeConfig.label}). A weboldal ~1 perc múlva frissül.`,
      })
    }
  }

  // Discard local edits and reload the latest saved content from the server.
  // The conflict banner's "Frissítés" button uses this to pull in the other
  // editor's changes; retryTick re-runs the load effect (which clears conflict).
  const refreshFromServer = () => {
    setStatus(null)
    setRetryTick((t) => t + 1)
  }

  // Auto-save: 5s after a genuine unsaved edit → save draft silently. Fires
  // only when the current snapshot diverges from the last saved one, so a
  // freshly loaded (unedited) page never triggers it.
  const saveRef = useRef(handleSave)
  saveRef.current = handleSave
  useEffect(() => {
    if (loading || saving || publishing || conflict) return
    if (currentSnapshot === null || currentSnapshot === savedSnapshotRef.current) return
    const timer = setTimeout(() => {
      saveRef.current()
    }, 5000)
    return () => clearTimeout(timer)
  }, [currentSnapshot, loading, saving, publishing, conflict])

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

  if (pageBuilding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-6">
        <div className="cms-modal-panel max-w-md p-7 text-center">
          <div className="text-3xl">🛠️</div>
          <h2 className="mt-3 text-lg font-semibold">Az oldal még épül…</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-300">
            Ez az újonnan létrehozott oldal most készül el (a publikálás összerakja a
            vázát) — általában <strong>1–2 perc</strong>. Nem kell semmit tenned:
            a szerkesztő <strong>magától megnyílik</strong>, amint kész.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/25 border-t-white/80" />
            Ellenőrzés folyamatban…
          </div>
          <div className="mt-5 flex justify-center gap-2">
            <button onClick={() => setPage('home')} className="cms-btn-ghost">
              ← Vissza a Főoldalra
            </button>
            <button onClick={() => setRetryTick((t) => t + 1)} className="cms-btn-primary">
              Ellenőrzés most
            </button>
          </div>
        </div>
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
      <header className="cms-toolbar sticky top-0 z-20">
        <div className="px-4 sm:px-6 py-2.5 flex flex-wrap gap-x-3 gap-y-2.5 justify-between items-center">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="cms-brand-mark" aria-hidden="true">L</div>
              <div className="leading-tight">
                <h1 className="text-[15px] font-semibold tracking-tight">Loricatus Editor</h1>
                <p className="text-[11px] text-gray-400">
                  {user.email}
                  {(changedCount > 0 || layoutDirty || themeDirty) && (
                    <span className="ml-1.5 text-amber-400">
                      {changedCount > 0 && <>· {changedCount} módosított mező</>}
                      {layoutDirty && <> · elrendezés módosítva</>}
                      {themeDirty && <> · színek módosítva</>}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="cms-segment" data-tour="locale">
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLocale(l.code)}
                  className={`cms-seg-btn${locale === l.code ? ' is-active' : ''}`}
                  title={`Váltás: ${l.label}`}
                >
                  {l.flag} {l.code.toUpperCase()}
                </button>
              ))}
            </div>

            {pagesManifest && pagesManifest.pages.length > 1 && (
              <div className="cms-segment" title="Oldal kiválasztása" data-tour="pages">
                {pagesManifest.pages.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPage(p.id)}
                    className={`cms-seg-btn${page === p.id ? ' is-active' : ''}`}
                    title={`Oldal: ${pageNavLabel(p, locale)}`}
                  >
                    {pageNavLabel(p, locale)}
                  </button>
                ))}
              </div>
            )}

            <span data-tour="content">
              <Menu label="Tartalom" icon="📄" accent="#14b8a6">
                {(close) => (
                  <>
                    {canEditAdvanced && pagesManifest && (
                      <MenuItem
                        icon="📄"
                        label="Oldalak"
                        hint="Aloldal létrehozása / törlése"
                        onClick={() => {
                          setShowPages(true)
                          close()
                        }}
                      />
                    )}
                    <MenuItem
                      icon="📰"
                      label="Blog"
                      hint="Cikkek írása / szerkesztése"
                      onClick={() => {
                        setShowBlog(true)
                        close()
                      }}
                    />
                    <MenuSep />
                    <MenuItem
                      icon="🕘"
                      label="Verziók / visszaállítás"
                      hint="Korábbi publikálások — ki, mikor, visszaállítás"
                      onClick={() => {
                        setShowHistory(true)
                        close()
                      }}
                    />
                  </>
                )}
              </Menu>
            </span>

            <div className="cms-segment" data-tour="viewmodes">
              <button
                onClick={() => setViewMode('live')}
                className={`cms-seg-btn${viewMode === 'live' ? ' is-active' : ''}`}
              >
                Élő szerkesztés
              </button>
              {canEditAdvanced && (
                <button
                  onClick={() => setViewMode('layout')}
                  className={`cms-seg-btn${viewMode === 'layout' ? ' is-active' : ''}`}
                >
                  Elrendezés
                </button>
              )}
              <button
                onClick={() => setViewMode('form')}
                className={`cms-seg-btn${viewMode === 'form' ? ' is-active' : ''}`}
              >
                Lista
              </button>
            </div>

            {viewMode === 'live' && (
              <span data-tour="tools">
              <Menu
                label="Eszközök"
                icon="⚙"
                accent="#8b5cf6"
                active={showTheme || layoutOverlayMode || freeformMode || mobilePreview}
              >
                {(close) => (
                  <>
                    {canEditAdvanced && (
                      <>
                        <MenuItem
                          icon="🎨"
                          label="Színek"
                          hint="Téma színek élő előnézettel"
                          active={showTheme}
                          onClick={() => {
                            setShowTheme((s) => !s)
                            close()
                          }}
                        />
                        <MenuItem
                          icon="📐"
                          label="Átrendezés"
                          hint="Szekciók húzása az előnézeten"
                          active={layoutOverlayMode}
                          onClick={() => {
                            setOverlayMode((m) => (m === 'layout' ? 'edit' : 'layout'))
                            close()
                          }}
                        />
                        <MenuItem
                          icon="🎯"
                          label="Szabad pozíció"
                          hint="Pixel-szintű mozgatás (desktop)"
                          active={freeformMode}
                          onClick={() => {
                            setOverlayMode((m) => (m === 'freeform' ? 'edit' : 'freeform'))
                            close()
                          }}
                        />
                        {freeformMode && Object.keys(layout.positions ?? {}).length > 0 && (
                          <MenuItem
                            icon="↺"
                            label="Pozíciók törlése"
                            onClick={() => {
                              if (
                                window.confirm(
                                  'Minden szabad pozíció törlése? Az elemek visszaállnak default helyükre.',
                                )
                              ) {
                                setLayout({ ...layout, positions: {} })
                              }
                              close()
                            }}
                          />
                        )}
                        <MenuSep />
                      </>
                    )}
                    <MenuItem
                      icon="📱"
                      label="Mobil előnézet"
                      hint="375px szélességű nézet"
                      active={mobilePreview}
                      onClick={() => {
                        setMobilePreview((m) => !m)
                        close()
                      }}
                    />
                    <MenuItem
                      icon="↻"
                      label="Előnézet frissítése"
                      onClick={() => {
                        reloadIframe()
                        close()
                      }}
                    />
                  </>
                )}
              </Menu>
              </span>
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
            <div className="cms-segment">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                className="cms-seg-btn"
                title="Visszavonás (Ctrl+Z)"
              >
                ↶
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                className="cms-seg-btn"
                title="Újra (Ctrl+Shift+Z)"
              >
                ↷
              </button>
            </div>
            <Menu
              align="right"
              trigger={(open) => (
                <button
                  type="button"
                  className={`cms-icon-btn${open ? ' is-active' : ''}`}
                  title="Fiók / súgó"
                  aria-label="Fiók"
                  data-tour="account"
                >
                  {(user.email?.[0] || '?').toUpperCase()}
                </button>
              )}
            >
              {(close) => (
                <>
                  <div className="truncate px-2.5 py-1 text-[11px] text-gray-400">{user.email}</div>
                  <MenuSep />
                  <MenuItem
                    icon="🌐"
                    label="Vissza az élő oldalra"
                    hint="A weboldal megnyitása új lapon"
                    onClick={() => {
                      // iframeSrc is the live URL of the page being edited (it
                      // is what the preview loads) and exists in both the
                      // manifest and fallback config. New tab, so unsaved work
                      // in the editor is never lost.
                      window.open(localeConfig.iframeSrc || '/', '_blank', 'noopener')
                      close()
                    }}
                  />
                  <MenuSep />
                  <MenuItem
                    icon="❓"
                    label="Bemutató / súgó"
                    onClick={() => {
                      setShowTour(true)
                      close()
                    }}
                  />
                  <MenuItem
                    icon="↩"
                    label="Kijelentkezés"
                    danger
                    onClick={() => {
                      supabase.auth.signOut()
                      close()
                    }}
                  />
                </>
              )}
            </Menu>
            <button
              onClick={handleSave}
              disabled={saving || publishing}
              className={`cms-btn-save${
                changedCount > 0 || layoutDirty || themeDirty ? ' is-dirty' : ''
              }`}
              title="Mentés piszkozatba (Ctrl+S)"
              data-tour="save"
            >
              {saving ? 'Mentés…' : 'Mentés'}
            </button>
            <button
              onClick={handlePublish}
              disabled={saving || publishing}
              className="cms-btn-publish"
              data-tour="publish"
            >
              {publishing ? 'Publikálás…' : `Publikálás (${locale.toUpperCase()})`}
            </button>
          </div>
        </div>
      </header>

      {conflict && (
        <div className="sticky top-[56px] z-[15] border-b border-amber-400/30 bg-amber-500/15 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
            <div className="flex items-start gap-2.5 text-sm text-amber-100">
              <span className="text-base leading-none">⚠️</span>
              <span className="leading-relaxed">
                <strong>Valaki más is szerkesztette ezt az oldalt</strong>, és időközben
                mentett. Hogy ne írd felül a munkáját, a mentést leállítottuk. Kattints a
                <strong> Frissítés</strong> gombra a legfrissebb változat betöltéséhez —
                a nem mentett módosításaid ekkor elvesznek.
              </span>
            </div>
            <button
              onClick={refreshFromServer}
              className="cms-btn-primary shrink-0 !py-1.5"
              title="A legfrissebb mentett változat betöltése"
            >
              ↻ Frissítés
            </button>
          </div>
        </div>
      )}

      {showHistory && (
        <VersionHistory
          pageSlug={localeConfig.pageSlug}
          pageLabel={
            pagesManifest ? pageNavLabel(
              pagesManifest.pages.find((p) => p.id === page) ?? pagesManifest.pages[0],
              locale,
            ) : 'Oldal'
          }
          localeLabel={localeConfig.label}
          onClose={() => setShowHistory(false)}
          onRestored={(info) => {
            setShowHistory(false)
            setStatus({ type: 'success', text: info })
            // Reload so the restored content lands in the editor (and picks up
            // the new rev), replacing any local edits.
            refreshFromServer()
          }}
        />
      )}

      {showPages && pagesManifest && canEditAdvanced && (
        <PageManager
          manifest={pagesManifest}
          locale={locale}
          onClose={() => setShowPages(false)}
          onChanged={(info) => {
            refreshManifest().then((m) => {
              // If the page we're viewing was just deleted, fall back to home.
              if (m && !m.pages.find((p) => p.id === page)) setPage('home')
            })
            if (info) setStatus({ type: 'success', text: info })
          }}
          onCreatedPage={(id) => {
            // Jump straight to the new page; the "building" screen auto-opens the
            // editor once its first publish finishes.
            setViewMode('form')
            setPage(id)
          }}
        />
      )}

      {showBlog && (
        <BlogManager
          locale={locale}
          onClose={() => setShowBlog(false)}
          onChanged={(info) => info && setStatus({ type: 'success', text: info })}
        />
      )}

      {showTour && (
        <Tour
          onClose={closeTour}
          steps={
            [
              {
                title: 'Üdv a szerkesztőben! 👋',
                body: 'Egy perc alatt megmutatom a lényeget. Bármikor félbehagyhatod (Esc), és később újraindíthatod.',
              },
              {
                title: 'Élő szerkesztés',
                body: 'Kattints bármelyik szövegre vagy képre az előnézetben, és írd át — a változást rögtön látod.',
              },
              {
                target: 'locale',
                title: 'Nyelvek',
                body: 'Válts a nyelvek között (HU / EN / IT). Minden nyelvet külön szerkeszthetsz és publikálhatsz.',
              },
              {
                target: 'pages',
                title: 'Oldalak közti váltás',
                body: 'Itt választhatod ki, melyik oldalt szerkeszted éppen.',
                show: !!(pagesManifest && pagesManifest.pages.length > 1),
              },
              {
                target: 'content',
                title: 'Tartalom: oldalak, blog, verziók',
                body: 'A „📄 Tartalom" menüből hozol létre új aloldalt (pl. „Szolgáltatásaink"), itt írod/szerkeszted a blogcikkeket, és innen éred el a korábbi publikálásokat is — bármelyikre egy kattintással visszaállhatsz, ha valami félresikerült.',
                show: true,
              },
              {
                target: 'viewmodes',
                title: 'Nézetek',
                body: 'Élő szerkesztés · Elrendezés (szekciók sorrendje, új szekció beszúrása) · Lista (minden mező egy helyen).',
              },
              {
                target: 'tools',
                title: 'Eszközök',
                body: 'A „⚙ Eszközök" menüben: színek, szekció-átrendezés, mobil előnézet és az előnézet frissítése. Ami épp aktív, pipát kap.',
                show: viewMode === 'live',
              },
              {
                target: 'save',
                title: 'Mentés',
                body: 'Piszkozatba ment — a látogatók még nem látják. Bátran ments gyakran, nem tudsz elrontani semmit.',
              },
              {
                target: 'publish',
                title: 'Publikálás',
                body: 'Közzététel: a változás ~1 perc múlva megjelenik az élő weboldalon.',
              },
              {
                target: 'account',
                title: 'Fiók és súgó',
                body: 'A jobb felső kezdőbetűs gomb alatt van a kijelentkezés — és innen indíthatod újra bármikor ezt a bemutatót (Bemutató / súgó).',
              },
              {
                title: 'Kész! ✓',
                body: 'Próbáld ki nyugodtan. A bemutatót a jobb felső fiók-menüből bármikor újraindíthatod.',
              },
            ] as TourStep[]
          }
        />
      )}

      {viewMode === 'live' && (
        <LivePreview
          fields={fields}
          layout={layout}
          theme={theme}
          iframeSrc={localeConfig.iframeSrc}
          overlayMode={overlayMode}
          mobilePreview={mobilePreview}
          iframeKey={iframeKey}
          sectionPartials={sectionPartials}
          pageLinks={pageLinks}
          onFieldChange={handleFieldChange}
          onLayoutChange={setLayout}
        />
      )}

      {viewMode === 'live' && showTheme && canEditAdvanced && (
        <div className="cms-sidesheet fixed top-[56px] right-0 bottom-0 w-full max-w-[360px] z-[1200] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h2 className="font-semibold text-[15px]">🎨 Színek</h2>
            <button
              onClick={() => setShowTheme(false)}
              className="cms-icon-btn"
              title="Bezárás"
            >
              ✕
            </button>
          </div>
          <div className="p-5 space-y-4 overflow-y-auto">
            <p className="text-xs text-gray-400 leading-relaxed">
              A színek azonnal frissülnek az előnézetben. A mentéshez / közzétételhez
              használd a fenti Mentés / Publikálás gombot.
            </p>
            <ThemeEditor theme={theme} onChange={setTheme} />
            {Object.keys(theme).length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('Minden szín visszaáll az alap színekre?')) setTheme({})
                }}
                className="cms-btn-secondary w-full justify-center"
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
          catalog={catalog}
          onChange={setLayout}
          onAddItem={handleAddItem}
          onDeleteItem={handleDeleteItem}
          onAddSection={handleAddSection}
          onRemoveSection={handleRemoveSection}
        />
      )}

      {viewMode === 'form' && (
        <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
          {canEditAdvanced && (
            <section className="cms-card p-6">
              <h2 className="text-lg font-semibold mb-4">Téma színek</h2>
              <ThemeEditor theme={theme} onChange={setTheme} />
            </section>
          )}

          {grouped.map(([section, sectionFields]) => (
            <section key={section} className="cms-card p-6">
              <h2 className="text-lg font-semibold mb-4">{section}</h2>
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
