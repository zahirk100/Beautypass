-- Let salons keep photos that are already on their profile (e.g. photos added by the BeautyPass team),
-- while new photos must still come from the salon's own storage folder. Safe to run again.
create or replace function public.update_salon_media(p_salon uuid, p_cover text, p_gallery text[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prefix text := '/storage/v1/object/public/salon-photos/' || p_salon::text || '/';
  v_existing text[];
  v_url text;
begin
  if not (public.is_salon_member(p_salon, true) or public.is_admin(array['ops']::public.admin_role[])) then
    raise exception 'Geen toegang';
  end if;
  if coalesce(array_length(p_gallery, 1), 0) > 8 then raise exception 'Maximaal 8 foto''s in de galerij'; end if;
  select gallery || array[cover_url] into v_existing from public.salons where id = p_salon;
  foreach v_url in array coalesce(p_gallery, '{}') || array[coalesce(p_cover, '')] loop
    if v_url <> '' and position(v_prefix in v_url) = 0 and not (v_url = any(coalesce(v_existing, '{}'))) then
      raise exception 'Ongeldige foto';
    end if;
  end loop;
  update public.salons set cover_url = coalesce(p_cover, ''), gallery = coalesce(p_gallery, '{}') where id = p_salon;
end $$;
