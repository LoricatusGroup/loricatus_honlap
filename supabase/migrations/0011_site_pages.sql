-- M2: editor-created pages.
-- A per-site registry of dynamically-created pages (beyond the hand-authored
-- base pages in pages.json). The publish pipeline reads this to scaffold the
-- page HTML, sync navigation, and generate the sitemap. Writes go through
-- advanced-gated RPCs only (never direct), mirroring save_page.

create table if not exists public.site_pages (
  site_id    uuid    not null references public.sites(id) on delete cascade,
  page_id    text    not null check (page_id ~ '^[a-z0-9][a-z0-9-]{0,48}$'),
  template   text    not null default 'text',
  nav        jsonb   not null default '{}'::jsonb,   -- { hu, en, it } labels
  in_nav     boolean not null default true,
  sort_order int     not null default 100,
  created_at timestamptz not null default now(),
  primary key (site_id, page_id)
);

alter table public.site_pages enable row level security;

-- Members may read their site's pages; there is no direct write policy — all
-- mutations go through the SECURITY DEFINER RPCs below.
drop policy if exists site_pages_sel on public.site_pages;
create policy site_pages_sel on public.site_pages for select to authenticated
  using ((select private.is_member_of(site_id)));

-- Reserved ids that would collide with existing paths/base pages.
create or replace function private.is_reserved_page_id(p_id text)
returns boolean language sql immutable set search_path = '' as $$
  select p_id in ('home','index','en','it','admin','admin-app','assets',
                  'sections','scripts','supabase','tudastar','adatvedelem',
                  'cookie-szabalyzat','referenciak');
$$;

create or replace function public.create_page(p_site uuid, p_id text, p_template text, p_nav jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_member_of(p_site) then
    raise exception 'Not a member of this site' using errcode = '42501';
  end if;
  if not private.can_advanced(p_site) then
    raise exception 'Advanced permission required' using errcode = '42501';
  end if;
  if p_id !~ '^[a-z0-9][a-z0-9-]{0,48}$' then
    raise exception 'Invalid page id';
  end if;
  if private.is_reserved_page_id(p_id) then
    raise exception 'Reserved page id';
  end if;
  insert into public.site_pages (site_id, page_id, template, nav, in_nav, sort_order)
  values (
    p_site, p_id, coalesce(nullif(p_template, ''), 'text'), coalesce(p_nav, '{}'::jsonb), true,
    coalesce((select max(sort_order) + 10 from public.site_pages where site_id = p_site), 100)
  )
  on conflict (site_id, page_id) do nothing;
end;
$$;

create or replace function public.rename_page(p_site uuid, p_id text, p_nav jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_advanced(p_site) then
    raise exception 'Advanced permission required' using errcode = '42501';
  end if;
  update public.site_pages set nav = coalesce(p_nav, '{}'::jsonb)
  where site_id = p_site and page_id = p_id;
end;
$$;

create or replace function public.delete_page(p_site uuid, p_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_advanced(p_site) then
    raise exception 'Advanced permission required' using errcode = '42501';
  end if;
  delete from public.site_pages where site_id = p_site and page_id = p_id;
  -- Drop the page's content rows for every locale (slug = id, id-en, id-it).
  delete from public.page_content
  where site_id = p_site and (page_slug = p_id or page_slug like p_id || '-%');
end;
$$;

create or replace function public.reorder_pages(p_site uuid, p_ids text[])
returns void language plpgsql security definer set search_path = '' as $$
declare i int;
begin
  if not private.can_advanced(p_site) then
    raise exception 'Advanced permission required' using errcode = '42501';
  end if;
  for i in 1 .. coalesce(array_length(p_ids, 1), 0) loop
    update public.site_pages set sort_order = i * 10
    where site_id = p_site and page_id = p_ids[i];
  end loop;
end;
$$;

revoke execute on function public.create_page(uuid, text, text, jsonb) from anon, public;
revoke execute on function public.rename_page(uuid, text, jsonb) from anon, public;
revoke execute on function public.delete_page(uuid, text) from anon, public;
revoke execute on function public.reorder_pages(uuid, text[]) from anon, public;
grant execute on function public.create_page(uuid, text, text, jsonb) to authenticated;
grant execute on function public.rename_page(uuid, text, jsonb) to authenticated;
grant execute on function public.delete_page(uuid, text) to authenticated;
grant execute on function public.reorder_pages(uuid, text[]) to authenticated;
