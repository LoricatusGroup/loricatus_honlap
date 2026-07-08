-- Multi-tenant foundation — Phase 0, step 3 (additive / non-breaking).
--
-- save_page(): the controlled write path the multi-tenant admin will call
-- instead of a direct page_content upsert. It enforces, SERVER-SIDE:
--   * the caller must be a member of the target site;
--   * a member WITHOUT can_edit_advanced may change `content` (text) only —
--     any theme/layout change is silently discarded (kept at stored values).
-- This makes the "text-only" tier a real security boundary, not just UI.
--
-- SECURITY DEFINER so it can write page_content under its own rules regardless
-- of table RLS. Additive: nothing calls it until the new admin ships.

create or replace function public.save_page(
  p_site uuid, p_slug text, p_content jsonb, p_theme jsonb, p_layout jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_advanced   boolean := private.can_advanced(p_site);
  v_theme      jsonb   := coalesce(p_theme, '{}'::jsonb);
  v_layout     jsonb   := coalesce(p_layout, '{}'::jsonb);
  v_cur_theme  jsonb;
  v_cur_layout jsonb;
begin
  if not private.is_member_of(p_site) then
    raise exception 'Not a member of this site' using errcode = '42501';
  end if;

  select theme, layout into v_cur_theme, v_cur_layout
  from public.page_content
  where site_id = p_site and page_slug = p_slug;

  -- Text-tier members cannot alter design: freeze theme/layout to stored values.
  if not v_advanced then
    v_theme  := coalesce(v_cur_theme, '{}'::jsonb);
    v_layout := coalesce(v_cur_layout, '{}'::jsonb);
  end if;

  insert into public.page_content
    (site_id, page_slug, content, theme, layout, updated_by, updated_at)
  values
    (p_site, p_slug, coalesce(p_content, '{}'::jsonb), v_theme, v_layout, (select auth.uid()), now())
  on conflict (site_id, page_slug) do update
    set content    = excluded.content,
        theme      = excluded.theme,
        layout     = excluded.layout,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;
end;
$$;

revoke execute on function public.save_page(uuid, text, jsonb, jsonb, jsonb) from anon, public;
grant  execute on function public.save_page(uuid, text, jsonb, jsonb, jsonb) to authenticated;
