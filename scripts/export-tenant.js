// Poor-man's PITR: dump ONE tenant's rows (by site slug) to a timestamped JSON
// snapshot. Run in CI (backup.yml) with SUPABASE_URL + SUPABASE_SERVICE_KEY +
// SITE_SLUG. Uses the service key to read across RLS. Node 18+ (native fetch).
//
// NOTE: the snapshot currently contains only non-sensitive data (public page
// content + membership UUIDs; form_submissions is empty and the live form uses
// web3forms). BEFORE storing real contact-form leads (own-form feature) on a
// PUBLIC repo, switch the backup target to a private store — see the plan.

const fs = require('fs')
const path = require('path')

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const SITE_SLUG = process.env.SITE_SLUG || 'loricatus'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

async function rest(query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, { headers })
  if (!res.ok) throw new Error(`REST ${query}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function listStorage(bucket, prefix) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 1000, sortBy: { column: 'name', order: 'asc' } }),
  })
  return res.ok ? res.json() : { error: `${res.status} ${await res.text()}` }
}

async function main() {
  const sites = await rest(`sites?slug=eq.${encodeURIComponent(SITE_SLUG)}&select=*`)
  if (!sites.length) throw new Error(`No site with slug=${SITE_SLUG}`)
  const site = sites[0]
  const sid = site.id

  const dump = { exported_at: new Date().toISOString(), site }
  for (const table of ['page_content', 'page_versions', 'assets', 'form_submissions', 'memberships']) {
    dump[table] = await rest(`${table}?site_id=eq.${sid}&select=*`)
  }
  dump.storage = await listStorage('assets', `${sid}/`)

  const dir = path.join(__dirname, '..', 'backups', SITE_SLUG)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${dump.exported_at.replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(file, JSON.stringify(dump, null, 2))
  console.log(
    `Wrote ${file} — page_content:${dump.page_content.length} assets:${dump.assets.length} ` +
      `form_submissions:${dump.form_submissions.length} memberships:${dump.memberships.length}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
