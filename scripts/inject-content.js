// Fetch CMS content from Supabase and inject it into index.html.
// Run by .github/workflows/publish.yml on repository_dispatch.
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY

const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const LOCALE = process.env.LOCALE || 'hu'
// Which page to publish. Defaults to 'home' so a payload without `page` behaves
// exactly like the original single-page (index) pipeline.
const PAGE = process.env.PAGE || 'home'

// The site's page manifest (pages.json) is the source of truth for which pages
// exist, their per-locale file/slug/url, and the canonical/hreflang/sitemap data.
function loadManifest() {
  const p = path.join(__dirname, '..', 'pages.json')
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

// Resolve (pageId, locale) -> { page, pageSlug, filePath, url } from the manifest.
function resolveTarget(manifest, pageId, locale) {
  const page = (manifest.pages || []).find((p) => p.id === pageId)
  if (!page) return null
  const loc = page.locales && page.locales[locale]
  if (!loc) return null
  return { page, pageSlug: loc.slug, filePath: loc.file, url: loc.url }
}

let manifest = null
let config = null
try {
  manifest = loadManifest()
  config = resolveTarget(manifest, PAGE, LOCALE)
} catch (err) {
  // Deferred to main() so `require()` (tests) never crashes on a missing file.
  manifest = null
}

async function fetchPageContent(pageSlug) {
  // Use select=* so this still works before the `layout` column migration runs.
  const url = `${SUPABASE_URL}/rest/v1/page_content?page_slug=eq.${encodeURIComponent(
    pageSlug,
  )}&select=*`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  })
  if (!res.ok) {
    throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`)
  }
  const rows = await res.json()
  if (!rows.length) {
    // No row for this page/locale yet — nothing to inject, but not an error.
    console.log(`No row for page_slug=${pageSlug} — nothing to inject`)
    return { content: {}, theme: {}, layout: {} }
  }
  return rows[0]
}

// Escape characters that could break an [attr="value"] selector.
// CMS keys are constrained to [a-z0-9-], but be defensive anyway.
function escapeAttr(s) {
  return String(s).replace(/["\\]/g, '\\$&')
}

// Normalise a YouTube/Vimeo URL into an embeddable player URL (mirror of
// admin/src/lib/video.ts toEmbedUrl). Returns '' for anything unrecognised, so
// only trusted providers reach an <iframe src>.
function toEmbedUrl(url) {
  const u = (url || '').trim()
  if (!u) return ''
  if (/(?:youtube(?:-nocookie)?\.com\/embed\/|player\.vimeo\.com\/video\/)/i.test(u)) return u
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i)
  if (m) return `https://www.youtube.com/embed/${m[1]}`
  m = u.match(/vimeo\.com\/(?:video\/)?(\d{6,})/i)
  if (m) return `https://player.vimeo.com/video/${m[1]}`
  return ''
}

// Direct video file (uploaded .mp4/.webm/…) → renders in a <video>, not an
// <iframe>. Mirror of admin/src/lib/video.ts isVideoFile.
function isVideoFile(url) {
  const u = (url || '').trim().split(/[?#]/)[0].toLowerCase()
  return /\.(mp4|webm|ogv|ogg|mov|m4v)$/.test(u)
}

// Render a video value into a [data-edit-video] wrapper: embeds populate the
// <iframe>; uploaded files render in a <video> (created if the wrapper predates
// file support). Mirror of admin/src/lib/video.ts applyVideoTo.
function applyVideoEl(el, value) {
  const doc = el.ownerDocument
  const embed = toEmbedUrl(value)
  const iframe = el.querySelector('iframe')
  let video = el.querySelector('video')
  if (iframe) iframe.setAttribute('src', embed || '')
  if (!embed && isVideoFile(value)) {
    if (!video) {
      video = doc.createElement('video')
      video.setAttribute('controls', '')
      video.setAttribute('playsinline', '')
      video.setAttribute('preload', 'metadata')
      video.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;border:0;background:#000;object-fit:contain')
      el.appendChild(video)
    }
    video.setAttribute('src', value)
    video.style.display = ''
  } else if (video) {
    video.removeAttribute('src')
    video.style.display = 'none'
  }
}

function applyContent(doc, content) {
  let applied = 0
  const missing = []

  for (const [key, value] of Object.entries(content)) {
    const candidates = [
      ['data-edit', (el) => (el.textContent = value)],
      ['data-edit-html', (el) => (el.innerHTML = value)],
      ['data-edit-src', (el) => el.setAttribute('src', value)],
      ['data-edit-href', (el) => el.setAttribute('href', value)],
      ['data-edit-color', (el) => el.setAttribute('style', value)],
      // data-target only — keep textContent at "0" so the count-up animation
      // starts from 0 on every page load.
      ['data-edit-target', (el) => el.setAttribute('data-target', value)],
      ['data-edit-content', (el) => el.setAttribute('content', value)],
      ['data-edit-placeholder', (el) => el.setAttribute('placeholder', value)],
      // data-edit-video lives on the wrapper; embeds go to the <iframe>,
      // uploaded files to a <video> (created if missing).
      ['data-edit-video', (el) => applyVideoEl(el, value)],
    ]

    let hit = false
    for (const [attr, set] of candidates) {
      const el = doc.querySelector(`[${attr}="${escapeAttr(key)}"]`)
      if (el) {
        set(el)
        applied++
        hit = true
        break
      }
    }
    if (!hit) missing.push(key)
  }

  return { applied, missing }
}

// Reorder matching children in-place WITHOUT disturbing non-matching siblings.
// Inserts each target before the next sibling of the original LAST match, so
// e.g. <nav> stays first and <footer> stays last.
function reorderChildren(parent, idAttr, order) {
  if (!parent || !Array.isArray(order) || !order.length) return
  const byId = new Map()
  let referenceNode = null
  for (const child of Array.from(parent.children)) {
    const id = child.getAttribute(idAttr)
    if (id) {
      byId.set(id, child)
      referenceNode = child.nextElementSibling
    }
  }
  const placed = new Set()
  for (const id of order) {
    const el = byId.get(id)
    if (el) {
      parent.insertBefore(el, referenceNode)
      placed.add(id)
    }
  }
  for (const [id, el] of byId) {
    if (!placed.has(id)) parent.insertBefore(el, referenceNode)
  }
}

const EDIT_ATTRS_LIST = [
  'data-edit',
  'data-edit-html',
  'data-edit-src',
  'data-edit-href',
  'data-edit-color',
  'data-edit-target',
  'data-edit-content',
  'data-edit-video',
  'data-edit-placeholder',
]

function cloneListItem(templateEl, templateId, newId) {
  const clone = templateEl.cloneNode(true)
  clone.setAttribute('data-list-item', newId)
  const prefix = templateId + '-'
  const rewrite = (el) => {
    for (const attr of EDIT_ATTRS_LIST) {
      const v = el.getAttribute(attr)
      if (v && v.startsWith(prefix)) {
        el.setAttribute(attr, newId + '-' + v.substring(prefix.length))
      }
    }
  }
  rewrite(clone)
  clone.querySelectorAll('*').forEach(rewrite)
  return clone
}

function materializeAddedItems(doc, layout) {
  let cloned = 0
  for (const [listName, order] of Object.entries(layout.list_order ?? {})) {
    if (!Array.isArray(order)) continue
    const listEl = doc.querySelector(`[data-list="${escapeAttr(listName)}"]`)
    if (!listEl) continue
    const existing = Array.from(listEl.querySelectorAll('[data-list-item]'))
    if (!existing.length) continue
    const templateEl = existing[0]
    const templateId = templateEl.getAttribute('data-list-item')
    const existingIds = new Set(existing.map((el) => el.getAttribute('data-list-item')))
    for (const id of order) {
      if (existingIds.has(id)) continue
      listEl.appendChild(cloneListItem(templateEl, templateId, id))
      cloned++
    }
  }
  return cloned
}

function removeStrayItems(doc, layout) {
  let removed = 0
  for (const [listName, order] of Object.entries(layout.list_order ?? {})) {
    if (!Array.isArray(order) || !order.length) continue
    const orderSet = new Set(order)
    const listEl = doc.querySelector(`[data-list="${escapeAttr(listName)}"]`)
    if (!listEl) continue
    listEl.querySelectorAll('[data-list-item]').forEach((el) => {
      const id = el.getAttribute('data-list-item')
      if (id && !orderSet.has(id)) {
        el.remove()
        removed++
      }
    })
  }
  return removed
}

// Instance ids of catalog sections inserted via the editor all start with this,
// so removeStraySections can tell them apart from the original HTML sections.
const ADDED_SECTION_PREFIX = 'asec-'

// Load a catalog partial (sections/<template>.html), import its [data-section]
// root into `doc`, and rewrite data-section + every data-edit* / data-list-item
// key from the template prefix to the instance id.
function buildAddedSection(doc, template, id) {
  const partialPath = path.join(__dirname, '..', 'sections', `${template}.html`)
  let partialHtml
  try {
    partialHtml = fs.readFileSync(partialPath, 'utf-8')
  } catch {
    console.warn(`  ! section template not found: sections/${template}.html`)
    return null
  }
  const src = JSDOM.fragment(partialHtml).querySelector('[data-section]')
  if (!src) {
    console.warn(`  ! partial ${template} has no [data-section] root`)
    return null
  }
  const templateName = src.getAttribute('data-section')
  const el = doc.importNode(src, true)
  el.setAttribute('data-section', id)
  const prefix = templateName + '-'
  const rewrite = (node) => {
    if (!node.getAttribute) return
    for (const attr of EDIT_ATTRS_LIST) {
      const v = node.getAttribute(attr)
      if (v && v.startsWith(prefix)) node.setAttribute(attr, id + '-' + v.substring(prefix.length))
    }
    const li = node.getAttribute('data-list-item')
    if (li && li.startsWith(prefix)) node.setAttribute('data-list-item', id + '-' + li.substring(prefix.length))
    const dl = node.getAttribute('data-list')
    if (dl && dl.startsWith(prefix)) node.setAttribute('data-list', id + '-' + dl.substring(prefix.length))
  }
  rewrite(el)
  el.querySelectorAll('*').forEach(rewrite)
  return el
}

// Insert catalog sections listed in layout.added_sections (idempotent). New
// sections go just before <footer> so they land in the content flow;
// section_order (if set) then reorders them into their exact place.
function materializeAddedSections(doc, layout) {
  const added = Array.isArray(layout.added_sections) ? layout.added_sections : []
  let count = 0
  const footer = doc.querySelector('footer')
  for (const entry of added) {
    if (!entry || !entry.id || !entry.template) continue
    if (doc.querySelector(`[data-section="${escapeAttr(entry.id)}"]`)) continue
    const el = buildAddedSection(doc, entry.template, entry.id)
    if (!el) continue
    if (footer) doc.body.insertBefore(el, footer)
    else doc.body.appendChild(el)
    count++
  }
  return count
}

// Remove baked added-sections (asec-*) that are no longer in added_sections
// (i.e. the editor removed them).
function removeStraySections(doc, layout) {
  const keep = new Set(
    (Array.isArray(layout.added_sections) ? layout.added_sections : [])
      .map((e) => e && e.id)
      .filter(Boolean),
  )
  let removed = 0
  doc.querySelectorAll('[data-section]').forEach((el) => {
    const id = el.getAttribute('data-section')
    if (id && id.startsWith(ADDED_SECTION_PREFIX) && !keep.has(id)) {
      el.remove()
      removed++
    }
  })
  return removed
}

function applyLayout(doc, layout) {
  if (!layout || typeof layout !== 'object') return
  const stats = { sectionsReordered: 0, listsReordered: 0, hidden: 0, cloned: 0, removed: 0 }

  // 0. Materialize added items + remove deleted ones
  stats.cloned = materializeAddedItems(doc, layout)
  stats.removed = removeStrayItems(doc, layout)

  // 1. Section order: reorder children of <body>, matching by data-section
  if (Array.isArray(layout.section_order) && layout.section_order.length) {
    reorderChildren(doc.body, 'data-section', layout.section_order)
    stats.sectionsReordered = layout.section_order.length
  }

  // 2. List item order: per list (services, portfolio, ...) reorder cards
  if (layout.list_order && typeof layout.list_order === 'object') {
    for (const [listName, order] of Object.entries(layout.list_order)) {
      if (!Array.isArray(order)) continue
      const listEl = doc.querySelector(`[data-list="${escapeAttr(listName)}"]`)
      if (!listEl) continue
      reorderChildren(listEl, 'data-list-item', order)
      stats.listsReordered++
    }
  }

  // 3. Section visibility: hide via inline style
  if (layout.section_hidden && typeof layout.section_hidden === 'object') {
    for (const [sectionName, hidden] of Object.entries(layout.section_hidden)) {
      const el = doc.querySelector(`[data-section="${escapeAttr(sectionName)}"]`)
      if (!el) continue
      if (hidden) {
        el.setAttribute('hidden', '')
        stats.hidden++
      } else {
        el.removeAttribute('hidden')
      }
    }
  }

  // 4. Item visibility
  if (layout.item_hidden && typeof layout.item_hidden === 'object') {
    for (const [itemId, hidden] of Object.entries(layout.item_hidden)) {
      const el = doc.querySelector(`[data-list-item="${escapeAttr(itemId)}"]`)
      if (!el) continue
      if (hidden) {
        el.setAttribute('hidden', '')
        stats.hidden++
      } else {
        el.removeAttribute('hidden')
      }
    }
  }

  // 5. Free-form positions — inject a <style> with desktop-only @media rule
  stats.positions = applyPositionsCss(doc, layout.positions || {})

  console.log(
    `Applied layout: ${stats.cloned} added, ${stats.removed} removed, ` +
      `${stats.sectionsReordered} section(s) reordered, ` +
      `${stats.listsReordered} list(s) reordered, ${stats.hidden} element(s) hidden, ` +
      `${stats.positions} position(s) set`,
  )
}

function selectorForPositionId(id) {
  const colonIdx = id.indexOf(':')
  if (colonIdx < 0) return null
  const kind = id.substring(0, colonIdx)
  const value = id.substring(colonIdx + 1)
  // CSS attribute selectors don't need quote-escaping for our [a-z0-9-] keys,
  // but use them defensively in case of future special chars.
  const esc = value.replace(/["\\]/g, '\\$&')
  if (kind === 'section') return `[data-section="${esc}"]`
  if (kind === 'item') return `[data-list-item="${esc}"]`
  if (kind === 'edit') {
    // First match wins — try every data-edit* variant.
    return [
      `[data-edit="${esc}"]`,
      `[data-edit-html="${esc}"]`,
      `[data-edit-src="${esc}"]`,
      `[data-edit-href="${esc}"]`,
      `[data-edit-color="${esc}"]`,
      `[data-edit-target="${esc}"]`,
      `[data-edit-content="${esc}"]`,
      `[data-edit-video="${esc}"]`,
      `[data-edit-placeholder="${esc}"]`,
    ].join(',')
  }
  return null
}

function applyPositionsCss(doc, positions) {
  // Remove any previous cms-positions block (so deleted entries actually disappear)
  const existing = doc.getElementById('cms-positions')
  if (existing) existing.remove()

  const entries = Object.entries(positions).filter(
    ([, p]) => p && (p.x !== 0 || p.y !== 0),
  )
  if (!entries.length) return 0

  const rules = entries
    .map(([id, p]) => {
      const sel = selectorForPositionId(id)
      if (!sel) return null
      return `  ${sel} { transform: translate(${p.x}px, ${p.y}px); }`
    })
    .filter(Boolean)
    .join('\n')

  if (!rules) return 0

  const style = doc.createElement('style')
  style.id = 'cms-positions'
  style.textContent = `@media (min-width: 1024px) {\n${rules}\n}`
  doc.head.appendChild(style)
  return entries.length
}

function applyTheme(doc, theme) {
  const keys = Object.keys(theme)
  if (!keys.length) return false

  const rules = keys.map((k) => `  --${k}: ${theme[k]};`).join('\n')
  const css = `:root {\n${rules}\n}`

  let styleEl = doc.querySelector('style#cms-theme')
  if (!styleEl) {
    styleEl = doc.createElement('style')
    styleEl.id = 'cms-theme'
    // Insert at end of head so it overrides earlier stylesheet
    doc.head.appendChild(styleEl)
  }
  styleEl.textContent = css
  return true
}

// Rewrite <link rel="canonical"> and the hreflang alternates for this page from
// the manifest, so every page (incl. newly added ones) gets a consistent, correct
// language cluster. A single wrong hreflang can void the whole cluster, so this is
// generated, never hand-maintained.
function applySeo(doc, manifest, page, locale) {
  if (!manifest || !page || !page.locales) return false
  const base = String(manifest.baseUrl || '').replace(/\/$/, '')
  const thisLoc = page.locales[locale]
  if (!base || !thisLoc) return false
  const head = doc.head
  if (!head) return false

  // Canonical
  let canonical = head.querySelector('link[rel="canonical"]')
  if (!canonical) {
    canonical = doc.createElement('link')
    canonical.setAttribute('rel', 'canonical')
    head.appendChild(canonical)
  }
  canonical.setAttribute('href', base + thisLoc.url)

  // hreflang alternates — clear existing, regenerate from the manifest
  head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove())
  const locales = Array.isArray(manifest.locales) ? manifest.locales : Object.keys(page.locales)
  for (const lc of locales) {
    const loc = page.locales[lc]
    if (!loc) continue
    const link = doc.createElement('link')
    link.setAttribute('rel', 'alternate')
    link.setAttribute('hreflang', lc)
    link.setAttribute('href', base + loc.url)
    head.appendChild(link)
  }
  const dl = manifest.defaultLocale || 'hu'
  const dloc = page.locales[dl]
  if (dloc) {
    const link = doc.createElement('link')
    link.setAttribute('rel', 'alternate')
    link.setAttribute('hreflang', 'x-default')
    link.setAttribute('href', base + dloc.url)
    head.appendChild(link)
  }
  return true
}

// Build a sitemap.xml string from the manifest (all page x locale urls + any
// extraUrls). Pure — the caller writes it to disk.
function buildSitemapXml(manifest, extraUrls = []) {
  const base = String((manifest && manifest.baseUrl) || '').replace(/\/$/, '')
  if (!base) return null
  const urls = []
  for (const page of (manifest.pages || [])) {
    for (const lc of Object.keys(page.locales || {})) {
      const loc = page.locales[lc]
      if (loc && loc.url) urls.push(base + loc.url)
    }
  }
  for (const extra of (manifest.extraUrls || [])) {
    if (extra) urls.push(base + extra)
  }
  for (const extra of (extraUrls || [])) {
    if (extra) urls.push(extra)
  }
  const body = urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

function writeSitemap(manifest, extraUrls = []) {
  const xml = buildSitemapXml(manifest, extraUrls)
  if (!xml) return 0
  fs.writeFileSync(path.join(__dirname, '..', 'sitemap.xml'), xml)
  const count = (xml.match(/<loc>/g) || []).length
  console.log(`Wrote sitemap.xml (${count} url(s))`)
  return count
}

// ── Editor-created pages (M2) ───────────────────────────────────────────────

function navLabel(page, locale) {
  return (page.nav && (page.nav[locale] || page.nav.hu)) || page.id
}

function escapeHtmlText(s) {
  return String(s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ))
}

// Compute the per-locale slug/file/url for a dynamic page id, mirroring the
// base-page convention (id, id-en, id-it → /, /en/, /it/).
function dynamicLocales(pageId) {
  return {
    hu: { slug: pageId, file: `${pageId}/index.html`, url: `/${pageId}/` },
    en: { slug: `${pageId}-en`, file: `en/${pageId}/index.html`, url: `/en/${pageId}/` },
    it: { slug: `${pageId}-it`, file: `it/${pageId}/index.html`, url: `/it/${pageId}/` },
  }
}

function dynamicToPageEntry(row) {
  return {
    id: row.page_id,
    nav: row.nav || {},
    inNav: row.in_nav !== false,
    order: typeof row.sort_order === 'number' ? row.sort_order : 100,
    template: row.template || 'text',
    locales: dynamicLocales(row.page_id),
    _dynamic: true,
  }
}

// Fetch the site's editor-created pages. Defensive: any failure (table missing,
// network) yields an empty list so the base pipeline is unaffected.
async function loadDynamicPages() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return []
  try {
    let url = `${SUPABASE_URL}/rest/v1/site_pages?select=page_id,template,nav,in_nav,sort_order`
    const siteId = process.env.SITE_ID
    if (siteId) url += `&site_id=eq.${encodeURIComponent(siteId)}`
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    })
    if (!res.ok) return []
    const rows = await res.json()
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

// Reserved ids whose directories must never be deleted by a page removal.
const RESERVED_PAGE_IDS = new Set([
  'home', 'index', 'en', 'it', 'admin', 'admin-app', 'assets', 'sections',
  'scripts', 'supabase', 'page-templates', 'tudastar', 'adatvedelem',
  'cookie-szabalyzat', 'referenciak', 'epiteskovetes-hu-mentes', 'node_modules',
])

// Delete a deleted page's HTML files (all three locales). Guarded by the same
// slug shape + reserved-id list as create_page, so it can only ever touch a
// dynamic-page directory.
function removeDynamicPageFiles(pageId) {
  if (!/^[a-z0-9][a-z0-9-]{0,48}$/.test(pageId) || RESERVED_PAGE_IDS.has(pageId)) {
    console.warn(`Refusing to remove reserved/invalid page id: ${pageId}`)
    return 0
  }
  let removed = 0
  for (const rel of [pageId, path.join('en', pageId), path.join('it', pageId)]) {
    const full = path.join(__dirname, '..', rel)
    try {
      if (fs.existsSync(full)) {
        fs.rmSync(full, { recursive: true, force: true })
        removed++
        console.log(`Removed page directory: ${rel}`)
      }
    } catch (e) {
      console.warn(`Could not remove ${rel}: ${e}`)
    }
  }
  return removed
}

// Base manifest (pages.json) + dynamic pages (site_pages) as one page list.
function mergeManifest(manifest, dynamicRows) {
  const dyn = (dynamicRows || []).map(dynamicToPageEntry)
  return { ...manifest, pages: (manifest.pages || []).concat(dyn) }
}

// Create a page's HTML file from the base shell + body template. Nav/lang are
// filled by syncNav/syncLangSwitcher; content is baked by applyContent.
// ── Uploaded full-HTML pages (M7) ───────────────────────────────────────────
// An editor can hand a page a ready-made HTML document instead of building it
// from CMS blocks. One upload per (page, locale); `mode` decides the rendering.

async function loadPageUploads() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return []
  try {
    let url = `${SUPABASE_URL}/rest/v1/page_uploads?select=page_id,locale,html,mode`
    const siteId = process.env.SITE_ID
    if (siteId) url += `&site_id=eq.${encodeURIComponent(siteId)}`
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    })
    if (!res.ok) {
      console.warn(`page_uploads fetch failed: ${res.status}`)
      return []
    }
    const rows = await res.json()
    return Array.isArray(rows) ? rows : []
  } catch (e) {
    console.warn(`page_uploads fetch error: ${e.message}`)
    return []
  }
}

function findUpload(uploads, pageId, locale) {
  return (uploads || []).find((u) => u.page_id === pageId && u.locale === locale) || null
}

// Render an uploaded document into the file we publish.
//   'standalone' → served exactly as uploaded (its own design, no site chrome);
//                  canonical/hreflang still get injected later by applySeo.
//   'shell'      → its <body> (plus the <style>/<link> it brought) is lifted
//                  into the site shell, so the page keeps the nav + footer.
// All replacements use function form: uploaded HTML may contain `$&`/`$1`,
// which string-form String.replace would interpret as capture references.
function renderUploadedPage(upload, page, locale, manifest) {
  const uploaded = String((upload && upload.html) || '')
  if (((upload && upload.mode) || 'shell') === 'standalone') return uploaded

  const src = new JSDOM(uploaded).window.document
  const label = navLabel(page, locale)
  const titleEl = src.querySelector('title')
  const title = ((titleEl && titleEl.textContent) || '').trim() || label
  const descEl = src.querySelector('meta[name="description"]')
  const desc = ((descEl && descEl.getAttribute('content')) || '').trim() || label

  // Carry over the styling the uploaded page depends on.
  const headBits = []
  src.querySelectorAll('head style').forEach((el) => headBits.push(el.outerHTML))
  src
    .querySelectorAll('head link[rel="stylesheet"], head link[rel="preconnect"], head link[rel="dns-prefetch"]')
    .forEach((el) => headBits.push(el.outerHTML))

  // Body keeps everything it had, including inline <style>/<script>.
  const body = src.body ? src.body.innerHTML : uploaded

  const base = fs.readFileSync(
    path.join(__dirname, '..', 'page-templates', '_base.html'),
    'utf-8',
  )
  const home = (manifest.pages || []).find((p) => p.id === 'home')
  const homeUrl = (home && home.locales[locale] && home.locales[locale].url) || '/'
  const cta =
    { hu: 'Ajánlatkérés', en: 'Get a quote', it: 'Richiedi preventivo' }[locale] || 'Ajánlatkérés'

  let html = base
    .replace(/__LANG__/g, () => locale)
    .replace(/__TITLE__/g, () => escapeHtmlText(title))
    .replace(/__DESC__/g, () => escapeHtmlText(desc))
    .replace(/__HOME__/g, () => homeUrl)
    .replace(/__CTA__/g, () => escapeHtmlText(cta))
    .replace('__BODY__', () => `<main class="uploaded-page">\n${body}\n</main>`)
  if (headBits.length) {
    html = html.replace('</head>', () => `${headBits.join('\n')}\n</head>`)
  }
  return html
}

// Write the page file for an uploaded page. Runs on every publish so a
// re-upload takes effect (unlike scaffolding, which only fills a missing file).
function writeUploadedPage(htmlPath, upload, page, locale, manifest) {
  const html = renderUploadedPage(upload, page, locale, manifest)
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true })
  fs.writeFileSync(htmlPath, html)
  console.log(`Rendered uploaded page (${upload.mode || 'shell'}): ${htmlPath}`)
}

function scaffoldPageFile(htmlPath, page, locale, manifest) {
  const baseHtml = fs.readFileSync(
    path.join(__dirname, '..', 'page-templates', '_base.html'),
    'utf-8',
  )
  const template = page.template || 'text'
  let body
  try {
    body = fs.readFileSync(path.join(__dirname, '..', 'page-templates', `${template}.html`), 'utf-8')
  } catch {
    body = fs.readFileSync(path.join(__dirname, '..', 'page-templates', 'text.html'), 'utf-8')
  }
  const home = (manifest.pages || []).find((p) => p.id === 'home')
  const homeUrl = (home && home.locales[locale] && home.locales[locale].url) || '/'
  const label = navLabel(page, locale)
  const cta = { hu: 'Ajánlatkérés', en: 'Get a quote', it: 'Richiedi preventivo' }[locale] || 'Ajánlatkérés'
  const html = baseHtml
    .replace(/__LANG__/g, locale)
    .replace(/__TITLE__/g, `${escapeHtmlText(label)} – Loricatus`)
    .replace(/__DESC__/g, escapeHtmlText(label))
    .replace(/__HOME__/g, homeUrl)
    .replace(/__CTA__/g, escapeHtmlText(cta))
    .replace('__BODY__', body)
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true })
  fs.writeFileSync(htmlPath, html)
  console.log(`Scaffolded new page file: ${htmlPath}`)
}

// Keep navigation in sync with the page list. On scaffolded pages (ul[data-navauto])
// it builds the full page-level menu; on hand-authored pages it only injects the
// dynamic-page links (li[data-navpage]) — a strict no-op when none exist.
function syncNav(doc, manifest, currentUrl, locale) {
  const home = (manifest.pages || []).find((p) => p.id === 'home')
  const homeLink = home && home.locales[locale]
    ? { id: 'home', url: home.locales[locale].url, label: navLabel(home, locale) }
    : null
  const inNav = (manifest.pages || [])
    .filter((p) => p.inNav && p.locales && p.locales[locale])
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
    .map((p) => ({ id: p.id, url: p.locales[locale].url, label: navLabel(p, locale), dynamic: !!p._dynamic }))

  const mkLi = (link) => {
    const li = doc.createElement('li')
    li.setAttribute('data-navpage', link.id)
    const a = doc.createElement('a')
    a.setAttribute('href', link.url)
    a.textContent = link.label
    if (link.url === currentUrl) {
      a.setAttribute('class', 'active')
      a.setAttribute('aria-current', 'page')
    }
    li.appendChild(a)
    return li
  }

  const ctaLabel = { hu: 'Ajánlatkérés', en: 'Get a quote', it: 'Richiedi preventivo' }[locale] || 'Ajánlatkérés'
  const homeUrl = homeLink ? homeLink.url : '/'

  doc.querySelectorAll('ul.nav-links').forEach((ul) => {
    if (ul.hasAttribute('data-navauto')) {
      // Auto-nav page (scaffolded or referenciak): build the whole page-level menu.
      ul.innerHTML = ''
      const links = homeLink ? [homeLink, ...inNav] : inNav
      links.forEach((l) => ul.appendChild(mkLi(l)))
      // Keep the CTA as the last item (shown in the mobile menu).
      const cli = doc.createElement('li')
      cli.setAttribute('data-navpage', 'cta')
      const ca = doc.createElement('a')
      ca.setAttribute('href', homeUrl + '#contact')
      ca.setAttribute('class', 'nav-cta-link')
      ca.textContent = ctaLabel
      cli.appendChild(ca)
      ul.appendChild(cli)
    } else {
      // Hand-authored nav: refresh only the dynamic-page links.
      ul.querySelectorAll('li[data-navpage]').forEach((el) => el.remove())
      const dynamic = inNav.filter((l) => l.dynamic)
      if (!dynamic.length) return
      const cta = ul.querySelector('.nav-cta-link')
      const anchor = cta ? cta.closest('li') : null
      dynamic.forEach((l) => {
        const li = mkLi(l)
        if (anchor) ul.insertBefore(li, anchor)
        else ul.appendChild(li)
      })
    }
  })
}

// A horizontal nav can't grow unbounded. When it carries more than 5 visible
// items (e.g. after pages are added), mark the navbar `nav-wide` so CSS drops
// the container width cap (full-width nav) — it still collapses to the hamburger
// on narrow screens. No-op / removed when back under the threshold.
function applyNavWidth(doc) {
  const navbar = doc.querySelector('#navbar') || doc.querySelector('nav.navbar')
  if (!navbar) return
  const ul = doc.querySelector('ul.nav-links')
  if (!ul) return
  const visible = Array.from(ul.querySelectorAll('li')).filter(
    (li) => !li.querySelector('.nav-cta-link') && !li.hasAttribute('hidden'),
  )
  if (visible.length > 5) navbar.classList.add('nav-wide')
  else navbar.classList.remove('nav-wide')
}

function syncLangSwitcher(doc, page, locale) {
  const el = doc.querySelector('[data-langauto]')
  if (!el || !page.locales) return
  el.innerHTML = ''
  for (const lc of ['hu', 'en', 'it']) {
    const loc = page.locales[lc]
    if (!loc) continue
    const a = doc.createElement('a')
    a.setAttribute('href', loc.url)
    a.setAttribute('class', 'lang-link' + (lc === locale ? ' is-active' : ''))
    if (lc === locale) a.setAttribute('aria-current', 'page')
    a.textContent = lc.toUpperCase()
    el.appendChild(a)
  }
}

// ── Blog engine (M5) ─────────────────────────────────────────────────────────

const BLOG_STR = {
  back: { hu: 'Vissza a bloghoz', en: 'Back to the blog', it: 'Torna al blog' },
  more: { hu: 'Tovább olvasom →', en: 'Read more →', it: 'Continua →' },
  empty: { hu: 'Hamarosan érkeznek az első cikkek.', en: 'Posts are coming soon.', it: 'Presto i primi articoli.' },
  months: {
    hu: ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  },
}

function formatPostDate(iso, locale) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate()
  const months = BLOG_STR.months[locale] || BLOG_STR.months.hu
  if (locale === 'hu') return `${y}. ${months[m]} ${day}.`
  if (locale === 'it') return `${day} ${months[m]} ${y}`
  return `${months[m]} ${day}, ${y}`
}

// Third-party auto-blog (Soro). When a locale has a Soro embed id configured
// (manifest.soroBlog[locale]), the blog index renders Soro's feed in place of
// the built-in post list / "coming soon" state — Soro then owns that blog. The
// built-in engine (blog_posts) stays available but dormant for that locale.
function soroEmbedHtml(soroId) {
  return (
    `<div id="soro-blog" style="grid-column:1/-1"></div>\n` +
    `<script src="https://app.trysoro.com/api/embed/${escapeAttr(soroId)}" defer></script>`
  )
}

// Blog url + filesystem-dir helpers (hu at root, en/it under their prefix).
function blogIndexUrl(locale) { return locale === 'hu' ? '/blog/' : `/${locale}/blog/` }
function blogPostUrl(locale, slug) { return blogIndexUrl(locale) + slug + '/' }
function blogDir(locale) { return locale === 'hu' ? 'blog' : `${locale}/blog` }

// Fetch published posts for one locale (newest first). Returns null on error so
// the caller can skip cleanup rather than wipe the blog on a transient failure.
async function fetchBlogPosts(locale) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return []
  try {
    let url = `${SUPABASE_URL}/rest/v1/blog_posts?status=eq.published&locale=eq.${encodeURIComponent(locale)}&select=*&order=published_at.desc`
    const siteId = process.env.SITE_ID
    if (siteId) url += `&site_id=eq.${encodeURIComponent(siteId)}`
    const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
    if (!res.ok) {
      console.warn(`blog fetch failed (${locale}): ${res.status}`)
      return null
    }
    return await res.json()
  } catch (e) {
    console.warn(`blog fetch error (${locale}): ${e.message}`)
    return null
  }
}

function readBaseShell(locale, manifest, label, desc, bodyHtml) {
  const base = fs.readFileSync(path.join(__dirname, '..', 'page-templates', '_base.html'), 'utf-8')
  const home = (manifest.pages || []).find((p) => p.id === 'home')
  const homeUrl = (home && home.locales[locale] && home.locales[locale].url) || '/'
  const cta = { hu: 'Ajánlatkérés', en: 'Get a quote', it: 'Richiedi preventivo' }[locale] || 'Ajánlatkérés'
  return base
    .replace(/__LANG__/g, locale)
    .replace(/__TITLE__/g, `${escapeHtmlText(label)} – Loricatus`)
    .replace(/__DESC__/g, escapeHtmlText(desc || label))
    .replace(/__HOME__/g, homeUrl)
    .replace(/__CTA__/g, escapeHtmlText(cta))
    .replace('__BODY__', bodyHtml)
}

function buildPostCard(post, locale) {
  const url = blogPostUrl(locale, post.slug)
  const date = formatPostDate(post.published_at, locale)
  const cover = post.cover_url
    ? `<img class="blog-card-cover" src="${escapeAttr(post.cover_url)}" alt="${escapeHtmlText(post.title)}" loading="lazy">`
    : ''
  const tags = Array.isArray(post.tags) && post.tags.length
    ? `<div class="blog-tags">${post.tags.map((t) => `<span class="blog-tag">${escapeHtmlText(t)}</span>`).join('')}</div>`
    : ''
  const more = BLOG_STR.more[locale] || BLOG_STR.more.hu
  return (
    `<article class="blog-card"><a class="blog-card-link" href="${url}">` +
    cover +
    `<div class="blog-card-body">` +
    (date ? `<div class="blog-card-date">${escapeHtmlText(date)}</div>` : '') +
    `<h2 class="blog-card-title">${escapeHtmlText(post.title)}</h2>` +
    (post.excerpt ? `<p class="blog-card-excerpt">${escapeHtmlText(post.excerpt)}</p>` : '') +
    tags +
    `<span class="blog-card-more">${escapeHtmlText(more)}</span>` +
    `</div></a></article>`
  )
}

function setPostSeo(doc, absUrl, post) {
  const head = doc.head
  if (!head) return
  let c = head.querySelector('link[rel="canonical"]')
  if (!c) { c = doc.createElement('link'); c.setAttribute('rel', 'canonical'); head.appendChild(c) }
  c.setAttribute('href', absUrl)
  const ogType = head.querySelector('meta[property="og:type"]')
  if (ogType) ogType.setAttribute('content', 'article')
  if (post.cover_url) {
    let img = head.querySelector('meta[property="og:image"]')
    if (!img) { img = doc.createElement('meta'); img.setAttribute('property', 'og:image'); head.appendChild(img) }
    img.setAttribute('content', post.cover_url)
  }
  if (post.published_at) {
    let pt = head.querySelector('meta[property="article:published_time"]')
    if (!pt) { pt = doc.createElement('meta'); pt.setAttribute('property', 'article:published_time'); head.appendChild(pt) }
    pt.setAttribute('content', post.published_at)
  }
}

function generateBlogPost(post, locale, manifest, blogPage) {
  const indexUrl = blogPage.locales[locale].url
  const back = BLOG_STR.back[locale] || BLOG_STR.back.hu
  const date = formatPostDate(post.published_at, locale)
  const cover = post.cover_url
    ? `<img class="blog-post-cover" src="${escapeAttr(post.cover_url)}" alt="${escapeHtmlText(post.title)}">`
    : ''
  const tags = Array.isArray(post.tags) && post.tags.length
    ? `<div class="blog-tags">${post.tags.map((t) => `<span class="blog-tag">${escapeHtmlText(t)}</span>`).join('')}</div>`
    : ''
  let body = fs.readFileSync(path.join(__dirname, '..', 'page-templates', 'blog-post.html'), 'utf-8')
  body = body
    .replace('__BLOG_INDEX__', indexUrl)
    .replace('__BLOG_BACK__', escapeHtmlText(back))
    .replace('__POST_DATE__', escapeHtmlText(date))
    .replace('__POST_TITLE__', escapeHtmlText(post.title))
    .replace('__POST_COVER__', cover)
    .replace('__POST_BODY__', post.body || '') // trusted rich HTML from the editor
    .replace('__POST_TAGS__', tags)
  const html = readBaseShell(locale, manifest, post.title, post.excerpt || post.title, body)
  const dom = new JSDOM(html)
  const doc = dom.window.document
  const absUrl = String(manifest.baseUrl || '').replace(/\/$/, '') + blogPostUrl(locale, post.slug)
  setPostSeo(doc, absUrl, post)
  syncNav(doc, manifest, indexUrl, locale) // marks Blog active in the nav
  syncLangSwitcher(doc, blogPage, locale) // lang links point to each locale's blog index
  applyNavWidth(doc)
  const dir = path.join(__dirname, '..', blogDir(locale), post.slug)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), dom.serialize())
}

// Remove /blog/<slug>/ dirs whose slug is no longer published (deleted/unpublished).
function removeStaleBlogPosts(locale, keepSlugs) {
  const dir = path.join(__dirname, '..', blogDir(locale))
  if (!fs.existsSync(dir)) return 0
  let removed = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(entry.name)) continue // never touch anything odd
    if (!keepSlugs.has(entry.name)) {
      fs.rmSync(path.join(dir, entry.name), { recursive: true, force: true })
      removed++
      console.log(`Removed stale blog post: ${blogDir(locale)}/${entry.name}`)
    }
  }
  return removed
}

function writeBlogRss(locale, manifest, posts) {
  const base = String(manifest.baseUrl || '').replace(/\/$/, '')
  const title = 'Loricatus Blog'
  const items = posts
    .map((p) => {
      const link = base + blogPostUrl(locale, p.slug)
      const pub = p.published_at && !isNaN(new Date(p.published_at).getTime())
        ? new Date(p.published_at).toUTCString() : ''
      return (
        `    <item>\n      <title>${escapeHtmlText(p.title)}</title>\n` +
        `      <link>${link}</link>\n      <guid isPermaLink="true">${link}</guid>\n` +
        (pub ? `      <pubDate>${pub}</pubDate>\n` : '') +
        `      <description>${escapeHtmlText(p.excerpt || '')}</description>\n    </item>`
      )
    })
    .join('\n')
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n` +
    `    <title>${escapeHtmlText(title)}</title>\n    <link>${base + blogIndexUrl(locale)}</link>\n` +
    `    <description>${escapeHtmlText(title)}</description>\n${items}\n  </channel>\n</rss>\n`
  const rssPath = path.join(__dirname, '..', blogDir(locale), 'rss.xml')
  fs.mkdirSync(path.dirname(rssPath), { recursive: true })
  fs.writeFileSync(rssPath, xml)
}

// Generate the whole blog for one locale: index + post pages + RSS + cleanup.
async function generateBlog(locale, manifest) {
  const blogPage = (manifest.pages || []).find((p) => p.id === 'blog')
  if (!blogPage || !blogPage.locales[locale]) return
  const posts = await fetchBlogPosts(locale)
  if (posts === null) {
    console.warn(`Blog generation for ${locale} skipped (fetch failed) — files left intact`)
    return
  }

  // 1. Index page (editable header from page_content + the feed). A configured
  // Soro locale renders its embed and takes precedence over the built-in posts.
  const soroId = (manifest.soroBlog || {})[locale]
  const cards = soroId
    ? soroEmbedHtml(soroId)
    : posts.length
    ? posts.map((p) => buildPostCard(p, locale)).join('\n')
    : `<p class="blog-empty">${escapeHtmlText(BLOG_STR.empty[locale] || BLOG_STR.empty.hu)}</p>`
  let indexBody = fs.readFileSync(path.join(__dirname, '..', 'page-templates', 'blog-index.html'), 'utf-8')
  indexBody = indexBody.replace('__BLOG_CARDS__', cards)
  const label = navLabel(blogPage, locale)
  const indexHtml = readBaseShell(locale, manifest, label, label, indexBody)
  const dom = new JSDOM(indexHtml)
  const doc = dom.window.document
  let header = { content: {} }
  try {
    header = await fetchPageContent(blogPage.locales[locale].slug)
  } catch (e) {
    console.warn(`Blog header content fetch failed (${locale}): ${e.message}`)
  }
  applyContent(doc, header.content || {})
  applySeo(doc, manifest, blogPage, locale)
  syncNav(doc, manifest, blogPage.locales[locale].url, locale)
  syncLangSwitcher(doc, blogPage, locale)
  applyNavWidth(doc)
  const indexPath = path.join(__dirname, '..', blogPage.locales[locale].file)
  fs.mkdirSync(path.dirname(indexPath), { recursive: true })
  fs.writeFileSync(indexPath, dom.serialize())
  console.log(`Blog index (${locale}): ${posts.length} post(s) -> ${blogPage.locales[locale].file}`)

  // 2. Post pages.
  for (const post of posts) generateBlogPost(post, locale, manifest, blogPage)

  // 3. Cleanup + RSS.
  removeStaleBlogPosts(locale, new Set(posts.map((p) => p.slug)))
  writeBlogRss(locale, manifest, posts)
}

// Absolute URLs of every published post across all locales — for the sitemap.
async function fetchAllBlogPostUrls(manifest) {
  const base = String(manifest.baseUrl || '').replace(/\/$/, '')
  const locales = Array.isArray(manifest.locales) ? manifest.locales : ['hu']
  const urls = []
  for (const lc of locales) {
    const posts = await fetchBlogPosts(lc)
    if (!posts) continue
    for (const p of posts) urls.push(base + blogPostUrl(lc, p.slug))
  }
  return urls
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
    process.exit(1)
  }
  if (!manifest) {
    console.error('Could not load pages.json manifest')
    process.exit(1)
  }
  // A page was deleted in the editor — remove its files, then continue with the
  // (home) publish so the nav + sitemap refresh without it.
  const REMOVE_PAGE = process.env.REMOVE_PAGE
  if (REMOVE_PAGE) {
    const n = removeDynamicPageFiles(REMOVE_PAGE)
    console.log(`Page removal '${REMOVE_PAGE}': ${n} director(ies) removed`)
  }

  // Base pages (pages.json) + editor-created pages (site_pages) as one list.
  const dynamicRows = await loadDynamicPages()
  const merged = mergeManifest(manifest, dynamicRows)

  // Blog engine: PAGE='blog' regenerates the whole blog for this locale
  // (index + post pages + RSS) from published posts, then refreshes the sitemap.
  if (PAGE === 'blog') {
    await generateBlog(LOCALE, merged)
    writeSitemap(merged, await fetchAllBlogPostUrls(merged))
    console.log('Blog publish complete')
    return
  }

  const target = resolveTarget(merged, PAGE, LOCALE)
  if (!target) {
    console.error(`Unknown page/locale: page=${PAGE} locale=${LOCALE}`)
    process.exit(1)
  }
  console.log(`Publishing page=${PAGE} locale=${LOCALE} (slug=${target.pageSlug}, file=${target.filePath})`)

  const pageData = await fetchPageContent(target.pageSlug)
  const content = pageData.content || {}
  const theme = pageData.theme || {}
  const layout = pageData.layout || {}

  const htmlPath = path.join(__dirname, '..', target.filePath)
  // An uploaded (ready-made HTML) page is rendered from the upload on every
  // publish, so replacing the file in the editor takes effect immediately.
  const upload = findUpload(await loadPageUploads(), PAGE, LOCALE)
  if (upload) {
    writeUploadedPage(htmlPath, upload, target.page, LOCALE, merged)
  } else if (!fs.existsSync(htmlPath)) {
    // A dynamic page's file won't exist on its first publish — scaffold it from
    // the base shell + its body template.
    if (target.page && target.page.template) {
      scaffoldPageFile(htmlPath, target.page, LOCALE, merged)
    } else {
      console.error(`Page file missing and not scaffoldable: ${htmlPath}`)
      process.exit(1)
    }
  }
  const html = fs.readFileSync(htmlPath, 'utf-8')
  const dom = new JSDOM(html)
  const doc = dom.window.document

  // Materialize cloned items + catalog sections first, so applyContent can
  // target their fields.
  const clonedCount = materializeAddedItems(doc, layout)
  const removedCount = removeStrayItems(doc, layout)
  const sectionCount = materializeAddedSections(doc, layout)
  const straySectionCount = removeStraySections(doc, layout)
  if (clonedCount) console.log(`Cloned ${clonedCount} new list item(s) from templates`)
  if (removedCount) console.log(`Removed ${removedCount} deleted list item(s)`)
  if (sectionCount) console.log(`Inserted ${sectionCount} catalog section(s)`)
  if (straySectionCount) console.log(`Removed ${straySectionCount} deleted section(s)`)

  const { applied, missing } = applyContent(doc, content)
  console.log(`Applied ${applied} content overrides`)
  if (missing.length) {
    console.warn(`Skipped ${missing.length} keys (no matching data-edit target):`)
    missing.forEach((k) => console.warn(`  - ${k}`))
  }

  // Now do the rest of layout (reorder + visibility). Materialize/remove
  // already ran above, so re-entering them inside applyLayout is a no-op.
  applyLayout(doc, layout)

  if (applyTheme(doc, theme)) {
    console.log(`Applied theme: ${Object.keys(theme).join(', ')}`)
  }

  // Regenerate canonical + hreflang for this page from the manifest.
  if (applySeo(doc, merged, target.page, LOCALE)) {
    console.log('Applied canonical + hreflang from manifest')
  }

  // Keep navigation + language switcher in sync with the page list.
  syncNav(doc, merged, target.url, LOCALE)
  syncLangSwitcher(doc, target.page, LOCALE)
  applyNavWidth(doc)

  fs.writeFileSync(htmlPath, dom.serialize())
  console.log(`Wrote ${htmlPath}`)

  // Keep the blog in sync on every publish so its nav link (added by syncNav
  // above, since Blog is an in-nav page) never points at a missing /blog/.
  await generateBlog(LOCALE, merged)

  // Sitemap is manifest-derived (base + dynamic) plus published blog posts, so
  // regenerate it every publish (blog posts stay listed on any page publish).
  writeSitemap(merged, await fetchAllBlogPostUrls(merged))
}

// Run only when invoked directly (CI). When required as a module (tests), the
// functions above are exported instead of executing the publish flow.
if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

module.exports = {
  applyContent,
  toEmbedUrl,
  isVideoFile,
  soroEmbedHtml,
  generateBlog,
  formatPostDate,
  blogPostUrl,
  blogIndexUrl,
  buildPostCard,
  generateBlogPost,
  writeBlogRss,
  removeStaleBlogPosts,
  renderUploadedPage,
  findUpload,
  applyLayout,
  materializeAddedItems,
  removeStrayItems,
  materializeAddedSections,
  removeStraySections,
  buildAddedSection,
  applyTheme,
  loadManifest,
  resolveTarget,
  applySeo,
  buildSitemapXml,
  mergeManifest,
  dynamicToPageEntry,
  scaffoldPageFile,
  syncNav,
  syncLangSwitcher,
  applyNavWidth,
  removeDynamicPageFiles,
}
