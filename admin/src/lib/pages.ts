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
  _dynamic?: boolean // true for editor-created pages (site_pages), not pages.json
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

// ── Editor-created pages (M2) ───────────────────────────────────────────────

import { supabase, SITE_ID } from './supabase'

// Per-locale slug/file/url for a dynamic page id — mirrors inject-content.js.
function dynamicLocales(pageId: string): Record<string, PageLocaleCfg> {
  return {
    hu: { slug: pageId, file: `${pageId}/index.html`, url: `/${pageId}/` },
    en: { slug: `${pageId}-en`, file: `en/${pageId}/index.html`, url: `/en/${pageId}/` },
    it: { slug: `${pageId}-it`, file: `it/${pageId}/index.html`, url: `/it/${pageId}/` },
  }
}

export type SitePageRow = {
  page_id: string
  template: string
  nav: Record<string, string> | null
  in_nav: boolean
  sort_order: number
}

export function sitePageToEntry(row: SitePageRow): PageEntry {
  return {
    id: row.page_id,
    nav: row.nav || {},
    inNav: row.in_nav !== false,
    order: typeof row.sort_order === 'number' ? row.sort_order : 100,
    locales: dynamicLocales(row.page_id),
    _dynamic: true,
  }
}

export async function loadDynamicPages(): Promise<PageEntry[]> {
  const { data, error } = await supabase
    .from('site_pages')
    .select('page_id, template, nav, in_nav, sort_order')
    .eq('site_id', SITE_ID)
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return (data as SitePageRow[]).map(sitePageToEntry)
}

// Base manifest (pages.json) + dynamic pages (site_pages) as one manifest.
export function mergeManifest(base: PagesManifest, dynamic: PageEntry[]): PagesManifest {
  return { ...base, pages: [...base.pages, ...dynamic] }
}

// Load the full page list (base + dynamic) the editor should show.
export async function loadFullManifest(): Promise<PagesManifest | null> {
  const base = await loadPagesManifest()
  if (!base) return null
  const dynamic = await loadDynamicPages()
  return mergeManifest(base, dynamic)
}

// name → url-safe page id (strip Hungarian accents, spaces → hyphen).
export function slugify(name: string): string {
  const map: Record<string, string> = {
    á: 'a', é: 'e', í: 'i', ó: 'o', ö: 'o', ő: 'o', ú: 'u', ü: 'u', ű: 'u',
  }
  return name
    .toLowerCase()
    .replace(/[áéíóöőúüű]/g, (c) => map[c] || c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export async function createPage(pageId: string, template: string, nav: Record<string, string>) {
  return supabase.rpc('create_page', { p_site: SITE_ID, p_id: pageId, p_template: template, p_nav: nav })
}

export async function deletePage(pageId: string) {
  return supabase.rpc('delete_page', { p_site: SITE_ID, p_id: pageId })
}

export async function renamePage(pageId: string, nav: Record<string, string>) {
  return supabase.rpc('rename_page', { p_site: SITE_ID, p_id: pageId, p_nav: nav })
}

export async function reorderPages(pageIds: string[]) {
  return supabase.rpc('reorder_pages', { p_site: SITE_ID, p_ids: pageIds })
}
