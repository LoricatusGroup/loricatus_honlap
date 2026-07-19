import { useState } from 'react'
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
    setBusy(true)
    setError(null)
    const label = name.trim()
    const nav = {
      hu: label,
      en: labelEn.trim() || label,
      it: labelIt.trim() || label,
    }
    const { error: err } = await createPage(slug, template, nav)
    if (err) {
      setError(err.message)
      setBusy(false)
      return
    }
    // Scaffold all three locale files by publishing the new page in each.
    await Promise.all(
      ['hu', 'en', 'it'].map((lc) =>
        supabase.functions.invoke('publish-site', { body: { locale: lc, page: slug } }),
      ),
    ).catch(() => {})
    setBusy(false)
    onChanged(`„${label}" oldal létrehozva — épül (~1 perc). A szerkesztő magától megnyílik, amint kész.`)
    onCreatedPage(slug)
    onClose()
  }

  // Republish home so the nav/labels/order refresh after a rename or reorder.
  const republishHome = () =>
    supabase.functions.invoke('publish-site', { body: { page: 'home' } }).catch(() => {})

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
    // Republish home + the page so the new label shows in the nav + titles.
    await Promise.all([
      republishHome(),
      ...['hu', 'en', 'it'].map((lc) =>
        supabase.functions.invoke('publish-site', { body: { locale: lc, page: editId } }),
      ),
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
    // Publish home with removePage so the page's files are deleted and the nav +
    // sitemap refresh without it.
    await supabase.functions
      .invoke('publish-site', { body: { page: 'home', removePage: id } })
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
                className="mt-2 text-[11px] text-blue-300 hover:text-blue-200"
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
            <label className="mb-1 block text-xs text-gray-300">Sablon</label>
            <div className="grid grid-cols-1 gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTemplate(t.value)}
                  className={`rounded-xl border px-3.5 py-2.5 text-left transition ${
                    template === t.value
                      ? 'border-blue-400/60 bg-blue-500/15'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="text-sm text-white">{t.label}</div>
                  <div className="text-[11px] text-gray-400">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>
    </Modal>
  )
}
