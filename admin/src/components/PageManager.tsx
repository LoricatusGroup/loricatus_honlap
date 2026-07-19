import { useState } from 'react'
import Modal from './inline/Modal'
import { supabase } from '../lib/supabase'
import {
  createPage,
  deletePage,
  slugify,
  pageNavLabel,
  type PagesManifest,
} from '../lib/pages'

interface Props {
  manifest: PagesManifest
  locale: string
  onClose: () => void
  onChanged: (info?: string) => void // refresh manifest; optional status text
}

const TEMPLATES = [
  { value: 'text', label: 'Szöveges oldal', desc: 'Cím + bevezető + szövegblokkok' },
  { value: 'cards', label: 'Kártyás oldal', desc: 'Cím + kártyalista (mint a Referenciák)' },
]

// The "Oldalak" panel: create / delete editor-made pages. Creating a page also
// publishes it so its HTML is scaffolded live; the owner then edits it via the
// page switcher (once the ~1 min publish finishes).
export default function PageManager({ manifest, locale, onClose, onChanged }: Props) {
  const dynamic = manifest.pages.filter((p) => p._dynamic)
  const [name, setName] = useState('')
  const [template, setTemplate] = useState('text')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    const nav = { hu: label, en: label, it: label }
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
    onChanged(`„${label}" oldal létrehozva — ~1 perc múlva jelenik meg. Utána válaszd ki fent az oldal-váltóból és szerkeszd.`)
    onClose()
  }

  const handleDelete = async (id: string, label: string) => {
    if (!window.confirm(`Biztosan törlöd a(z) „${label}" oldalt? A tartalma is elvész.`)) return
    setBusy(true)
    setError(null)
    const { error: err } = await deletePage(id)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    onChanged(`„${label}" oldal törölve. A menüből ~1 perc múlva tűnik el (a főoldal újrapublikálásával).`)
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
              {dynamic.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-white">{pageNavLabel(p, locale)}</div>
                    <div className="truncate text-[11px] text-gray-400">
                      {p.locales[locale]?.url || `/${p.id}/`}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="cms-btn-ghost shrink-0 text-red-300 hover:text-red-200"
                    onClick={() => handleDelete(p.id, pageNavLabel(p, locale))}
                    disabled={busy}
                  >
                    Törlés
                  </button>
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
