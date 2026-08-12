import { useEffect, useState } from 'react'
import Modal from './inline/Modal'
import { supabase } from '../lib/supabase'
import {
  createPage,
  deletePage,
  renamePage,
  reorderPages,
  slugify,
  pageNavLabel,
  type PageEntry,
  type PagesManifest,
} from '../lib/pages'
import {
  listPageUploads,
  uploadPageHtml,
  setPageUploadMode,
  deletePageUpload,
  looksLikeHtml,
  MAX_UPLOAD_BYTES,
  type PageUpload,
  type UploadMode,
} from '../lib/pageUploads'

interface Props {
  manifest: PagesManifest
  locale: string
  onClose: () => void
  onChanged: (info?: string) => void // refresh manifest; optional status text
  onCreatedPage: (id: string) => void // jump the editor to a freshly created page
}

const TEMPLATES = [
  { value: 'text', label: 'Szöveges oldal', desc: 'Cím + bevezető + szövegblokkok' },
  { value: 'cards', label: 'Kártyás oldal', desc: 'Cím + kártyalista (mint a Referenciák)' },
  { value: 'blank', label: 'Üres oldal', desc: 'Csak cím — szekciókból építed fel a könyvtárból' },
]

const LOCALES = [
  { code: 'hu', label: 'Magyar' },
  { code: 'en', label: 'Angol' },
  { code: 'it', label: 'Olasz' },
] as const

const UPLOAD_MODES: { value: UploadMode; label: string; desc: string }[] = [
  {
    value: 'shell',
    label: 'A weboldal keretében',
    desc: 'A feltöltött tartalom a megszokott menü és lábléc közé kerül — a látogató tud navigálni.',
  },
  {
    value: 'standalone',
    label: 'Önálló oldalként',
    desc: 'Pontosan úgy jelenik meg, ahogy elkészült — saját design, de nincs menü és lábléc.',
  },
]

// Read + validate a picked HTML file. Rejects wrong file types and oversized
// files here so the owner gets a clear message instead of a failed publish.
async function readHtmlFile(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    const maxMb = (MAX_UPLOAD_BYTES / 1_000_000).toFixed(0)
    throw new Error(
      `A fájl túl nagy (${Math.round(file.size / 1024)} KB). Legfeljebb ${maxMb} MB tölthető fel.`,
    )
  }
  const text = await file.text()
  if (!text.trim()) throw new Error('A fájl üres.')
  if (!looksLikeHtml(text)) {
    throw new Error('Ez nem HTML-fájlnak tűnik. Egy teljes .html oldalt tölts fel.')
  }
  return text
}

// The "Oldalak" panel: create / delete editor-made pages. Creating a page also
// publishes it so its HTML is scaffolded live; the owner then edits it via the
// page switcher (once the ~1 min publish finishes).
export default function PageManager({ manifest, locale, onClose, onChanged, onCreatedPage }: Props) {
  const dynamic = manifest.pages.filter((p) => p._dynamic)
  const [name, setName] = useState('')
  const [labelEn, setLabelEn] = useState('')
  const [labelIt, setLabelIt] = useState('')
  const [showLangLabels, setShowLangLabels] = useState(false)
  const [template, setTemplate] = useState('text')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editLabels, setEditLabels] = useState({ hu: '', en: '', it: '' })

  // ── Ready-made HTML uploads ────────────────────────────────────────────────
  // New page: build from a template, or upload a finished HTML document.
  const [source, setSource] = useState<'template' | 'upload'>('template')
  const [newHtml, setNewHtml] = useState<{ name: string; text: string } | null>(null)
  const [newUploadMode, setNewUploadMode] = useState<UploadMode>('shell')
  const [newUploadLocale, setNewUploadLocale] = useState<string>(locale)
  // Existing pages: which page's per-locale upload panel is open + what's stored.
  const [uploadPanelId, setUploadPanelId] = useState<string | null>(null)
  const [uploads, setUploads] = useState<PageUpload[]>([])

  const refreshUploads = () =>
    listPageUploads().then(({ data }) => {
      if (data) setUploads(data as PageUpload[])
    })
  useEffect(() => {
    refreshUploads()
  }, [])
  const uploadFor = (pageId: string, lc: string) =>
    uploads.find((u) => u.page_id === pageId && u.locale === lc) || null

  const pickHtml = async (file: File | undefined, onOk: (text: string, name: string) => void) => {
    if (!file) return
    setError(null)
    try {
      const text = await readHtmlFile(file)
      onOk(text, file.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'A fájl beolvasása nem sikerült.')
    }
  }

  // Upload (or replace) the HTML of an existing page for one locale, then
  // republish so the live file is regenerated from it.
  const handleUploadExisting = async (
    pageId: string,
    lc: string,
    text: string,
    mode: UploadMode,
  ) => {
    setBusy(true)
    setError(null)
    const { error: err } = await uploadPageHtml(pageId, lc, text, mode)
    if (err) {
      setBusy(false)
      setError(err.message)
      return
    }
    await supabase.functions
      .invoke('publish-site', { body: { locale: 'all', page: pageId } })
      .catch(() => {})
    await refreshUploads()
    setBusy(false)
    onChanged('HTML feltöltve — ~1 perc múlva frissül az élő oldal.')
  }

  // Switch an upload between "inside the site frame" and "standalone", then
  // republish so the live page is re-rendered in the new mode.
  const handleToggleMode = async (pageId: string, lc: string, mode: UploadMode) => {
    setBusy(true)
    setError(null)
    const { error: err } = await setPageUploadMode(pageId, lc, mode)
    if (err) {
      setBusy(false)
      setError(err.message)
      return
    }
    await supabase.functions
      .invoke('publish-site', { body: { locale: 'all', page: pageId } })
      .catch(() => {})
    await refreshUploads()
    setBusy(false)
    onChanged(
      mode === 'standalone'
        ? 'Átállítva önálló oldalra — ~1 perc múlva frissül.'
        : 'Átállítva a weboldal keretébe — ~1 perc múlva frissül.',
    )
  }

  const handleDeleteUpload = async (pageId: string, lc: string) => {
    if (
      !window.confirm(
        'Törlöd a feltöltött HTML-t ehhez a nyelvhez? Az oldal a sablonos változatra áll vissza a következő publikáláskor.',
      )
    )
      return
    setBusy(true)
    setError(null)
    const { error: err } = await deletePageUpload(pageId, lc)
    if (err) {
      setBusy(false)
      setError(err.message)
      return
    }
    await refreshUploads()
    setBusy(false)
    onChanged('Feltöltött HTML törölve.')
  }
  const slug = slugify(name)
  const taken = new Set(manifest.pages.map((p) => p.id))
  const clash = slug && taken.has(slug)

  const handleCreate = async () => {
    if (!slug) {
      setError('Adj meg egy nevet az oldalnak.')
      return
    }
    if (clash) {
      setError('Ilyen nevű oldal már van. Válassz másik nevet.')
      return
    }
    if (source === 'upload' && !newHtml) {
      setError('Válaszd ki a feltöltendő HTML-fájlt.')
      return
    }
    setBusy(true)
    setError(null)
    const label = name.trim()
    const nav = {
      hu: label,
      en: labelEn.trim() || label,
      it: labelIt.trim() || label,
    }
    // An uploaded page still gets a page row (nav entry, URL, ordering); its
    // body comes from the upload instead of a template.
    const { error: err } = await createPage(slug, source === 'upload' ? 'blank' : template, nav)
    if (err) {
      setError(err.message)
      setBusy(false)
      return
    }
    if (source === 'upload' && newHtml) {
      const { error: upErr } = await uploadPageHtml(
        slug,
        newUploadLocale,
        newHtml.text,
        newUploadMode,
      )
      if (upErr) {
        setBusy(false)
        setError(`Az oldal létrejött, de a HTML feltöltése nem sikerült: ${upErr.message}`)
        return
      }
    }
    // Scaffold every locale file in ONE publish run (locale:'all'). Firing one
    // publish per locale used to race on git push and silently drop locales.
    await supabase.functions
      .invoke('publish-site', { body: { locale: 'all', page: slug } })
      .catch(() => {})
    setBusy(false)
    if (source === 'upload') {
      // Don't jump the editor into an uploaded page: it has no editable CMS
      // fields, so the page list + live URL are the useful next step.
      onChanged(
        `„${label}" oldal létrehozva a feltöltött HTML-lel — ~1 perc múlva élesben van a /${slug}/ címen.`,
      )
      onClose()
      return
    }
    onChanged(`„${label}" oldal létrehozva — épül (~1 perc). A szerkesztő magától megnyílik, amint kész.`)
    onCreatedPage(slug)
    onClose()
  }

  // Republish home (every locale) so the nav/labels/order refresh after a
  // rename or reorder. locale:'all' rebuilds hu/en/it in one run.
  const republishHome = () =>
    supabase.functions.invoke('publish-site', { body: { locale: 'all', page: 'home' } }).catch(() => {})

  const startEdit = (p: PageEntry) => {
    setEditId(p.id)
    setEditLabels({
      hu: p.nav?.hu || p.id,
      en: p.nav?.en || p.nav?.hu || p.id,
      it: p.nav?.it || p.nav?.hu || p.id,
    })
    setError(null)
  }

  const saveRename = async () => {
    if (!editId) return
    if (!editLabels.hu.trim()) {
      setError('A magyar felirat nem lehet üres.')
      return
    }
    setBusy(true)
    setError(null)
    const nav = {
      hu: editLabels.hu.trim(),
      en: editLabels.en.trim() || editLabels.hu.trim(),
      it: editLabels.it.trim() || editLabels.hu.trim(),
    }
    const { error: err } = await renamePage(editId, nav)
    if (err) {
      setBusy(false)
      setError(err.message)
      return
    }
    // Republish home + the page (every locale, one run each) so the new label
    // shows in the nav + titles across all languages.
    await Promise.all([
      republishHome(),
      supabase.functions.invoke('publish-site', { body: { locale: 'all', page: editId } }),
    ]).catch(() => {})
    setBusy(false)
    setEditId(null)
    onChanged(`Felirat frissítve — ~1 perc múlva jelenik meg a menüben.`)
  }

  const move = async (id: string, dir: -1 | 1) => {
    const ids = dynamic.map((p) => p.id)
    const i = ids.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    setBusy(true)
    setError(null)
    const { error: err } = await reorderPages(ids)
    if (err) {
      setBusy(false)
      setError(err.message)
      return
    }
    await republishHome()
    setBusy(false)
    onChanged('Sorrend frissítve — ~1 perc múlva látszik a menüben.')
  }

  const handleDelete = async (id: string, label: string) => {
    if (!window.confirm(`Biztosan törlöd a(z) „${label}" oldalt? A tartalma is elvész.`)) return
    setBusy(true)
    setError(null)
    const { error: err } = await deletePage(id)
    if (err) {
      setBusy(false)
      setError(err.message)
      return
    }
    // Publish home (every locale) with removePage so the page's files are
    // deleted and the nav + sitemap refresh without it in all languages.
    await supabase.functions
      .invoke('publish-site', { body: { locale: 'all', page: 'home', removePage: id } })
      .catch(() => {})
    setBusy(false)
    onChanged(`„${label}" oldal törölve. ~1 perc múlva tűnik el a menüből és a szerverről is.`)
  }

  return (
    <Modal
      label="📄 Oldalak"
      caption="Új aloldal létrehozása vagy törlése. Az új oldal a közös arculati kerettel jön létre, és bekerül a menübe."
      maxWidth="max-w-lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="cms-btn-ghost" onClick={onClose} disabled={busy}>
            Bezárás
          </button>
          <button
            type="button"
            className="cms-btn-primary"
            onClick={handleCreate}
            disabled={busy || !slug || !!clash}
          >
            {busy ? 'Létrehozás…' : '➕ Oldal létrehozása'}
          </button>
        </>
      }
    >
      <div className="space-y-5 pb-2">
        {/* Existing dynamic pages */}
        {dynamic.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              Saját oldalaid
            </p>
            <ul className="space-y-1.5">
              {dynamic.map((p, i) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5"
                >
                  {editId === p.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        {(['hu', 'en', 'it'] as const).map((lc) => (
                          <div key={lc}>
                            <label className="mb-1 block text-[10px] uppercase text-gray-400">
                              {lc}
                            </label>
                            <input
                              className="cms-input !py-1.5 !text-[13px]"
                              value={editLabels[lc]}
                              onChange={(e) =>
                                setEditLabels((s) => ({ ...s, [lc]: e.target.value }))
                              }
                              maxLength={48}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="cms-btn-ghost !py-1.5 !text-xs"
                          onClick={() => setEditId(null)}
                          disabled={busy}
                        >
                          Mégse
                        </button>
                        <button
                          type="button"
                          className="cms-btn-primary !py-1.5 !text-xs"
                          onClick={saveRename}
                          disabled={busy}
                        >
                          Mentés
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <div className="flex flex-col">
                          <button
                            type="button"
                            className="cms-icon-btn !h-4 !w-5 !text-[10px]"
                            title="Feljebb"
                            onClick={() => move(p.id, -1)}
                            disabled={busy || i === 0}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            className="cms-icon-btn !h-4 !w-5 !text-[10px]"
                            title="Lejjebb"
                            onClick={() => move(p.id, 1)}
                            disabled={busy || i === dynamic.length - 1}
                          >
                            ▼
                          </button>
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm text-white">
                            {pageNavLabel(p, locale)}
                          </div>
                          <div className="truncate text-[11px] text-gray-400">
                            {p.locales[locale]?.url || `/${p.id}/`}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          className={`cms-btn-ghost !px-2.5 !text-xs ${
                            uploadPanelId === p.id ? 'text-lime' : ''
                          }`}
                          title="Kész HTML feltöltése nyelvenként"
                          onClick={() => setUploadPanelId(uploadPanelId === p.id ? null : p.id)}
                          disabled={busy}
                        >
                          HTML
                        </button>
                        <button
                          type="button"
                          className="cms-btn-ghost !px-2.5 !text-xs"
                          onClick={() => startEdit(p)}
                          disabled={busy}
                        >
                          Átnevezés
                        </button>
                        <button
                          type="button"
                          className="cms-btn-ghost !px-2.5 !text-xs text-red-300 hover:text-red-200"
                          onClick={() => handleDelete(p.id, pageNavLabel(p, locale))}
                          disabled={busy}
                        >
                          Törlés
                        </button>
                      </div>
                    </div>
                  )}

                  {uploadPanelId === p.id && editId !== p.id && (
                    <div className="mt-2.5 space-y-1.5 border-t border-white/10 pt-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-gray-400">
                        Kész HTML nyelvenként
                      </p>
                      {LOCALES.map((l) => {
                        const up = uploadFor(p.id, l.code)
                        return (
                          <div
                            key={l.code}
                            className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2.5 py-1.5"
                          >
                            <div className="min-w-0">
                              <div className="text-[12px] text-white">{l.label}</div>
                              <div className="truncate text-[10px] text-gray-400">
                                {up
                                  ? `Feltöltve · ${
                                      up.mode === 'standalone' ? 'önálló oldal' : 'weboldal keretében'
                                    }`
                                  : 'Nincs feltöltve — a sablon szerint jelenik meg'}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <label
                                className={`cms-btn-secondary !px-2 !py-1 !text-[11px] ${
                                  busy ? 'pointer-events-none opacity-60' : ''
                                }`}
                              >
                                {up ? 'Csere' : 'Feltöltés'}
                                <input
                                  type="file"
                                  accept=".html,.htm,text/html"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0]
                                    e.target.value = ''
                                    pickHtml(f, (text) =>
                                      handleUploadExisting(
                                        p.id,
                                        l.code,
                                        text,
                                        up?.mode || 'shell',
                                      ),
                                    )
                                  }}
                                />
                              </label>
                              {up && (
                                <>
                                  <button
                                    type="button"
                                    className="cms-btn-ghost !px-2 !py-1 !text-[11px]"
                                    title="Váltás: weboldal keretében ↔ önálló oldal"
                                    disabled={busy}
                                    onClick={() =>
                                      handleToggleMode(
                                        p.id,
                                        l.code,
                                        up.mode === 'shell' ? 'standalone' : 'shell',
                                      )
                                    }
                                  >
                                    ⇄
                                  </button>
                                  <button
                                    type="button"
                                    className="cms-btn-ghost !px-2 !py-1 !text-[11px] text-red-300 hover:text-red-200"
                                    disabled={busy}
                                    onClick={() => handleDeleteUpload(p.id, l.code)}
                                  >
                                    Törlés
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* New page form */}
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Új oldal</p>
          <div>
            <label className="mb-1 block text-xs text-gray-300">Az oldal neve (ez lesz a menüpont is)</label>
            <input
              className="cms-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="pl. Szolgáltatásaink"
              maxLength={48}
              autoFocus
            />
            {slug && (
              <p className="mt-1.5 text-[11px] text-gray-400">
                URL: <span className="text-gray-300">/{slug}/</span>
                {clash && <span className="ml-2 text-red-300">— foglalt név</span>}
              </p>
            )}
            {!showLangLabels ? (
              <button
                type="button"
                onClick={() => setShowLangLabels(true)}
                className="mt-2 text-[11px] text-lime hover:text-lime"
              >
                + Eltérő felirat EN / IT nyelven
              </button>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  className="cms-input"
                  value={labelEn}
                  onChange={(e) => setLabelEn(e.target.value)}
                  placeholder={`EN: ${name.trim() || '…'}`}
                  maxLength={48}
                />
                <input
                  className="cms-input"
                  value={labelIt}
                  onChange={(e) => setLabelIt(e.target.value)}
                  placeholder={`IT: ${name.trim() || '…'}`}
                  maxLength={48}
                />
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-300">Miből készüljön?</label>
            <div className="mb-2 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setSource('template')}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  source === 'template'
                    ? 'border-lime-line bg-lime-soft'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="text-sm text-white">🧩 Sablonból</div>
                <div className="text-[11px] text-gray-400">Szerkeszthető blokkok</div>
              </button>
              <button
                type="button"
                onClick={() => setSource('upload')}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  source === 'upload'
                    ? 'border-lime-line bg-lime-soft'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="text-sm text-white">⬆ Kész HTML</div>
                <div className="text-[11px] text-gray-400">Kész fájl feltöltése</div>
              </button>
            </div>

            {source === 'template' ? (
              <div className="grid grid-cols-1 gap-1.5">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTemplate(t.value)}
                    className={`rounded-xl border px-3.5 py-2.5 text-left transition ${
                      template === t.value
                        ? 'border-lime-line bg-lime-soft'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-sm text-white">{t.label}</div>
                    <div className="text-[11px] text-gray-400">{t.desc}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <div>
                  <label className="mb-1 block text-[11px] text-gray-300">HTML-fájl</label>
                  <div className="flex items-center gap-2">
                    <label
                      className={`cms-btn-secondary shrink-0 !px-3 !py-1.5 !text-xs ${
                        busy ? 'pointer-events-none opacity-60' : ''
                      }`}
                    >
                      {newHtml ? 'Másik fájl…' : '⬆ Fájl kiválasztása'}
                      <input
                        type="file"
                        accept=".html,.htm,text/html"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          e.target.value = ''
                          pickHtml(f, (text, fname) => setNewHtml({ name: fname, text }))
                        }}
                      />
                    </label>
                    <span className="truncate text-[11px] text-gray-400">
                      {newHtml
                        ? `${newHtml.name} · ${Math.round(newHtml.text.length / 1024)} KB`
                        : 'Nincs fájl kiválasztva'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] text-gray-300">Melyik nyelvhez?</label>
                  <div className="flex gap-1.5">
                    {LOCALES.map((l) => (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => setNewUploadLocale(l.code)}
                        className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                          newUploadLocale === l.code
                            ? 'border-lime-line bg-lime-soft text-white'
                            : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-gray-500">
                    A többi nyelvhez később, a lista „HTML" gombjánál tölthetsz fel változatot.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] text-gray-300">Megjelenés</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {UPLOAD_MODES.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setNewUploadMode(m.value)}
                        className={`rounded-lg border px-3 py-2 text-left transition ${
                          newUploadMode === m.value
                            ? 'border-lime-line bg-lime-soft'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-[13px] text-white">{m.label}</div>
                        <div className="text-[10px] leading-snug text-gray-400">{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>
    </Modal>
  )
}
