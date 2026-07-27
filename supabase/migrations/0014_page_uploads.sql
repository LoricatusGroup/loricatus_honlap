-- M7: complete-HTML page uploads.
--
-- An editor can create a page whose body is a ready-made HTML file (typically
-- AI-generated) instead of a CMS template. One upload per (page, locale), so a
-- page can carry a HU/EN/IT variant. `mode` decides how the publish pipeline
-- renders it:
--   'shell'      → the uploaded body is placed inside the site shell (nav +
--                  footer + site stylesheet), so the page stays navigable.
--   'standalone' → the uploaded document is served as-is (its own design);
--                  only canonical/hreflang are injected for SEO.
--
-- Uploads are structural (they define a whole page), so writing them requires
-- the advanced capability — same gate as create_page.

create table if not exists public.page_uploads (
  site_id    uuid not null references public.sites(id) on delete cascade,
  page_id    text not null,
  locale     text not null default 'hu' check (locale in ('hu','en','it')),
  html       text not null default '',
  mode       text not null default 'shell' check (mode in ('shell','standalone')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key (site_id, page_id, locale)
);

alter table public.page_uploads enable row level security;

-- Members may read their site's uploads (the editor lists/previews them). All
-- writes go through the RPCs below.
drop policy if exists page_uploads_sel on public.page_uploads;
create policy page_uploads_sel on public.page_uploads for select to authenticated
  using ((select private.is_member_of(site_id)));

-- Store (or replace) the uploaded HTML for one page + locale.
create or replace function public.upload_page_html(
  p_site uuid, p_id text, p_locale text, p_html text, p_mode text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_member_of(p_site) then
    raise exception 'Not a member of this site' using errcode = '42501';
  end if;
  if not private.can_advanced(p_site) then
    raise exception 'Advanced permission required' using errcode = '42501';
  end if;
  if coalesce(p_locale, 'hu') not in ('hu', 'en', 'it') then
    raise exception 'Invalid locale';
  end if;
  if coalesce(p_mode, 'shell') not in ('shell', 'standalone') then
    raise exception 'Invalid mode';
  end if;
  -- The page must be an editor-created page; uploads never overwrite the
  -- hand-built base pages (home, referenciak, ...).
  if not exists (
    select 1 from public.site_pages s where s.site_id = p_site and s.page_id = p_id
  ) then
    raise exception 'Unknown page';
  end if;
  if coalesce(length(p_html), 0) = 0 then
    raise exception 'Empty upload';
  end if;
  if length(p_html) > 2000000 then
    raise exception 'Upload too large (max 2 MB)';
  end if;

  insert into public.page_uploads (site_id, page_id, locale, html, mode, updated_at, updated_by)
  values (p_site, p_id, coalesce(p_locale, 'hu'), p_html, coalesce(p_mode, 'shell'),
          now(), (select auth.uid()))
  on conflict (site_id, page_id, locale) do update
    set html = excluded.html, mode = excluded.mode,
        updated_at = excluded.updated_at, updated_by = excluded.updated_by;
end;
$$;

create or replace function public.delete_page_upload(p_site uuid, p_id text, p_locale text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_member_of(p_site) then
    raise exception 'Not a member of this site' using errcode = '42501';
  end if;
  if not private.can_advanced(p_site) then
    raise exception 'Advanced permission required' using errcode = '42501';
  end if;
  delete from public.page_uploads
  where site_id = p_site and page_id = p_id and locale = coalesce(p_locale, 'hu');
end;
$$;

revoke execute on function public.upload_page_html(uuid, text, text, text, text) from anon, public;
revoke execute on function public.delete_page_upload(uuid, text, text) from anon, public;
grant execute on function public.upload_page_html(uuid, text, text, text, text) to authenticated;
grant execute on function public.delete_page_upload(uuid, text, text) to authenticated;
