-- Multi-tenant foundation — Phase 0, step 2 (additive / non-breaking).
--
-- Adds a NULLABLE site_id to every content table + indexes, and the composite
-- unique(site_id, page_slug) the multi-tenant admin will use. The existing
-- page_slug unique constraint is intentionally KEPT so the currently deployed
-- admin's upsert(onConflict:'page_slug') keeps working until the coordinated
-- cutover. Nullable so existing INSERTs/queries are unaffected.
--
-- Backfilling site_id for the first tenant (Loricatus) is an instance-specific
-- DATA step, applied separately (see 0002_seed_loricatus below / repo notes),
-- not part of this schema migration.

alter table public.page_content     add column if not exists site_id uuid references public.sites(id);
alter table public.page_versions    add column if not exists site_id uuid references public.sites(id);
alter table public.assets           add column if not exists site_id uuid references public.sites(id);
alter table public.form_submissions add column if not exists site_id uuid references public.sites(id);

create index if not exists page_content_site_id_idx     on public.page_content (site_id);
create index if not exists page_versions_site_id_idx    on public.page_versions (site_id);
create index if not exists assets_site_id_idx           on public.assets (site_id);
create index if not exists form_submissions_site_id_idx on public.form_submissions (site_id);

-- Composite unique the multi-tenant admin will target with
-- upsert(onConflict:'site_id,page_slug'). Coexists with the existing page_slug
-- unique until the cutover migration drops the latter.
create unique index if not exists page_content_site_slug_uidx on public.page_content (site_id, page_slug);
