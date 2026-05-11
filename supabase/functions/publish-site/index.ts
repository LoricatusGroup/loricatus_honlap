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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
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

  // Gatekeeping: user must be in allowed_users
  const { data: allowed } = await supabase
    .from('allowed_users')
    .select('email')
    .ilike('email', user.email)
    .maybeSingle()

  if (!allowed) {
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
      client_payload: { triggered_by: user.email },
    }),
  })

  if (!ghRes.ok) {
    const text = await ghRes.text()
    return json({ error: `GitHub API error (${ghRes.status}): ${text}` }, 502)
  }

  return json({ success: true, triggered_by: user.email }, 200)
})
