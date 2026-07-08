// Shared theme tokens for the CMS colour editor.
// Keys MUST match the CSS custom properties consumed by style.css :root so
// that edits actually repaint the published site (see scripts/inject-content.js
// applyTheme, which writes :root { --<key>: <value> }).

export type ThemeKey = 'accent' | 'bg' | 'bg2' | 'text' | 'muted'

export const THEME_KEYS: { key: ThemeKey; label: string; hint: string }[] = [
  { key: 'accent', label: 'Kiemelő szín', hint: 'Linkek, gombok, kiemelések (a lime szín)' },
  { key: 'bg', label: 'Fő háttér', hint: 'Az oldal alap háttérszíne' },
  { key: 'bg2', label: 'Másodlagos háttér', hint: 'Eszközpark és vélemények szekció háttere' },
  { key: 'text', label: 'Szöveg', hint: 'A fő szövegszín' },
  { key: 'muted', label: 'Halvány szöveg', hint: 'Leírások, másodlagos feliratok' },
]

// Defaults MUST mirror style.css :root so an unset swatch shows the real
// current colour (not black) and the user edits with context.
export const DEFAULT_THEME: Record<ThemeKey, string> = {
  accent: '#c7d540',
  bg: '#f8f6f2',
  bg2: '#eeeae3',
  text: '#111316',
  muted: '#737e88',
}

const KNOWN = new Set<string>(THEME_KEYS.map((t) => t.key))

// Keep only recognised theme keys — drops stale/legacy keys (an older editor
// version wrote --text-color/--accent-color/--primary-color) so they are not
// round-tripped back into the database on save.
export function sanitizeTheme(
  theme: Record<string, string> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {}
  if (!theme) return out
  for (const [k, v] of Object.entries(theme)) {
    if (KNOWN.has(k) && typeof v === 'string' && v.trim()) out[k] = v
  }
  return out
}

export function themesEqual(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  return ak.every((k) => a[k] === b[k])
}
