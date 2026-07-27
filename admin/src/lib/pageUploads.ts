import { supabase, SITE_ID } from './supabase'

// How the publish pipeline renders an uploaded HTML document:
//  - 'shell'      → its body goes inside the site frame (nav + footer + styles)
//  - 'standalone' → served exactly as uploaded (its own design, no site chrome)
export type UploadMode = 'shell' | 'standalone'

// List row — the HTML itself is intentionally not fetched (files can be large).
export type PageUpload = {
  page_id: string
  locale: string
  mode: UploadMode
  updated_at: string
}

// Matches the 2 MB cap enforced by the upload_page_html RPC.
export const MAX_UPLOAD_BYTES = 2_000_000

// Members can read their site's uploads via RLS (page_uploads_sel).
export async function listPageUploads() {
  return supabase
    .from('page_uploads')
    .select('page_id, locale, mode, updated_at')
    .eq('site_id', SITE_ID)
}

export async function uploadPageHtml(
  pageId: string,
  locale: string,
  html: string,
  mode: UploadMode,
) {
  return supabase.rpc('upload_page_html', {
    p_site: SITE_ID,
    p_id: pageId,
    p_locale: locale,
    p_html: html,
    p_mode: mode,
  })
}

// Flip an existing upload between shell/standalone (no re-upload needed).
export async function setPageUploadMode(pageId: string, locale: string, mode: UploadMode) {
  return supabase.rpc('set_page_upload_mode', {
    p_site: SITE_ID,
    p_id: pageId,
    p_locale: locale,
    p_mode: mode,
  })
}

export async function deletePageUpload(pageId: string, locale: string) {
  return supabase.rpc('delete_page_upload', {
    p_site: SITE_ID,
    p_id: pageId,
    p_locale: locale,
  })
}

// Basic sanity check so a wrong file (image, PDF, plain text) fails early with
// a clear message instead of publishing a broken page.
export function looksLikeHtml(text: string): boolean {
  const head = text.slice(0, 4000).toLowerCase()
  return head.includes('<html') || head.includes('<!doctype html') || head.includes('<body')
}
