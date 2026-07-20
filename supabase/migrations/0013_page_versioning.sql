-- M6: publish history + optimistic concurrency + one-click restore.
--
-- - page_content.rev: an optimistic-lock counter. save_page rejects a write
--   whose expected rev no longer matches (someone else saved meanwhile).
-- - page_versions: an immutable snapshot taken on every PUBLISH (who/when/what)
--   — the audit log + the restore points.
-- - restore_page_version: copies a snapshot back into the live draft.

-- 1. Optimistic-lock counter on the live content.
alter table public.page_content add column if not exists rev integer not null default 0;

-- 2. Complete the (previously unused) versions table.
alter table public.page_versions add column if not exists layout jsonb;
alter table public.page_versions add column if not exists created_by_email text;
alter table public.page_versions add column if not exists action text not null default 'publish';
create index if not exists page_versions_feed_idx
  on public.page_versions (site_id, page_slug, created_at desc);

-- 3. save_page — now returns the new rev and enforces optimistic concurrency.
--    Replaces the old 5-arg version; the extra arg defaults to NULL so an
--    already-deployed client (calling with 5 args) keeps working (no check).
drop function if exists public.save_page(uuid, text, jsonb, jsonb, jsonb);
create function public.save_page(
  p_site uuid, p_slug text, p_content jsonb, p_theme jsonb, p_layout jsonb,
  p_expected_rev integer default null
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_advanced   boolean := private.can_advanced(p_site);
  v_theme      jsonb   := coalesce(p_theme, '{}'::jsonb);
  v_layout     jsonb   := coalesce(p_layout, '{}'::jsonb);
  v_cur_theme  jsonb;
  v_cur_layout jsonb;
  v_cur_rev    integer;
  v_new_rev    integer;
begin
  if not private.is_member_of(p_site) then
    raise exception 'Not a member of this site' using errcode = '42501';
  end if;

  select theme, layout, rev into v_cur_theme, v_cur_layout, v_cur_rev
  from public.page_content where site_id = p_site and page_slug = p_slug;

  -- Optimistic concurrency: the editor loaded rev N; if the stored rev moved on,
  -- someone else saved in the meantime — reject rather than clobber their work.
  if p_expected_rev is not null and v_cur_rev is not null and v_cur_rev <> p_expected_rev then
    raise exception 'conflict: page changed by someone else (stored rev %, your rev %)',
      v_cur_rev, p_expected_rev using errcode = '40001';
  end if;

  -- Text-tier members cannot alter design: freeze theme/layout to stored values.
  if not v_advanced then
    v_theme  := coalesce(v_cur_theme, '{}'::jsonb);
    v_layout := coalesce(v_cur_layout, '{}'::jsonb);
  end if;

  v_new_rev := coalesce(v_cur_rev, 0) + 1;

  insert into public.page_content
    (site_id, page_slug, content, theme, layout, updated_by, updated_at, rev)
  values
    (p_site, p_slug, coalesce(p_content, '{}'::jsonb), v_theme, v_layout, (select auth.uid()), now(), v_new_rev)
  on conflict (site_id, page_slug) do update
    set content = excluded.content, theme = excluded.theme, layout = excluded.layout,
        updated_by = excluded.updated_by, updated_at = excluded.updated_at, rev = excluded.rev;

  return v_new_rev;
end;
$$;

-- 4. snapshot_version — record a publish into the history (called on publish).
create or replace function public.snapshot_version(p_site uuid, p_slug text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_email text := coalesce(auth.jwt() ->> 'email', '');
begin
  if not private.is_member_of(p_site) then
    raise exception 'Not a member of this site' using errcode = '42501';
  end if;
  insert into public.page_versions
    (site_id, page_slug, content, theme, layout, created_by, created_by_email, created_at, note, action)
  select site_id, page_slug, content, theme, layout,
         (select auth.uid()), v_email, now(), coalesce(p_note, ''), 'publish'
  from public.page_content
  where site_id = p_site and page_slug = p_slug;

  -- Bound growth: keep the 50 most recent snapshots per page.
  delete from public.page_versions v
  where v.site_id = p_site and v.page_slug = p_slug
    and v.id not in (
      select id from public.page_versions
      where site_id = p_site and page_slug = p_slug
      order by created_at desc limit 50
    );
end;
$$;

-- 5. restore_page_version — copy a snapshot back into the live draft.
create or replace function public.restore_page_version(p_site uuid, p_version_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_advanced boolean := private.can_advanced(p_site);
  v_ver public.page_versions%rowtype;
  v_cur_theme jsonb; v_cur_layout jsonb; v_cur_rev integer; v_new_rev integer;
  v_theme jsonb; v_layout jsonb;
begin
  if not private.is_member_of(p_site) then
    raise exception 'Not a member of this site' using errcode = '42501';
  end if;
  select * into v_ver from public.page_versions where id = p_version_id and site_id = p_site;
  if v_ver.id is null then raise exception 'Version not found'; end if;

  select theme, layout, rev into v_cur_theme, v_cur_layout, v_cur_rev
  from public.page_content where site_id = p_site and page_slug = v_ver.page_slug;

  v_theme  := coalesce(v_ver.theme, '{}'::jsonb);
  v_layout := coalesce(v_ver.layout, '{}'::jsonb);
  if not v_advanced then
    v_theme  := coalesce(v_cur_theme, '{}'::jsonb);
    v_layout := coalesce(v_cur_layout, '{}'::jsonb);
  end if;
  v_new_rev := coalesce(v_cur_rev, 0) + 1;

  insert into public.page_content
    (site_id, page_slug, content, theme, layout, updated_by, updated_at, rev)
  values
    (p_site, v_ver.page_slug, coalesce(v_ver.content, '{}'::jsonb), v_theme, v_layout, (select auth.uid()), now(), v_new_rev)
  on conflict (site_id, page_slug) do update
    set content = excluded.content, theme = excluded.theme, layout = excluded.layout,
        updated_by = excluded.updated_by, updated_at = excluded.updated_at, rev = excluded.rev;

  return v_new_rev;
end;
$$;

revoke execute on function public.save_page(uuid, text, jsonb, jsonb, jsonb, integer) from anon, public;
revoke execute on function public.snapshot_version(uuid, text, text) from anon, public;
revoke execute on function public.restore_page_version(uuid, uuid) from anon, public;
grant execute on function public.save_page(uuid, text, jsonb, jsonb, jsonb, integer) to authenticated;
grant execute on function public.snapshot_version(uuid, text, text) to authenticated;
grant execute on function public.restore_page_version(uuid, uuid) to authenticated;
