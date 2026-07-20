import { supabase, SITE_ID } from './supabase'

export type BlogStatus = 'draft' | 'published'

export type BlogPost = {
  id: string
  site_id: string
  locale: string
  slug: string
  title: string
  excerpt: string
  body: string
  cover_url: string
  tags: string[]
  status: BlogStatus
  published_at: string | null
  author: string
  created_at: string
  updated_at: string
}

// Members can read their site's posts (drafts included) via RLS.
export async function listBlogPosts(locale: string) {
  return supabase
    .from('blog_posts')
    .select('*')
    .eq('site_id', SITE_ID)
    .eq('locale', locale)
    .order('created_at', { ascending: false })
}

export type UpsertPostInput = {
  id?: string | null
  locale: string
  slug: string
  title: string
  excerpt: string
  body: string
  cover: string
  tags: string[]
  status: BlogStatus
  author: string
}

export async function upsertBlogPost(p: UpsertPostInput) {
  return supabase.rpc('blog_upsert_post', {
    p_site: SITE_ID,
    p_id: p.id ?? null,
    p_locale: p.locale,
    p_slug: p.slug,
    p_title: p.title,
    p_excerpt: p.excerpt,
    p_body: p.body,
    p_cover: p.cover,
    p_tags: p.tags,
    p_status: p.status,
    p_author: p.author,
  })
}

export async function deleteBlogPost(id: string) {
  return supabase.rpc('blog_delete_post', { p_site: SITE_ID, p_id: id })
}

// Republish the whole blog (all locales) so the index, post pages, RSS and
// sitemap regenerate after a post change.
export async function republishBlog() {
  return supabase.functions
    .invoke('publish-site', { body: { locale: 'all', page: 'blog' } })
    .catch(() => ({ error: null }))
}
