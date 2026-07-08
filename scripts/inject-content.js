// Fetch CMS content from Supabase and inject it into index.html.
// Run by .github/workflows/publish.yml on repository_dispatch.
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY

const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const LOCALE = process.env.LOCALE || 'hu'

const LOCALE_CONFIG = {
  hu: { pageSlug: 'index', filePath: 'index.html' },
  en: { pageSlug: 'index-en', filePath: 'en/index.html' },
  it: { pageSlug: 'index-it', filePath: 'it/index.html' },
}

const config = LOCALE_CONFIG[LOCALE]

async function fetchPageContent() {
  // Use select=* so this still works before the `layout` column migration runs.
  const url = `${SUPABASE_URL}/rest/v1/page_content?page_slug=eq.${encodeURIComponent(
    config.pageSlug,
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
    // No row for this locale yet — nothing to inject, but not an error.
    // Return a no-op shape so main() exits cleanly.
    console.log(`No row for page_slug=${config.pageSlug} — nothing to inject`)
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

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
    process.exit(1)
  }
  if (!config) {
    console.error(`Unknown LOCALE: ${LOCALE} (expected hu, en, or it)`)
    process.exit(1)
  }
  console.log(`Publishing locale=${LOCALE} (slug=${config.pageSlug}, file=${config.filePath})`)

  const pageData = await fetchPageContent()
  const content = pageData.content || {}
  const theme = pageData.theme || {}
  const layout = pageData.layout || {}

  const htmlPath = path.join(__dirname, '..', config.filePath)
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

  fs.writeFileSync(htmlPath, dom.serialize())
  console.log(`Wrote ${htmlPath}`)
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
}
