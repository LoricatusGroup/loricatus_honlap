-- Multi-tenant foundation — Phase 0, step 1.
--
-- ADDITIVE / NON-BREAKING: creates a `private` schema, tenant-check helper
-- functions, and the new tenant tables (sites/memberships/invites) with their
-- own RLS. It does NOT touch page_content/page_versions/assets/form_submissions
-- or their existing current_user_allowed()-based RLS, so the currently deployed
-- Loricatus admin keeps working unchanged. The breaking cutover (site_id +
-- swapping content-table RLS to is_member_of) is a later, coordinated migration.
--
-- Design note: these tables use ENABLE (not FORCE) row level security. The
-- SECURITY DEFINER helper is_member_of() intentionally bypasses RLS on
-- memberships (as table owner) to break policy recursion; FORCE would re-subject
-- the owner to RLS and reintroduce recursion. App clients connect as the
-- `authenticated` role (never the owner), so ENABLE already isolates them.

-- 1. Non-exposed schema for SECURITY DEFINER helpers (not in PostgREST db-schemas)
create schema if not exists private;
grant usage on schema private to authenticated;

-- 2. Tenant tables ---------------------------------------------------------------

create table if not exists public.sites (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  name           text not null,
  repo_full_name text,                                   -- "owner/repo" — server-side only
  primary_domain text,                                   -- server-side only
  locales        jsonb not null default '["hu"]'::jsonb,
  created_at     timestamptz not null default now()
);

create table if not exists public.memberships (
  site_id           uuid not null references public.sites(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  role              text not null default 'editor' check (role in ('owner','admin','editor')),
  can_edit_advanced boolean not null default false,
  created_at        timestamptz not null default now(),
  primary key (site_id, user_id)
);
create index if not exists memberships_user_id_idx on public.memberships (user_id);

create table if not exists public.invites (
  id                uuid primary key default gen_random_uuid(),
  site_id           uuid not null references public.sites(id) on delete cascade,
  email             text not null,
  role              text not null default 'editor' check (role in ('owner','admin','editor')),
  can_edit_advanced boolean not null default false,
  created_at        timestamptz not null default now(),
  accepted_at       timestamptz
);
create unique index if not exists invites_site_email_idx on public.invites (site_id, lower(email));

-- 3. Tenant-check helpers (private schema) --------------------------------------
-- All are SECURITY DEFINER + STABLE + search_path='' and self-scoped to the
-- caller via (select auth.uid()). Wrapping auth.uid() in a subselect lets the
-- planner evaluate it once per statement (initPlan), not per row.

create or replace function private.role_rank(r text)
returns int language sql immutable set search_path = '' as $$
  select case r when 'owner' then 3 when 'admin' then 2 when 'editor' then 1 else 0 end;
$$;

create or replace function private.is_member_of(target uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.site_id = target and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.can_advanced(target uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.site_id = target and m.user_id = (select auth.uid()) and m.can_edit_advanced
  );
$$;

create or replace function private.has_role(target uuid, min_role text)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.site_id = target and m.user_id = (select auth.uid())
      and private.role_rank(m.role) >= private.role_rank(min_role)
  );
$$;

-- Never callable from the public API surface; usable by signed-in callers
-- (needed so RLS policies referencing these can be evaluated as `authenticated`).
revoke execute on function private.is_member_of(uuid)      from public, anon;
revoke execute on function private.can_advanced(uuid)      from public, anon;
revoke execute on function private.has_role(uuid, text)    from public, anon;
grant  execute on function private.is_member_of(uuid)      to authenticated;
grant  execute on function private.can_advanced(uuid)      to authenticated;
grant  execute on function private.has_role(uuid, text)    to authenticated;

-- 4. RLS on the new tables (ENABLE, not FORCE — see design note) ----------------

alter table public.sites       enable row level security;
alter table public.memberships enable row level security;
alter table public.invites     enable row level security;

-- sites: a member can see only sites they belong to (no tenant enumeration).
create policy sites_select on public.sites
  for select to authenticated
  using ( (select private.is_member_of(id)) );

-- memberships: a user sees only their own membership rows; admins of the site
-- can see all of that site's members.
create policy memberships_select on public.memberships
  for select to authenticated
  using ( user_id = (select auth.uid()) or (select private.has_role(site_id, 'admin')) );

create policy memberships_admin_write on public.memberships
  for all to authenticated
  using      ( (select private.has_role(site_id, 'admin')) )
  with check ( (select private.has_role(site_id, 'admin')) );

-- invites: only site admins can see/manage invites for their site.
create policy invites_admin_all on public.invites
  for all to authenticated
  using      ( (select private.has_role(site_id, 'admin')) )
  with check ( (select private.has_role(site_id, 'admin')) );

-- Note: sites/invites writes and membership creation on invite-accept are done
-- server-side with the service role (provisioning + Edge Functions), which
-- bypasses RLS. No anon policies anywhere → anonymous access is fully denied.
