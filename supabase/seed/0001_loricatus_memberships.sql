-- Instance-specific DATA step (NOT a schema migration) — applied to prod once.
--
-- Seeds public.memberships for the first tenant (Loricatus) from the *current*
-- access set, so the new membership-based authorization grants exactly the same
-- people access they have today under current_user_allowed(). Non-breaking:
-- nothing reads memberships until the coordinated RLS cutover.
--
--   * pr.nemes@gmail.com          -> owner,  can_edit_advanced = true
--   * every other allowed user    -> editor, can_edit_advanced = true
--
-- "Allowed" is resolved with the SAME predicate current_user_allowed() uses
-- (exact email OR '@<domain>' wildcard row in allowed_users), so the seed can
-- never grant more than today's gate. Idempotent (ON CONFLICT DO NOTHING) — safe
-- to re-run; it only ever adds rows for newly-registered allowed users.
--
-- NOTE: the '@loricatus.hu' wildcard only materializes into a membership once a
-- given person has actually signed in (a row exists in auth.users). New staff
-- who sign in later must be re-seeded (re-run this) or invited explicitly.

insert into public.memberships (site_id, user_id, role, can_edit_advanced)
select s.id,
       u.id,
       case when lower(u.email) = 'pr.nemes@gmail.com' then 'owner' else 'editor' end,
       true
from public.sites s
cross join auth.users u
where s.slug = 'loricatus'
  and exists (
    select 1 from public.allowed_users au
    where lower(au.email) = lower(u.email)
       or lower(au.email) = '@' || split_part(lower(u.email), '@', 2)
  )
on conflict (site_id, user_id) do nothing;
