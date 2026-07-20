// Edge Function: publish-site
// Triggers a GitHub repository_dispatch event so the publish workflow runs
// and updates index.html from Supabase content.
//
// Required Edge Function secrets (set in Supabase Dashboard):
//   - GITHUB_TOKEN  : a Personal Access Token with `repo` scope
//   - GITHUB_REPO   : "owner/repo", e.g. "MayyDayy99/loricatus_honlap"
//
// SUPABASE_URL and SUPABASE_ANON_KEY are auto-injected by Supabase.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// 'all' is a sentinel: the publish workflow expands it to every configured
// locale and builds them in one run (used for structural changes: new page,
// rename, delete, reorder — which touch every locale's nav + sitemap).
const VALID_LOCALES = new Set(['hu', 'en', 'it', 'all'])
// A page id from pages.json. Constrained to a safe slug so it can be forwarded
// verbatim into the workflow payload. Defaults to 'home' (the original index page).
const PAGE_RE = /^[a-z0-9][a-z0-9-]{0,48}$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  // Optional body { locale, page, removePage }. removePage triggers a cleanup
  // publish that deletes a removed page's files (see inject-content.js).
  let locale = 'hu'
  let page = 'home'
  let removePage = ''
  try {
    if (req.headers.get('content-type')?.includes('application/json')) {
      const body = await req.json()
      if (body && typeof body.locale === 'string' && VALID_LOCALES.has(body.locale)) {
        locale = body.locale
      }
      if (body && typeof body.page === 'string' && PAGE_RE.test(body.page)) {
        page = body.page
      }
      if (body && typeof body.removePage === 'string' && PAGE_RE.test(body.removePage)) {
        removePage = body.removePage
      }
    }
  } catch {
    // Body is optional; ignore parse errors and stick with defaults
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()

  if (userErr || !user || !user.email) {
    return json({ error: 'Not authenticated' }, 401)
  }

  // Gatekeeping: user must be authorized — either an exact allowlist entry or a
  // whole-domain entry like '@loricatus.hu'. current_user_allowed() reads the
  // caller's own JWT email and mirrors the table-driven RLS policies.
  const { data: isAllowed, error: allowErr } = await supabase.rpc('current_user_allowed')

  if (allowErr || !isAllowed) {
    return json({ error: 'Not authorized to publish' }, 403)
  }

  const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN')
  const GITHUB_REPO = Deno.env.get('GITHUB_REPO')

  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    return json(
      { error: 'Server misconfigured: GITHUB_TOKEN or GITHUB_REPO missing' },
      500,
    )
  }

  const ghRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'loricatus-cms-publish',
    },
    body: JSON.stringify({
      event_type: 'publish-site',
      client_payload: { triggered_by: user.email, locale, page, remove_page: removePage },
    }),
  })

  if (!ghRes.ok) {
    const text = await ghRes.text()
    return json({ error: `GitHub API error (${ghRes.status}): ${text}` }, 502)
  }

  return json({ success: true, triggered_by: user.email, locale, page, removePage }, 200)
})
