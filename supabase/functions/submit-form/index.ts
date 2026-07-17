// Edge Function: submit-form
// PUBLIC (no JWT — anonymous site visitors call it). Custom protection instead:
// Cloudflare Turnstile server-side verification + a honeypot field. On success it
// stores the lead in form_submissions (service role) and, if configured, emails a
// notification via Resend. Replaces the old client-side web3forms POST.
//
// Required Edge Function secrets:
//   - TURNSTILE_SECRET_KEY : Cloudflare Turnstile secret key (server-side verify)
//   - RESEND_API_KEY       : optional; if set + site has notify_email, notify email is sent
//   - NOTIFY_FROM          : optional sender (Resend-verified domain)
// Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'jsr:@supabase/supabase-js@2'

// The browser preflights the POST because it carries apikey + Authorization +
// a JSON content-type. Allow that exact header set, otherwise the OPTIONS
// preflight fails and the POST never fires (CORS error).
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

const FIELDS = ['name', 'company', 'email', 'phone', 'service', 'message'] as const
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  // Honeypot: real users leave `website` empty; bots fill it. Pretend success.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return json({ success: true }, 200)
  }

  const site_id = String(body.site_id ?? '')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(site_id)) {
    return json({ error: 'Missing or invalid site' }, 400)
  }

  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim()
  const service = String(body.service ?? '').trim()
  const message = String(body.message ?? '').trim()
  if (name.length < 2 || !isEmail(email) || service === '' || message.length < 10) {
    return json({ error: 'Validation failed' }, 400)
  }

  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret) return json({ error: 'Server misconfigured' }, 500)
  const verifyForm = new URLSearchParams()
  verifyForm.set('secret', secret)
  verifyForm.set('response', String(body.token ?? ''))
  const ip =
    req.headers.get('CF-Connecting-IP') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (ip) verifyForm.set('remoteip', ip)
  const verifyRes = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    { method: 'POST', body: verifyForm },
  )
  const outcome = await verifyRes.json().catch(() => ({ success: false }))
  if (!outcome.success) return json({ error: 'Captcha verification failed' }, 403)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: site } = await admin
    .from('sites')
    .select('id, name, notify_email')
    .eq('id', site_id)
    .maybeSingle()
  if (!site) return json({ error: 'Unknown site' }, 400)

  const data: Record<string, string> = {}
  for (const f of FIELDS) {
    const v = body[f]
    if (v != null && String(v).trim() !== '') data[f] = String(v).slice(0, 5000)
  }

  const { error: insErr } = await admin
    .from('form_submissions')
    .insert({ site_id, form_id: 'contact', data })
  if (insErr) return json({ error: 'Could not store submission' }, 500)

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (resendKey && site.notify_email) {
    const rows = FIELDS.filter((f) => data[f])
      .map((f) => `<tr><td style="padding:4px 12px 4px 0"><b>${f}</b></td><td>${escapeHtml(data[f])}</td></tr>`)
      .join('')
    // Default to Resend's shared test sender (works with no verified domain,
    // but only delivers to the Resend account's own address). For production,
    // verify a domain and set NOTIFY_FROM (e.g. "Loricatus <noreply@yourdomain>").
    const from =
      Deno.env.get('NOTIFY_FROM') ?? `${site.name} <onboarding@resend.dev>`
    try {
      const mailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [site.notify_email],
          reply_to: data.email,
          subject: `Új ajánlatkérés — ${site.name}`,
          html: `<h2>Új ajánlatkérés (${escapeHtml(site.name)})</h2><table>${rows}</table>`,
        }),
      })
      const mailBody = await mailRes.text()
      if (!mailRes.ok) console.error('Resend send failed', mailRes.status, mailBody)
      else console.log('Resend send ok', mailBody)
    } catch (e) {
      console.error('Resend send threw', String(e))
    }
  }

  return json({ success: true }, 200)
})
