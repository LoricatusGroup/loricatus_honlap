-- Flip an existing upload between 'shell' and 'standalone' without re-sending
-- the whole document (the editor only holds the upload's metadata, not its HTML).

create or replace function public.set_page_upload_mode(
  p_site uuid, p_id text, p_locale text, p_mode text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_member_of(p_site) then
    raise exception 'Not a member of this site' using errcode = '42501';
  end if;
  if not private.can_advanced(p_site) then
    raise exception 'Advanced permission required' using errcode = '42501';
  end if;
  if coalesce(p_mode, '') not in ('shell', 'standalone') then
    raise exception 'Invalid mode';
  end if;

  update public.page_uploads
     set mode = p_mode, updated_at = now(), updated_by = (select auth.uid())
   where site_id = p_site and page_id = p_id and locale = coalesce(p_locale, 'hu');
  if not found then
    raise exception 'No upload for this page/locale';
  end if;
end;
$$;

revoke execute on function public.set_page_upload_mode(uuid, text, text, text) from anon, public;
grant execute on function public.set_page_upload_mode(uuid, text, text, text) to authenticated;
