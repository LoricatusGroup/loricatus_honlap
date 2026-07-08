import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars')
}

// The tenant this editor build serves. Phase 0 pins it at build time (the
// Loricatus site is redeployed anyway); the committed default keeps the build
// working without extra CI config. Phase 1 replaces this with a runtime
// /admin-app/config.json so one prebuilt bundle can serve every tenant.
// Not a secret — RLS + save_page enforce access server-side, not this value.
export const SITE_ID =
  import.meta.env.VITE_SITE_ID || 'a7a65c78-972a-4d83-8983-bbce5e6c5a47'

// A member's capability on the current site, as returned by current_membership().
// null means "not a member" → no editor access.
export type Membership = { role: string; can_edit_advanced: boolean }

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
