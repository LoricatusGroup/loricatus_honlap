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
  const url = `${SUPABASE_URL}/rest/v1/page_content?page_slug=eq.index&select=content,theme`
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
      const el = doc.querySelector(`[${attr}="${CSS.escape(key)}"]`)
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
