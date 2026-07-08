-- Scope the assets TABLE read to site members (media library).
--
-- assets_select was USING(true) (any client could read every tenant's asset
-- metadata). The media-library picker queries assets by site_id, and the public
-- site loads images via the public storage endpoint (not this table), so
-- restricting SELECT to authenticated members is safe and closes cross-tenant
-- metadata reads.

drop policy if exists assets_select on public.assets;
create policy assets_select on public.assets for select to authenticated
  using ((select private.is_member_of(site_id)));
