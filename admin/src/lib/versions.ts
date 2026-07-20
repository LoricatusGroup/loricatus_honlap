import { supabase, SITE_ID } from './supabase'

// A snapshot recorded on every publish (the audit log + a restore point).
export type PageVersion = {
  id: string
  site_id: string
  page_slug: string
  created_at: string
  created_by_email: string | null
  note: string | null
  action: string | null
}

// Publish history for one page, newest first. Members read it via RLS
// (page_versions_select → is_member_of). We don't fetch content/theme/layout
// here — the list only needs the metadata; the restore RPC does the copy.
export async function listPageVersions(pageSlug: string) {
  return supabase
    .from('page_versions')
    .select('id, site_id, page_slug, created_at, created_by_email, note, action')
    .eq('site_id', SITE_ID)
    .eq('page_slug', pageSlug)
    .order('created_at', { ascending: false })
    .limit(50)
}

// Record the current live state of a page as a publish snapshot. Best-effort:
// called right after a successful publish; a failure here never blocks publish.
export async function snapshotVersion(pageSlug: string, note = '') {
  return supabase.rpc('snapshot_version', {
    p_site: SITE_ID,
    p_slug: pageSlug,
    p_note: note,
  })
}

// Copy a snapshot back into the live draft. Returns the new rev via `data`.
// For text-tier members the server freezes theme/layout to the current values.
export async function restorePageVersion(versionId: string) {
  return supabase.rpc('restore_page_version', {
    p_site: SITE_ID,
    p_version_id: versionId,
  })
}
