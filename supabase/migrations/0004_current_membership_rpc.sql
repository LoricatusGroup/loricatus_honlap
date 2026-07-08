-- Multi-tenant foundation — Phase 0, step 4 (additive / non-breaking).
--
-- current_membership(site): the clean capability read the multi-tenant admin
-- uses to gate its UI, replacing the current_user_allowed() boolean. Returns the
-- caller's (role, can_edit_advanced) for the site, or NO rows if not a member.
--
-- TRANSITIONAL BRIDGE: if the caller has no membership yet but the legacy
-- allowlist (current_user_allowed) still grants them access, auto-provision an
-- advanced editor membership. This guarantees that during the cutover window no
-- existing Loricatus user — including @loricatus.hu staff who sign in for the
-- first time via the domain wildcard — is ever locked out. Remove this block
-- (and the allowed_users table) once the invite flow is the sole entry path.
--
-- SECURITY DEFINER so the membership read/auto-insert is not blocked by RLS.

create or replace function public.current_membership(p_site uuid)
returns table(role text, can_edit_advanced boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return; -- unauthenticated → no rows
  end if;

  if not exists (
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
