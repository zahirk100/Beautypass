-- Salon profiles (photos, socials, opening hours), booking notes. Run after 003. Safe to run again.

alter table public.salons
  add column if not exists tagline text not null default '' check (char_length(tagline) <= 120),
  add column if not exists opening_hours text not null default '' check (char_length(opening_hours) <= 600),
  add column if not exists instagram text not null default '' check (char_length(instagram) <= 60),
  add column if not exists tiktok text not null default '' check (char_length(tiktok) <= 60),
  add column if not exists website text not null default '' check (char_length(website) <= 200),
  add column if not exists cover_url text not null default '',
  add column if not exists gallery text[] not null default '{}';

alter table public.bookings
  add column if not exists note text not null default '' check (char_length(note) <= 300);

-- ───────── Photo storage: public bucket, only the salon's own owners (or ops) can write ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('salon-photos', 'salon-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_edit_salon_media(p_path text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_salon uuid;
begin
  begin
    v_salon := split_part(p_path, '/', 1)::uuid;
  exception when others then
    return false;
  end;
  return public.is_salon_member(v_salon, true) or public.is_admin(array['ops']::public.admin_role[]);
end $$;

drop policy if exists "salon photos insert" on storage.objects;
drop policy if exists "salon photos update" on storage.objects;
drop policy if exists "salon photos delete" on storage.objects;
create policy "salon photos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'salon-photos' and public.can_edit_salon_media(name));
create policy "salon photos update" on storage.objects for update to authenticated
  using (bucket_id = 'salon-photos' and public.can_edit_salon_media(name));
create policy "salon photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'salon-photos' and public.can_edit_salon_media(name));

-- ───────── Salon profile editing by owners ─────────
create or replace function public.update_salon_details(
  p_salon uuid, p_tagline text, p_description text, p_address text, p_district text,
  p_postcode text, p_latitude double precision, p_longitude double precision,
  p_opening_hours text, p_instagram text, p_tiktok text, p_website text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_salon_member(p_salon, true) or public.is_admin(array['ops']::public.admin_role[])) then
    raise exception 'Geen toegang';
  end if;
  if coalesce(p_website, '') <> '' and p_website !~* '^https?://[^\s]+$' then
    raise exception 'Vul een geldige website in, bijvoorbeeld https://mijnsalon.nl';
  end if;
  update public.salons
     set tagline = left(coalesce(p_tagline, ''), 120),
         description = left(coalesce(p_description, ''), 2000),
         address = left(coalesce(p_address, ''), 200),
         district = left(coalesce(p_district, ''), 80),
         postcode = coalesce(left(p_postcode, 10), postcode),
         latitude = coalesce(p_latitude, latitude),
         longitude = coalesce(p_longitude, longitude),
         opening_hours = left(coalesce(p_opening_hours, ''), 600),
         instagram = left(regexp_replace(coalesce(p_instagram, ''), '[^A-Za-z0-9._]', '', 'g'), 60),
         tiktok = left(regexp_replace(coalesce(p_tiktok, ''), '[^A-Za-z0-9._]', '', 'g'), 60),
         website = left(coalesce(p_website, ''), 200)
   where id = p_salon;
end $$;

-- Photos must live in this salon's own folder of our bucket
create or replace function public.update_salon_media(p_salon uuid, p_cover text, p_gallery text[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prefix text := '/storage/v1/object/public/salon-photos/' || p_salon::text || '/';
  v_url text;
begin
  if not (public.is_salon_member(p_salon, true) or public.is_admin(array['ops']::public.admin_role[])) then
    raise exception 'Geen toegang';
  end if;
  if coalesce(array_length(p_gallery, 1), 0) > 8 then raise exception 'Maximaal 8 foto''s in de galerij'; end if;
  foreach v_url in array coalesce(p_gallery, '{}') || array[coalesce(p_cover, '')] loop
    if v_url <> '' and position(v_prefix in v_url) = 0 then raise exception 'Ongeldige foto'; end if;
  end loop;
  update public.salons set cover_url = coalesce(p_cover, ''), gallery = coalesce(p_gallery, '{}') where id = p_salon;
end $$;

-- ───────── Booking with a note for the salon ─────────
drop function if exists public.book_slot(uuid, uuid);
create or replace function public.book_slot(p_slot uuid, p_treatment uuid, p_note text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_slot public.slots;
  v_credits integer;
  v_payout integer;
  v_booking uuid;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  if not exists (select 1 from public.memberships where user_id = auth.uid() and status = 'active') then
    raise exception 'Je hebt geen actief membership';
  end if;

  select * into v_slot from public.slots where id = p_slot for update;
  if not found or v_slot.status <> 'open' or v_slot.starts_at <= now() then
    raise exception 'Dit tijdstip is niet meer beschikbaar';
  end if;
  if not exists (select 1 from public.salons where id = v_slot.salon_id and status = 'active') then
    raise exception 'Deze salon neemt nu geen boekingen aan';
  end if;

  select coalesce(st.credits_override, t.credits), st.payout_cents into v_credits, v_payout
  from public.salon_treatments st join public.treatments t on t.id = st.treatment_id
  where st.salon_id = v_slot.salon_id and st.treatment_id = p_treatment and st.active and t.active;
  if v_credits is null then raise exception 'Deze salon biedt deze behandeling niet aan'; end if;

  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  if public.credit_balance(auth.uid()) < v_credits then
    raise exception 'Niet genoeg credits (nodig: %)', v_credits;
  end if;

  insert into public.bookings (user_id, salon_id, slot_id, treatment_id, starts_at, credits, payout_cents, note)
  values (auth.uid(), v_slot.salon_id, v_slot.id, p_treatment, v_slot.starts_at, v_credits, v_payout, left(coalesce(p_note, ''), 300))
  returning id into v_booking;
  update public.slots set status = 'booked' where id = v_slot.id;
  insert into public.credit_ledger (user_id, delta, reason, booking_id, created_by)
  values (auth.uid(), -v_credits, 'booking', v_booking, auth.uid());
  return v_booking;
end $$;

drop function if exists public.salon_bookings(uuid, timestamptz, timestamptz);
create or replace function public.salon_bookings(p_salon uuid, p_from timestamptz, p_to timestamptz)
returns table (id uuid, starts_at timestamptz, status public.booking_status, treatment text, credits integer,
               payout_cents integer, member_name text, checked_in_at timestamptz, note text)
language sql stable security definer set search_path = public as $$
  select b.id, b.starts_at, b.status, t.name, b.credits, b.payout_cents,
         trim(p.first_name || ' ' || left(p.last_name, 1) || case when p.last_name <> '' then '.' else '' end),
         b.checked_in_at, b.note
  from public.bookings b
  join public.treatments t on t.id = b.treatment_id
  join public.profiles p on p.id = b.user_id
  where b.salon_id = p_salon and b.starts_at >= p_from and b.starts_at < p_to
    and (public.is_salon_member(p_salon) or public.is_admin())
  order by b.starts_at
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.handle_new_user(), public.protect_profile_role(), public.log_action(text, text, text, jsonb) from authenticated;
