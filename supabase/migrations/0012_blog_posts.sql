-- M5: blog / article engine.
-- Per-site, per-locale posts. The publish pipeline reads published posts to
-- generate the blog index (newest first), each post page, the RSS feed and
-- sitemap entries. Writes go through member-gated SECURITY DEFINER RPCs
-- (a blog post is content, not a structural change, so no advanced gate).

create table if not exists public.blog_posts (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references public.sites(id) on delete cascade,
  locale       text not null default 'hu' check (locale in ('hu','en','it')),
  slug         text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,80}$'),
  title        text not null default '',
  excerpt      text not null default '',
  body         text not null default '',          -- rich HTML
  cover_url    text not null default '',
  tags         text[] not null default '{}',
  status       text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  author       text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (site_id, locale, slug)
);

create index if not exists blog_posts_feed_idx
  on public.blog_posts (site_id, locale, status, published_at desc);

alter table public.blog_posts enable row level security;

-- Members may read their site's posts (incl. drafts); the published HTML is
-- generated server-side by the pipeline. No direct write policy — all
-- mutations go through the RPCs below.
drop policy if exists blog_posts_sel on public.blog_posts;
create policy blog_posts_sel on public.blog_posts for select to authenticated
  using ((select private.is_member_of(site_id)));

-- Insert (p_id null) or update (p_id set) a post. Returns the post id.
create or replace function public.blog_upsert_post(
  p_site uuid, p_id uuid, p_locale text, p_slug text, p_title text,
  p_excerpt text, p_body text, p_cover text, p_tags text[], p_status text, p_author text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.is_member_of(p_site) then
    raise exception 'Not a member of this site' using errcode = '42501';
  end if;
  if coalesce(p_slug,'') !~ '^[a-z0-9][a-z0-9-]{0,80}$' then
    raise exception 'Invalid slug';
  end if;
  if coalesce(p_status,'draft') not in ('draft','published') then
    raise exception 'Invalid status';
  end if;
  if coalesce(p_locale,'hu') not in ('hu','en','it') then
    raise exception 'Invalid locale';
  end if;

  if p_id is null then
    insert into public.blog_posts
      (site_id, locale, slug, title, excerpt, body, cover_url, tags, status, published_at, author)
    values
      (p_site, coalesce(p_locale,'hu'), p_slug, coalesce(p_title,''), coalesce(p_excerpt,''),
       coalesce(p_body,''), coalesce(p_cover,''), coalesce(p_tags,'{}'::text[]),
       coalesce(p_status,'draft'),
       case when p_status = 'published' then now() else null end,
       coalesce(p_author,''))
    returning id into v_id;
  else
    update public.blog_posts set
      locale       = coalesce(p_locale, locale),
      slug         = p_slug,
      title        = coalesce(p_title,''),
      excerpt      = coalesce(p_excerpt,''),
      body         = coalesce(p_body,''),
      cover_url    = coalesce(p_cover,''),
      tags         = coalesce(p_tags,'{}'::text[]),
      status       = coalesce(p_status,'draft'),
      -- stamp published_at the first time it goes public; keep it after.
      published_at = case when p_status = 'published' and published_at is null then now()
                          else published_at end,
      author       = coalesce(p_author,''),
      updated_at   = now()
    where id = p_id and site_id = p_site
    returning id into v_id;
    if v_id is null then
      raise exception 'Post not found';
    end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.blog_delete_post(p_site uuid, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_member_of(p_site) then
    raise exception 'Not a member of this site' using errcode = '42501';
  end if;
  delete from public.blog_posts where id = p_id and site_id = p_site;
end;
$$;

revoke execute on function public.blog_upsert_post(uuid, uuid, text, text, text, text, text, text, text[], text, text) from anon, public;
revoke execute on function public.blog_delete_post(uuid, uuid) from anon, public;
grant execute on function public.blog_upsert_post(uuid, uuid, text, text, text, text, text, text, text[], text, text) to authenticated;
grant execute on function public.blog_delete_post(uuid, uuid) to authenticated;
