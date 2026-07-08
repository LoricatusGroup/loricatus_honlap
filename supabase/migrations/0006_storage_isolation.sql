-- Multi-tenant foundation — Phase 0, step 6: storage isolation.
--
-- The single 'assets' bucket is shared across tenants; objects are namespaced by
-- a {site_id}/ path prefix (admin/src/components/ImageUploader.tsx writes there).
-- storage.objects has RLS ENABLED but had NO policies, so authenticated writes
-- were effectively closed. These policies open member-scoped writes and isolate
-- tenants by the first path segment, while keeping reads public.
--
-- Reads stay public: site images are public and served via the public bucket
-- endpoint (/storage/v1/object/public/assets/...) which bypasses RLS regardless;
-- this SELECT policy just keeps the authenticated storage API consistent.

drop policy if exists assets_read on storage.objects;
create policy assets_read on storage.objects for select to public
  using (bucket_id = 'assets');

-- Writes: only a member of the site named by the first path segment ({site_id}/).
-- A path with no/invalid site segment yields is_member_of(null)=false → denied
-- (fails closed).
drop policy if exists assets_insert on storage.objects;
create policy assets_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'assets'
    and (select private.is_member_of(((storage.foldername(name))[1])::uuid))
  );

drop policy if exists assets_update on storage.objects;
create policy assets_update on storage.objects for update to authenticated
  using (
    bucket_id = 'assets'
    and (select private.is_member_of(((storage.foldername(name))[1])::uuid))
  )
  with check (
    bucket_id = 'assets'
    and (select private.is_member_of(((storage.foldername(name))[1])::uuid))
  );

drop policy if exists assets_delete on storage.objects;
create policy assets_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'assets'
    and (select private.is_member_of(((storage.foldername(name))[1])::uuid))
  );
