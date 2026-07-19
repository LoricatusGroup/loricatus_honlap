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
function buildSitemapXml(manifest) {
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
  const body = urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

function writeSitemap(manifest) {
  const xml = buildSitemapXml(manifest)
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

  doc.querySelectorAll('ul.nav-links').forEach((ul) => {
    if (ul.hasAttribute('data-navauto')) {
      // Scaffolded page: build the whole page-level menu.
      ul.innerHTML = ''
      const links = homeLink ? [homeLink, ...inNav] : inNav
      links.forEach((l) => ul.appendChild(mkLi(l)))
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
  // A dynamic page's file won't exist on its first publish — scaffold it from
  // the base shell + its body template.
  if (!fs.existsSync(htmlPath)) {
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

  // Sitemap is manifest-derived (base + dynamic), so regenerate it every publish.
  writeSitemap(merged)
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
