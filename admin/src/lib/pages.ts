// Client-side view of the site's page manifest (pages.json at the site root).
// Lets the editor switch between pages (home, referenciak, ...) the same way it
// switches locales. Single source of truth shared with scripts/inject-content.js.

export type PageLocaleCfg = { slug: string; file: string; url: string }

export type PageEntry = {
  id: string
  nav?: Record<string, string>
  inNav?: boolean
  order?: number
  locales: Record<string, PageLocaleCfg>
}

export type PagesManifest = {
  baseUrl?: string
  locales?: string[]
  defaultLocale?: string
  pages: PageEntry[]
  extraUrls?: string[]
}

// Everything the editor needs to load/preview/save/publish one (page, locale).
export type ResolvedPageConfig = {
  pageSlug: string // page_content.page_slug
  htmlUrl: string // path for parseEditableFields / parseLayoutStructure
  iframeSrc: string // live-preview iframe src
  filePath: string // repo-relative file (Node side)
  url: string
}

export async function loadPagesManifest(): Promise<PagesManifest | null> {
  try {
    const res = await fetch('/pages.json', { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    if (!data || !Array.isArray(data.pages)) return null
    return data as PagesManifest
  } catch {
    return null
  }
}

export function resolvePageConfig(
  manifest: PagesManifest,
  pageId: string,
  locale: string,
): ResolvedPageConfig | null {
  const page = manifest.pages.find((p) => p.id === pageId)
  if (!page) return null
  const loc = page.locales?.[locale]
  if (!loc) return null
  return {
    pageSlug: loc.slug,
    // The editor is served from /admin-app/, so a repo file like
    // "referenciak/index.html" is one level up.
    htmlUrl: '../' + loc.file,
    iframeSrc: loc.url,
    filePath: loc.file,
    url: loc.url,
  }
}

export function pageNavLabel(page: PageEntry, locale: string): string {
  return (page.nav && (page.nav[locale] || page.nav.hu)) || page.id
}
