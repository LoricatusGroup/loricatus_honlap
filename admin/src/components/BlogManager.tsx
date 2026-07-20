import { useEffect, useRef, useState } from 'react'
import Modal from './inline/Modal'
import ImageUploader from './ImageUploader'
import { slugify } from '../lib/pages'
import {
  listBlogPosts,
  upsertBlogPost,
  deleteBlogPost,
  republishBlog,
  type BlogPost,
  type BlogStatus,
} from '../lib/blog'

// Keep stored body HTML clean/on-theme (editors are trusted staff — hygiene,
// not a security boundary). Mirrors HtmlEditModal.cleanHtml.
function cleanHtml(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  tmp.querySelectorAll('*').forEach((el) => {
    el.removeAttribute('style')
    el.removeAttribute('class')
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name)
    }
    if (['SCRIPT', 'STYLE', 'IFRAME'].includes(el.tagName)) el.remove()
  })
  if (!tmp.textContent?.trim() && !tmp.querySelector('img, li')) return ''
  return tmp.innerHTML.trim()
}

const LOCALE_LABEL: Record<string, string> = { hu: 'magyar', en: 'angol', it: 'olasz' }
const toolBtn = 'cms-btn-secondary !px-2.5 !py-1 !text-sm'

type Seed = {
  id: string | null
  title: string
  slug: string
  excerpt: string
  body: string
  cover: string
  tags: string
  status: BlogStatus
  author: string
}

function seedFromPost(p: BlogPost): Seed {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    body: p.body,
    cover: p.cover_url,
    tags: (p.tags || []).join(', '),
    status: p.status,
    author: p.author,
  }
}

function emptySeed(): Seed {
  return { id: null, title: '', slug: '', excerpt: '', body: '', cover: '', tags: '', status: 'draft', author: '' }
}

function PostForm({
  locale,
  seed,
  onCancel,
  onSaved,
}: {
  locale: string
  seed: Seed
  onCancel: () => void
  onSaved: (published: boolean) => void
}) {
  const [title, setTitle] = useState(seed.title)
  const [slug, setSlug] = useState(seed.slug)
  const [slugTouched, setSlugTouched] = useState(!!seed.id) // don't auto-rename existing posts
  const [excerpt, setExcerpt] = useState(seed.excerpt)
  const [cover, setCover] = useState(seed.cover)
  const [tags, setTags] = useState(seed.tags)
  const [status, setStatus] = useState<BlogStatus>(seed.status)
  const [author, setAuthor] = useState(seed.author)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.innerHTML = seed.body || ''
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title))
  }, [title, slugTouched])

  const exec = (cmd: string, val?: string) => {
    bodyRef.current?.focus()
    document.execCommand(cmd, false, val)
  }
  const addLink = () => {
    const url = window.prompt('Link címe (URL):', 'https://')
    if (url) exec('createLink', url)
  }

  const save = async () => {
    if (!title.trim()) { setError('Adj címet a cikknek.'); return }
    if (!slug) { setError('Az URL (slug) nem lehet üres.'); return }
    setBusy(true)
    setError(null)
    const { error: err } = await upsertBlogPost({
      id: seed.id,
      locale,
      slug,
      title: title.trim(),
      excerpt: excerpt.trim(),
      body: cleanHtml(bodyRef.current?.innerHTML ?? ''),
      cover,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      status,
      author: author.trim(),
    })
    if (err) {
      setBusy(false)
      setError(err.message.includes('duplicate') ? 'Ilyen URL-ű cikk már van ezen a nyelven.' : err.message)
      return
    }
    await republishBlog()
    setBusy(false)
    onSaved(status === 'published')
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs text-gray-300">Cím</label>
        <input className="cms-input" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="A cikk címe" maxLength={140} autoFocus />
        {slug && (
          <p className="mt-1.5 text-[11px] text-gray-400">
            URL: <span className="text-gray-300">{locale === 'hu' ? '/blog/' : `/${locale}/blog/`}{slug}/</span>
            <button type="button" className="ml-2 text-blue-300 hover:text-blue-200"
              onClick={() => setSlugTouched((v) => !v)}>
              {slugTouched ? 'automatikus' : 'szerkeszt'}
            </button>
          </p>
        )}
        {slugTouched && (
          <input className="cms-input mt-1.5 !py-1.5 !text-[13px]" value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))} placeholder="url-resz" maxLength={80} />
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-300">Borítókép</label>
        <ImageUploader value={cover} onChange={setCover} />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-300">Rövid összefoglaló (a listában látszik)</label>
        <textarea className="cms-input min-h-[64px]" value={excerpt} onChange={(e) => setExcerpt(e.target.value)}
          placeholder="Egy-két mondat a cikkről" maxLength={280} />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-300">Tartalom</label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          <button type="button" className={`${toolBtn} font-bold`}
            onMouseDown={(e) => { e.preventDefault(); exec('bold') }}>B</button>
          <button type="button" className={`${toolBtn} italic`}
            onMouseDown={(e) => { e.preventDefault(); exec('italic') }}>I</button>
          <button type="button" className={toolBtn}
            onMouseDown={(e) => { e.preventDefault(); exec('formatBlock', 'H2') }}>Cím</button>
          <button type="button" className={toolBtn}
            onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList') }}>• Lista</button>
          <button type="button" className={toolBtn}
            onMouseDown={(e) => { e.preventDefault(); addLink() }}>🔗 Link</button>
          <button type="button" className={toolBtn}
            onMouseDown={(e) => { e.preventDefault(); exec('removeFormat'); exec('unlink') }}>⌫ Formázás</button>
        </div>
        <div ref={bodyRef} contentEditable suppressContentEditableWarning
          className="cms-input min-h-[220px] max-h-[45vh] overflow-y-auto leading-relaxed [&_a]:text-blue-300 [&_a]:underline [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-300">Címkék (vesszővel)</label>
          <input className="cms-input" value={tags} onChange={(e) => setTags(e.target.value)}
            placeholder="drón, hír, esettanulmány" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-300">Szerző (opcionális)</label>
          <input className="cms-input" value={author} onChange={(e) => setAuthor(e.target.value)}
            placeholder="Név" maxLength={80} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-300">Állapot</label>
        <div className="cms-segment inline-flex">
          <button type="button" className={`cms-seg-btn${status === 'draft' ? ' is-active' : ''}`}
            onClick={() => setStatus('draft')}>Piszkozat</button>
          <button type="button" className={`cms-seg-btn${status === 'published' ? ' is-active' : ''}`}
            onClick={() => setStatus('published')}>Publikált</button>
        </div>
        <p className="mt-1 text-[11px] text-gray-400">
          {status === 'published'
            ? 'Mentés után ~1 perccel megjelenik az élő /blog/ oldalon.'
            : 'A piszkozat csak itt látszik, a látogatók nem.'}
        </p>
      </div>

      {error && <p className="text-xs text-red-300">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="cms-btn-ghost" onClick={onCancel} disabled={busy}>Mégse</button>
        <button type="button" className="cms-btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Mentés…' : status === 'published' ? '📢 Mentés és publikálás' : '💾 Piszkozat mentése'}
        </button>
      </div>
    </div>
  )
}

interface Props {
  locale: string
  onClose: () => void
  onChanged?: (info?: string) => void
}

export default function BlogManager({ locale, onClose, onChanged }: Props) {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seed, setSeed] = useState<Seed | null>(null) // null = list; else the form
  const [formKey, setFormKey] = useState(0)

  const load = async () => {
    setLoading(true)
    const { data, error: err } = await listBlogPosts(locale)
    if (err) setError(err.message)
    else setPosts((data as BlogPost[]) || [])
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [locale]) // eslint-disable-line react-hooks/exhaustive-deps

  const openNew = () => { setSeed(emptySeed()); setFormKey((k) => k + 1) }
  const openEdit = (p: BlogPost) => { setSeed(seedFromPost(p)); setFormKey((k) => k + 1) }

  const handleDelete = async (p: BlogPost) => {
    if (!window.confirm(`Biztosan törlöd a(z) „${p.title || p.slug}" cikket?`)) return
    const { error: err } = await deleteBlogPost(p.id)
    if (err) { setError(err.message); return }
    await republishBlog()
    onChanged?.('Cikk törölve — a blog ~1 perc múlva frissül.')
    load()
  }

  const onSaved = (published: boolean) => {
    setSeed(null)
    onChanged?.(published ? 'Cikk publikálva — ~1 perc múlva él a /blog/ oldalon.' : 'Piszkozat mentve.')
    load()
  }

  return (
    <Modal
      label="📰 Blog / Cikkek"
      caption={`Cikkek kezelése (${LOCALE_LABEL[locale] || locale} nyelven). Válts nyelvet a felső sávban a többi nyelvhez.`}
      maxWidth="max-w-2xl"
      onClose={onClose}
      footer={
        seed ? undefined : (
          <>
            <button type="button" className="cms-btn-ghost" onClick={onClose}>Bezárás</button>
            <button type="button" className="cms-btn-primary" onClick={openNew}>➕ Új cikk</button>
          </>
        )
      }
    >
      {seed ? (
        <PostForm key={formKey} locale={locale} seed={seed} onCancel={() => setSeed(null)} onSaved={onSaved} />
      ) : (
        <div className="space-y-2">
          {loading && <p className="text-sm text-gray-400">Betöltés…</p>}
          {!loading && posts.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">
              Még nincs cikk ezen a nyelven. Kattints az „➕ Új cikk" gombra.
            </p>
          )}
          {posts.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm text-white">{p.title || '(cím nélkül)'}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${p.status === 'published' ? 'bg-green-500/20 text-green-200' : 'bg-white/10 text-gray-300'}`}>
                    {p.status === 'published' ? 'Publikált' : 'Piszkozat'}
                  </span>
                </div>
                <div className="truncate text-[11px] text-gray-400">
                  {locale === 'hu' ? '/blog/' : `/${locale}/blog/`}{p.slug}/
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" className="cms-btn-ghost !px-2.5 !text-xs" onClick={() => openEdit(p)}>Szerkeszt</button>
                <button type="button" className="cms-btn-ghost !px-2.5 !text-xs text-red-300 hover:text-red-200" onClick={() => handleDelete(p)}>Törlés</button>
              </div>
            </div>
          ))}
          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>
      )}
    </Modal>
  )
}
