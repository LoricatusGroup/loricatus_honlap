-- Multi-tenant foundation — Phase 0, step 5 (additive / non-breaking; hardening).
--
-- Scopes current_membership()'s transitional auto-provision bridge to the
-- Loricatus tenant ONLY. The bridge trusts current_user_allowed(), which is the
-- Loricatus-specific legacy allowlist; without this guard a Loricatus-allowed
-- user could call current_membership(<some other site_id>) and self-provision an
-- editor+advanced membership on a DIFFERENT tenant. Harmless today (one site,
-- FK blocks unknown ids) but a cross-tenant privilege-escalation hole the moment
-- a second tenant exists. Scoping to slug='loricatus' closes it; the whole bridge
-- is removed at PHASE0_CUTOVER.md Step 6 once the invite flow is the sole path.
--
-- Behaviour for Loricatus is unchanged (still auto-provisions its allowed users).

create or replace function public.current_membership(p_site uuid)
returns table(role text, can_edit_advanced boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return; -- unauthenticated → no rows
  end if;

  if p_site = (select id from public.sites where slug = 'loricatus')
     and not exists (
        select 1 from public.memberships m
        where m.site_id = p_site and m.user_id = v_uid
      )
     and public.current_user_allowed() then
    insert into public.memberships (site_id, user_id, role, can_edit_advanced)
    values (p_site, v_uid, 'editor', true)
    on conflict (site_id, user_id) do nothing;
  end if;

  return query
    select m.role, m.can_edit_advanced
    from public.memberships m
    where m.site_id = p_site and m.user_id = v_uid;
end;
$$;

revoke execute on function public.current_membership(uuid) from anon, public;
grant  execute on function public.current_membership(uuid) to authenticated;
