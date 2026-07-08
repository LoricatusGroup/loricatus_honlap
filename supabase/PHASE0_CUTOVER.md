# Phase 0 — RLS cutover runbook (PREPARED, NOT YET APPLIED)

Swaps the content tables from the legacy `current_user_allowed()` allowlist to
membership-based `private.is_member_of(site_id)` isolation. This is the one
**breaking** step of Phase 0: the moment it runs, the *old* admin (direct
`page_content` upsert) stops working, so the **new admin must be deployed first**.

Everything else in Phase 0 (migrations 0001–0004, memberships seed, save_page,
current_membership) is already applied and is additive — the live site is
unaffected until this runbook is executed.

## Why writes must stop going direct to the table

`save_page()` is the tier boundary: it lets a `can_edit_advanced = false` member
change `content` but freezes `theme`/`layout`. If `page_content` kept *any*
client-facing INSERT/UPDATE policy, a text-tier member could bypass that freeze
by writing the row directly via `/rest/v1/page_content`. Therefore the cutover
**removes all direct client writes** to `page_content`; the only write path is
the `save_page` SECURITY DEFINER RPC.

## Preconditions (all must hold before step 4)

1. New admin merged to `main` and deployed (deploy.yml), and smoke-tested in
   production: login → edit text → save → publish, with an `@loricatus.hu`
   account **and** a text-tier account. (The new admin works under the *old* RLS
   too, because `save_page` is a definer RPC — so you can bake it before cutover.)
2. A **fresh export** taken immediately before: run the `backup.yml` workflow
   (or `node scripts/export-tenant.js`) and confirm the artifact has
   `page_content: 3`.
3. `select count(*) from public.memberships` ≥ 7 and every person who must keep
   access has a row (query below).

```sql
-- who has access today vs who has a membership (should be identical set)
select u.email,
       (m.user_id is not null) as has_membership,
       m.role, m.can_edit_advanced
from auth.users u
left join public.memberships m
       on m.user_id = u.id
      and m.site_id = 'a7a65c78-972a-4d83-8983-bbce5e6c5a47'
order by u.email;
```

## Step 4 — the cutover migration (reviewed)

Apply as migration `0005_rls_cutover_content_tables`. All tables already have
RLS ENABLED (not FORCE — FORCE would break the definer helpers). Idempotent drops.

```sql
-- page_content: reads membership-scoped; NO direct client writes (save_page only)
drop policy if exists page_content_insert on public.page_content;
drop policy if exists page_content_update on public.page_content;
drop policy if exists page_content_select on public.page_content;
create policy page_content_select on public.page_content for select to authenticated
  using ((select private.is_member_of(site_id)));

-- page_versions: currently unused (0 rows, no writers); read membership-scoped,
-- no direct writes (a future versioning RPC will be SECURITY DEFINER).
drop policy if exists page_versions_insert on public.page_versions;
drop policy if exists page_versions_select on public.page_versions;
create policy page_versions_select on public.page_versions for select to authenticated
  using ((select private.is_member_of(site_id)));

-- assets: public read stays; writes membership-scoped. NOTE: the ImageUploader
-- must set assets.site_id and upload under the {site_id}/ storage prefix
-- (task #6) BEFORE this tightening, or uploads will fail the WITH CHECK.
drop policy if exists assets_insert on public.assets;
create policy assets_insert on public.assets for insert to authenticated
  with check ((select private.is_member_of(site_id)));
-- assets_select (USING true) is intentionally kept — site images are public.

-- form_submissions: members see only their tenant's leads. Public INSERT is kept
-- for the contact form (currently web3forms; the own-form/Turnstile work will
-- replace this policy to require a validated token + set site_id).
drop policy if exists form_submissions_select on public.form_submissions;
create policy form_submissions_select on public.form_submissions for select to authenticated
  using ((select private.is_member_of(site_id)));
```

> If task #6 (storage isolation) is not yet done when you cut over, keep the
> `assets_insert` block on `current_user_allowed()` instead, and tighten it with
> #6. The other three blocks are independent of #6 and safe to apply now.

## Step 5 — verify

1. `get_advisors(security)` → no new "RLS disabled" / exposed-definer findings.
2. New admin as an `@loricatus.hu` user: load (3 locales), edit text, save,
   publish — all succeed.
3. Text-tier account: no design controls; saving text works; theme/layout
   unchanged in the DB afterwards.
4. Cross-tenant negative test (simulate a member of a *different* site):
   `select … from page_content where site_id = '<loricatus>'` → 0 rows;
   `save_page('<loricatus>', …)` → `Not a member of this site`.
5. Direct-write bypass is closed: as a text-tier member, a direct
   `insert/update` on `/rest/v1/page_content` → denied by RLS.

## Rollback

Re-create the dropped policies with `current_user_allowed()` (the pre-cutover
definitions are recorded in git history / migration 0001-era state), and
redeploy the previous admin build. Because content rows are unchanged, rollback
is policy-only. Keep the pre-cutover export as the data safety net.

## Step 6 — retire the legacy path (AFTER cutover has baked)

Only once every needed user has a membership and the cutover is stable:
1. Remove the transitional bridge from `current_membership()` (the block that
   calls `current_user_allowed()` and auto-provisions).
2. `drop function public.current_user_allowed();` and `drop table public.allowed_users;`.
3. From then on, new users join only via the invite flow (Phase 1).
