// Edge Function: kovetes-lekerdez
// NYILVÁNOS (a loricatus.hu/projektkovetes/ oldal hívja): a megrendelő a
// projektkódjával (LRCTS2026-85-K7QM) lekéri a projektje állapotát.
//
// Védelem a kód kitalálása ellen:
//   1. Cloudflare Turnstile — minden lekérdezéshez (gép nem próbálgathat);
//   2. IP-nkénti korlát — 20 lekérdezés / 15 perc;
//   3. projektenkénti zár — ha egy projekt-sorszámra (LRCTS2026-85) egy órán
//      belül 10 hibás próbálkozás jött, az a sorszám egy órára zárolva van
//      (a 4 karakteres titkos vég célzottan sem próbálgatható végig);
//   4. a kód nincs tárolva, csak a SHA-256-ja; az IP is csak hash-elve.
// Nem létező és hibás kód ugyanazt a választ kapja (nem derül ki, létezik-e a sorszám).
//
// Edge Function secret: TURNSTILE_SECRET_KEY (ugyanaz, mint a submit-form-é).
// Automatikus: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ENGEDETT_ORIGINEK = ['https://loricatus.hu', 'https://www.loricatus.hu']

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ENGEDETT_ORIGINEK.includes(origin) ? origin : ENGEDETT_ORIGINEK[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

const ELOTAG = 'LRCTS'
const TITOK_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const IP_KORLAT = 20
const IP_ABLAK_PERC = 15
const KOD_HIBA_KORLAT = 10
const KOD_ABLAK_PERC = 60

/** Ugyanaz, mint a CRM `kodNormalizal`-ja: „lrcts 2026 85 k7qm" → LRCTS2026-85-K7QM. */
function normalizal(beirt: string): { sorszam: string; teljes: string } | null {
  const s = String(beirt ?? '').trim().toUpperCase().replace(/[\s_.–—]+/g, '-').replace(/-+/g, '-')
  const m = new RegExp(`^${ELOTAG}-?(\\d{4})-?(\\d{1,5})-?([${TITOK_ABC}]{4})$`).exec(s)
  if (!m) return null
  const sorszam = `${ELOTAG}${m[1]}-${Number(m[2])}`
  return { sorszam, teljes: `${sorszam}-${m[3]}` }
}

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  const h = cors(req)
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'json' }, 400) }

  const ip = req.headers.get('CF-Connecting-IP') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'ismeretlen'
  const ipKulcs = `ip:${await sha256(ip)}`
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const ota = (perc: number) => new Date(Date.now() - perc * 60_000).toISOString()
  const darab = async (kulcs: string, perc: number, csakHibas: boolean) => {
    let q = admin.from('projekt_kovetes_probalkozas').select('id', { count: 'exact', head: true })
      .eq('kulcs', kulcs).gte('at', ota(perc))
    if (csakHibas) q = q.eq('sikeres', false)
    const { count } = await q
    return count ?? 0
  }

  // 1. IP-korlát — a captcha előtt, hogy a túlterhelés se menjen át a Cloudflare-en.
  if ((await darab(ipKulcs, IP_ABLAK_PERC, false)) >= IP_KORLAT) return json({ error: 'sok' }, 429)

  // 2. Turnstile.
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret) return json({ error: 'config' }, 500)
  const form = new URLSearchParams({ secret, response: String(body.token ?? '') })
  if (ip !== 'ismeretlen') form.set('remoteip', ip)
  const ts = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
    .then((r) => r.json()).catch(() => ({ success: false }))
  if (!ts.success) return json({ error: 'captcha' }, 403)

  const kod = normalizal(String(body.kod ?? ''))
  const rogzit = async (sikeres: boolean) => {
    const sorok = [{ kulcs: ipKulcs, sikeres }]
    if (kod) sorok.push({ kulcs: `kod:${kod.sorszam}`, sikeres })
    await admin.from('projekt_kovetes_probalkozas').insert(sorok)
    // Takarítás: a napnál régebbi próbálkozások törlése (minden ~50. kérésnél).
    if (Math.random() < 0.02) await admin.from('projekt_kovetes_probalkozas').delete().lt('at', ota(24 * 60))
  }

  if (!kod) { await rogzit(false); return json({ error: 'nincs' }, 404) }

  // 3. Projektenkénti zár.
  if ((await darab(`kod:${kod.sorszam}`, KOD_ABLAK_PERC, true)) >= KOD_HIBA_KORLAT) {
    await rogzit(false)
    return json({ error: 'zarolva' }, 429)
  }

  const { data } = await admin.from('projekt_kovetes').select('adat, frissitve').eq('kod_hash', await sha256(kod.teljes)).maybeSingle()
  await rogzit(!!data)
  if (!data) return json({ error: 'nincs' }, 404)
  return json({ adat: data.adat, frissitve: data.frissitve }, 200)
})
