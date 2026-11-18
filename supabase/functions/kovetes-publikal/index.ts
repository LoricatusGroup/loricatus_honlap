// Edge Function: kovetes-publikal
// A CRM (NAS) hívja percenként: a követett projektek nyilvános pillanatképei
// fel (`frissit`), a törölt projektek le (`torol`). NEM nyilvános: az
// `x-kovetes-kulcs` fejlécben a közös titkot várja (nincs JWT — a NAS-on nincs
// Supabase-kulcs, és nem is kell, hogy legyen).
//
// Edge Function secret:
//   - KOVETES_PUBLIKALAS_KULCS : ugyanaz, mint a CRM KOVETES_PUBLIKALAS_KULCS env-je (min. 32 karakter)
// Automatikus: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// Deploy: verify_jwt = false.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Időzítés-független összehasonlítás (a titok ne legyen bájtonként kitalálható). */
function egyenlo(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let d = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return d === 0
}

const HASH = /^[0-9a-f]{64}$/
const DATUM = /^\d{4}-\d{2}-\d{2}$/
const MAX_TETEL = 500

/** Csak az ismert mezők mennek tovább, méretkorláttal — más nem kerülhet a nyilvános táblába. */
function tisztit(a: Record<string, unknown>): Record<string, unknown> | null {
  const lepesek = Array.isArray(a.lepesek) ? a.lepesek.slice(0, 20).map((s) => String(s).slice(0, 120)) : null
  const lepes = Number(a.lepes)
  if (!lepesek || !Number.isInteger(lepes) || lepes < 1 || lepes > lepesek.length) return null
  const datum = (v: unknown) => (typeof v === 'string' && DATUM.test(v) ? v : null)
  return {
    kod: String(a.kod ?? '').slice(0, 40),
    projekt: String(a.projekt ?? '').slice(0, 200),
    lepes,
    lepesek,
    lepesValtozott: typeof a.lepesValtozott === 'string' && !Number.isNaN(Date.parse(a.lepesValtozott)) ? a.lepesValtozott : null,
    hatarido: datum(a.hatarido),
    reszHatarido: datum(a.reszHatarido),
    lezarva: a.lezarva === true,
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const titok = Deno.env.get('KOVETES_PUBLIKALAS_KULCS') ?? ''
  if (titok.length < 32) return json({ error: 'Server misconfigured' }, 500)
  if (!egyenlo(req.headers.get('x-kovetes-kulcs') ?? '', titok)) return json({ error: 'Unauthorized' }, 401)

  let body: { frissit?: unknown; torol?: unknown }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
  const frissit = Array.isArray(body.frissit) ? body.frissit : []
  const torol = Array.isArray(body.torol) ? body.torol : []
  if (frissit.length > MAX_TETEL || torol.length > MAX_TETEL) return json({ error: 'Too many items' }, 413)

  const sorok: Array<{ kod_hash: string; adat: Record<string, unknown>; frissitve: string }> = []
  for (const t of frissit as Array<{ h?: unknown; adat?: unknown }>) {
    const h = String(t?.h ?? '')
    const adat = t?.adat && typeof t.adat === 'object' ? tisztit(t.adat as Record<string, unknown>) : null
    if (!HASH.test(h) || !adat) return json({ error: 'Invalid item' }, 400)
    sorok.push({ kod_hash: h, adat, frissitve: new Date().toISOString() })
  }
  const torlendo = (torol as unknown[]).map(String)
  if (torlendo.some((h) => !HASH.test(h))) return json({ error: 'Invalid item' }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  if (sorok.length) {
    const { error } = await admin.from('projekt_kovetes').upsert(sorok, { onConflict: 'kod_hash' })
    if (error) return json({ error: 'Upsert failed' }, 500)
  }
  if (torlendo.length) {
    const { error } = await admin.from('projekt_kovetes').delete().in('kod_hash', torlendo)
    if (error) return json({ error: 'Delete failed' }, 500)
  }
  return json({ ok: true, frissitve: sorok.length, torolve: torlendo.length }, 200)
})
