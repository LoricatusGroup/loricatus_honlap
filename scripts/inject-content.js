// Fetch CMS content from Supabase and inject it into index.html.
// Run by .github/workflows/publish.yml on repository_dispatch.
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY

const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

async function fetchPageContent() {
  // Use select=* so this still works before the `layout` column migration runs.
  const url = `${SUPABASE_URL}/rest/v1/page_content?page_slug=eq.index&select=*`
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
  if (!rows.length) throw new Error('No row found for page_slug=index')
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

// Reorder children of a parent so they match `order` (an array of IDs).
// Elements identified via `idAttr` on each child. Unknown IDs in `order` are
// ignored. Children whose IDs are not in `order` are appended at the end.
function reorderChildren(parent, idAttr, order) {
  if (!parent || !Array.isArray(order) || !order.length) return
  const byId = new Map()
  for (const child of Array.from(parent.children)) {
    const id = child.getAttribute(idAttr)
    if (id) byId.set(id, child)
  }
  const placed = new Set()
  for (const id of order) {
    const el = byId.get(id)
    if (el) {
      parent.appendChild(el)
      placed.add(id)
    }
  }
  // Any remaining (not mentioned in order) keep their relative order at the end
  for (const [id, el] of byId) {
    if (!placed.has(id)) parent.appendChild(el)
  }
}

function applyLayout(doc, layout) {
  if (!layout || typeof layout !== 'object') return
  const stats = { sectionsReordered: 0, listsReordered: 0, hidden: 0 }

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

  console.log(
    `Applied layout: ${stats.sectionsReordered} section(s) reordered, ` +
      `${stats.listsReordered} list(s) reordered, ${stats.hidden} element(s) hidden`,
  )
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
  const pageData = await fetchPageContent()
  const content = pageData.content || {}
  const theme = pageData.theme || {}
  const layout = pageData.layout || {}

  const htmlPath = path.join(__dirname, '..', 'index.html')
  const html = fs.readFileSync(htmlPath, 'utf-8')
  const dom = new JSDOM(html)
  const doc = dom.window.document

  const { applied, missing } = applyContent(doc, content)
  console.log(`Applied ${applied} content overrides`)
  if (missing.length) {
    console.warn(`Skipped ${missing.length} keys (no matching data-edit target):`)
    missing.forEach((k) => console.warn(`  - ${k}`))
  }

  applyLayout(doc, layout)

  if (applyTheme(doc, theme)) {
    console.log(`Applied theme: ${Object.keys(theme).join(', ')}`)
  }

  fs.writeFileSync(htmlPath, dom.serialize())
  console.log(`Wrote ${htmlPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
