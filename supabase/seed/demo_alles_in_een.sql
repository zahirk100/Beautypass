-- BeautyPass: locaties, salonprofielen, foto's + demodata in één keer. Plak dit volledige bestand in Supabase → SQL Editor → Run.
-- Vereist: 001_waitlist.sql en 002_platform.sql zijn al uitgevoerd. Veilig om opnieuw te draaien.

-- Locations (postcode + coordinates), favourites and public ratings. Run after 002_platform.sql.

alter table public.salons
  add column if not exists postcode text not null default '',
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists is_demo boolean not null default false;

alter table public.profiles
  add column if not exists postcode text check (postcode is null or char_length(postcode) <= 10),
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

-- Favourite salons per member
create table if not exists public.favorites (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  salon_id   uuid not null references public.salons (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, salon_id)
);
alter table public.favorites enable row level security;
revoke all on public.favorites from anon;
drop policy if exists "favorites own" on public.favorites;
create policy "favorites own" on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Average rating per salon, readable by every logged-in user
create or replace function public.salon_ratings()
returns table (salon_id uuid, avg_rating numeric, review_count integer)
language sql stable security definer set search_path = public as $$
  select r.salon_id, round(avg(r.rating)::numeric, 1), count(*)::integer
  from public.reviews r
  join public.salons s on s.id = r.salon_id
  where s.status = 'active' or public.is_salon_member(s.id) or public.is_admin()
  group by r.salon_id
$$;

-- Latest reviews of an active salon, with only the reviewer's first name
create or replace function public.salon_recent_reviews(p_salon uuid, p_limit integer default 5)
returns table (rating integer, comment text, created_at timestamptz, reviewer text)
language sql stable security definer set search_path = public as $$
  select r.rating, r.comment, r.created_at, coalesce(nullif(p.first_name, ''), 'Member')
  from public.reviews r
  join public.salons s on s.id = r.salon_id
  join public.profiles p on p.id = r.user_id
  where r.salon_id = p_salon and (s.status = 'active' or public.is_salon_member(s.id) or public.is_admin())
  order by r.created_at desc
  limit least(greatest(p_limit, 1), 20)
$$;

-- Salon owners also manage their location
drop function if exists public.update_salon_profile(uuid, text, text, text);
create or replace function public.update_salon_profile(
  p_salon uuid, p_description text, p_address text, p_district text,
  p_postcode text default null, p_latitude double precision default null, p_longitude double precision default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_salon_member(p_salon, true) or public.is_admin(array['ops']::public.admin_role[])) then
    raise exception 'Geen toegang';
  end if;
  update public.salons
     set description = left(coalesce(p_description, ''), 2000),
         address = left(coalesce(p_address, ''), 200),
         district = left(coalesce(p_district, ''), 80),
         postcode = coalesce(left(p_postcode, 10), postcode),
         latitude = coalesce(p_latitude, latitude),
         longitude = coalesce(p_longitude, longitude)
   where id = p_salon;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.handle_new_user(), public.protect_profile_role(), public.log_action(text, text, text, jsonb) from authenticated;
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
-- BeautyPass demo data: test accounts per role, salons across Amsterdam, availability, bookings and reviews.
-- Run in the Supabase SQL Editor AFTER the migrations 001–003. Running it again resets all demo data
-- (fresh availability for the next 2 weeks). Remove everything with demo_cleanup.sql before launch.
-- All demo accounts use the password: Demo2026!

-- 0. Check that the migrations have been run first
do $$
begin
  if to_regclass('public.salons') is null then
    raise exception 'Voer eerst supabase/migrations/002_platform.sql uit, daarna 003_locations_favorites.sql, en dan pas dit demoscript.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'salons' and column_name = 'is_demo') then
    raise exception 'Voer eerst supabase/migrations/003_locations_favorites.sql uit, en dan pas dit demoscript.';
  end if;
end $$;

-- 1. Reset previous demo data
delete from public.bookings
 where salon_id in (select id from public.salons where is_demo)
    or user_id in (select id from auth.users where email like 'demo.%@example.com');
delete from public.slots where salon_id in (select id from public.salons where is_demo);
delete from public.salons where is_demo;
delete from auth.users where email like 'demo.%@example.com';

do $$
declare
  pw text := extensions.crypt('Demo2026!', extensions.gen_salt('bf'));
  u record;
  s record;
  tr record;
  d integer;
  hr integer;
  day date;
  ts timestamptz;
  v_slot uuid;
  v_booking uuid;
  v_member uuid;
  v_plan record;
  i integer := 0;
  reviewers uuid[];
  comments text[] := array[
    'Super fijne ervaring, ik kom zeker terug!', 'Heel netjes gewerkt en een mooie salon.',
    'Precies wat ik wilde, top!', 'Rustige sfeer en heel vriendelijk ontvangen.',
    'Mooi resultaat, wel even gewacht bij binnenkomst.', 'Mijn nieuwe vaste plek!', ''];
begin
  perform setseed(0.42);

  -- 2. Demo accounts (auth users + e-mail identities); the profile is created by the trigger
  for u in
    select * from (values
      ('d0000000-0000-0000-0000-000000000001'::uuid, 'demo.ops@example.com',     'Olga',   'Ops',       null::text, 'ops'::text),
      ('d0000000-0000-0000-0000-000000000002'::uuid, 'demo.support@example.com', 'Sem',    'Support',   null, 'support'),
      ('d0000000-0000-0000-0000-000000000003'::uuid, 'demo.finance@example.com', 'Fenna',  'Finance',   null, 'finance'),
      ('d0000000-0000-0000-0000-000000000011'::uuid, 'demo.noor@example.com',    'Noor',   'El Amrani', null, null),
      ('d0000000-0000-0000-0000-000000000012'::uuid, 'demo.mila@example.com',    'Mila',   'Jansen',    null, null),
      ('d0000000-0000-0000-0000-000000000013'::uuid, 'demo.eva@example.com',     'Eva',    'de Groot',  null, null),
      ('d0000000-0000-0000-0000-000000000021'::uuid, 'demo.sophie@example.com',  'Sophie', 'de Vries',  '1072LN', null),
      ('d0000000-0000-0000-0000-000000000022'::uuid, 'demo.lisa@example.com',    'Lisa',   'Bakker',    '1053ED', null),
      ('d0000000-0000-0000-0000-000000000023'::uuid, 'demo.amira@example.com',   'Amira',  'Kaddouri',  '1094HJ', null),
      ('d0000000-0000-0000-0000-000000000024'::uuid, 'demo.fleur@example.com',   'Fleur',  'Visser',    '1015MN', null),
      ('d0000000-0000-0000-0000-000000000025'::uuid, 'demo.julia@example.com',   'Julia',  'Smit',      '1082ME', null),
      ('d0000000-0000-0000-0000-000000000026'::uuid, 'demo.noa@example.com',     'Noa',    'Peters',    '1017VP', null),
      ('d0000000-0000-0000-0000-000000000027'::uuid, 'demo.yasmin@example.com',  'Yasmin', 'Benali',    '1031CV', null)
    ) as t(id, email, first_name, last_name, postcode, admin_role)
  loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, pw, now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('first_name', u.first_name, 'last_name', u.last_name),
            now() - interval '60 days', now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now());
    update public.profiles
       set postcode = u.postcode,
           admin_role = u.admin_role::public.admin_role,
           phone = case when u.postcode is not null then '06' || lpad((floor(random() * 1e8))::bigint::text, 8, '0') end
     where id = u.id;
  end loop;

  -- Approximate coordinates for the members' postcodes
  update public.profiles p set latitude = v.lat, longitude = v.lng
  from (values ('1072LN', 52.3546, 4.8916), ('1053ED', 52.3664, 4.8697), ('1094HJ', 52.3637, 4.9392),
               ('1015MN', 52.3782, 4.8818), ('1082ME', 52.3382, 4.8735), ('1017VP', 52.3623, 4.8972),
               ('1031CV', 52.3902, 4.9147)) as v(pc, lat, lng)
  where p.postcode = v.pc and p.id::text like 'd0000000-%';

  -- 3. Salons across Amsterdam (fictional names)
  insert into public.salons (id, name, district, address, postcode, latitude, longitude, description, contact_name, contact_email, contact_phone, status, notes, is_demo) values
    ('5a000000-0000-0000-0000-000000000001', 'Studio Noor', 'De Pijp', 'Ferdinand Bolstraat 120', '1072LN', 52.3546, 4.8916,
     'Lichte, rustige nagelstudio in het hart van De Pijp. Gespecialiseerd in BIAB en natuurlijke looks, met de beste koffie van de buurt.', 'Noor El Amrani', 'demo.noor@example.com', '020 123 4501', 'active', 'Contract getekend. Wil vooral dinsdag- en woensdagochtend vullen.', true),
    ('5a000000-0000-0000-0000-000000000002', 'Maison Eva', 'Oud-Zuid', 'Cornelis Schuytstraat 30', '1071JK', 52.3529, 4.8742,
     'Boutique voor brows & lashes. Persoonlijk advies en een ontspannen sfeer.', 'Eva de Groot', 'demo.eva@example.com', '020 123 4502', 'active', '', true),
    ('5a000000-0000-0000-0000-000000000003', 'Blow Bar West', 'Oud-West', 'Kinkerstraat 200', '1053ED', 52.3657, 4.8697,
     'Snelle, perfecte blowouts. Binnen 45 minuten klaar voor je avond.', 'Sam Mulder', 'sam@example.com', '020 123 4503', 'active', '', true),
    ('5a000000-0000-0000-0000-000000000004', 'Nail Atelier Jordaan', 'Jordaan', 'Westerstraat 80', '1015MN', 52.3780, 4.8820,
     'Klein atelier aan de Westerstraat met oog voor detail. Gellak en BIAB in alle seizoenskleuren.', 'Iris de Boer', 'iris@example.com', '020 123 4504', 'active', '', true),
    ('5a000000-0000-0000-0000-000000000005', 'Glow Studio Oost', 'Oost', 'Javastraat 60', '1094HJ', 52.3638, 4.9390,
     'All-round beautystudio in Oost: nagels, pedicure, brows en lashes onder één dak.', 'Leila Haddou', 'leila@example.com', '020 123 4505', 'active', '', true),
    ('5a000000-0000-0000-0000-000000000006', 'The Brow Room', 'Centrum', 'Utrechtsestraat 40', '1017VP', 52.3625, 4.8970,
     'Brow specialists in de Utrechtsestraat. Lamination, shapen en tinten.', 'Eva de Groot', 'demo.eva@example.com', '020 123 4506', 'active', 'Tweede vestiging van Eva.', true),
    ('5a000000-0000-0000-0000-000000000007', 'Salon Lumière', 'Zuidas', 'Gustav Mahlerlaan 300', '1082ME', 52.3380, 4.8730,
     'Premium salon op de Zuidas. Ideaal voor een blowout of manicure vóór of na het werk.', 'Claire Dubois', 'claire@example.com', '020 123 4507', 'active', '', true),
    ('5a000000-0000-0000-0000-000000000008', 'Pedi & Polish Noord', 'Noord', 'Van der Pekstraat 50', '1031CV', 52.3900, 4.9150,
     'Gezellige salon in Noord voor pedicures en gellak. Vlak bij de pont.', 'Yara Bos', 'yara@example.com', '020 123 4508', 'active', '', true),
    ('5a000000-0000-0000-0000-000000000009', 'Hair & Glow IJburg', 'IJburg', 'IJburglaan 600', '1087BG', 52.3545, 4.9985,
     'Licht en ruim aan het water. Blowouts en brows.', 'Mara Vos', 'mara@example.com', '020 123 4509', 'active', '', true),
    ('5a000000-0000-0000-0000-000000000010', 'Beauty Lab Westerpark', 'Westerpark', 'Haarlemmerweg 300', '1051LH', 52.3866, 4.8720,
     'In gesprek.', 'Tess Kok', 'tess@example.com', '020 123 4510', 'lead', 'Proefbezoek gepland. Vraagt 80% van de normale prijs.', true),
    ('5a000000-0000-0000-0000-000000000011', 'Studio Sol', 'Nieuw-West', 'Osdorpplein 100', '1068EV', 52.3590, 4.8000,
     'Tijdelijk gepauzeerd.', 'Sol Martens', 'sol@example.com', '020 123 4511', 'paused', 'Gepauzeerd i.v.m. verbouwing.', true);

  -- 4. Treatments per salon (default credits and payout)
  insert into public.salon_treatments (salon_id, treatment_id, payout_cents, active)
  select m.salon_id::uuid, t.id, t.default_payout_cents, true
  from (values
    ('5a000000-0000-0000-0000-000000000001', 'gellak'), ('5a000000-0000-0000-0000-000000000001', 'biab'), ('5a000000-0000-0000-0000-000000000001', 'pedicure'),
    ('5a000000-0000-0000-0000-000000000002', 'brow-lamination'), ('5a000000-0000-0000-0000-000000000002', 'lash-lift'),
    ('5a000000-0000-0000-0000-000000000003', 'blowout'),
    ('5a000000-0000-0000-0000-000000000004', 'gellak'), ('5a000000-0000-0000-0000-000000000004', 'biab'),
    ('5a000000-0000-0000-0000-000000000005', 'biab'), ('5a000000-0000-0000-0000-000000000005', 'pedicure'), ('5a000000-0000-0000-0000-000000000005', 'brow-lamination'), ('5a000000-0000-0000-0000-000000000005', 'lash-lift'),
    ('5a000000-0000-0000-0000-000000000006', 'brow-lamination'), ('5a000000-0000-0000-0000-000000000006', 'lash-lift'),
    ('5a000000-0000-0000-0000-000000000007', 'blowout'), ('5a000000-0000-0000-0000-000000000007', 'gellak'), ('5a000000-0000-0000-0000-000000000007', 'biab'),
    ('5a000000-0000-0000-0000-000000000008', 'gellak'), ('5a000000-0000-0000-0000-000000000008', 'pedicure'),
    ('5a000000-0000-0000-0000-000000000009', 'blowout'), ('5a000000-0000-0000-0000-000000000009', 'brow-lamination'),
    ('5a000000-0000-0000-0000-000000000010', 'gellak'), ('5a000000-0000-0000-0000-000000000011', 'blowout')
  ) as m(salon_id, slug)
  join public.treatments t on t.slug = m.slug;
  -- A premium salon charges a little more
  update public.salon_treatments set credits_override = 45, payout_cents = 3800
   where salon_id = '5a000000-0000-0000-0000-000000000007' and treatment_id = (select id from public.treatments where slug = 'blowout');

  -- 5. Salon teams: Noor owns Studio Noor (Mila works there), Eva owns two salons
  insert into public.salon_members (salon_id, user_id, role) values
    ('5a000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000011', 'owner'),
    ('5a000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000012', 'staff'),
    ('5a000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000013', 'owner'),
    ('5a000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000013', 'owner');

  -- 6. Memberships: active, pending, paused and none
  insert into public.memberships (user_id, plan_id, status, founding_number, started_at, current_period_end)
  select v.user_id::uuid, p.id, v.status::public.membership_status, v.founding,
         case when v.status <> 'pending' then now() - interval '25 days' end,
         case when v.status <> 'pending' then now() + interval '5 days' end
  from (values
    ('d0000000-0000-0000-0000-000000000021', 'signature', 'active', 1),
    ('d0000000-0000-0000-0000-000000000024', 'luxe',      'active', 2),
    ('d0000000-0000-0000-0000-000000000025', 'signature', 'paused', 3),
    ('d0000000-0000-0000-0000-000000000026', 'essential', 'active', null),
    ('d0000000-0000-0000-0000-000000000027', 'signature', 'active', null),
    ('d0000000-0000-0000-0000-000000000022', 'essential', 'pending', null)
  ) as v(user_id, plan, status, founding)
  join public.plans p on p.slug = v.plan;

  insert into public.credit_ledger (user_id, delta, reason, note, created_at)
  select m.user_id, p.monthly_credits, 'monthly_grant', 'Start membership ' || p.name, m.started_at
  from public.memberships m join public.plans p on p.id = m.plan_id
  where m.status in ('active', 'paused') and m.user_id::text like 'd0000000-%';

  -- 7. Open availability for the next 14 days (Mon–Sat, 09:00–17:00)
  for s in select id from public.salons where is_demo and status = 'active' loop
    for d in 0..13 loop
      day := (now() at time zone 'Europe/Amsterdam')::date + d;
      continue when extract(dow from day) = 0;
      for hr in 9..17 loop
        ts := (day + make_time(hr, 0, 0)) at time zone 'Europe/Amsterdam';
        if ts > now() + interval '1 hour' and random() < 0.55 then
          insert into public.slots (salon_id, starts_at, ends_at) values (s.id, ts, ts + interval '1 hour');
        end if;
      end loop;
    end loop;
  end loop;

  -- 8. Past completed bookings with reviews (gives ratings, payouts and dashboard numbers)
  reviewers := array['d0000000-0000-0000-0000-000000000021', 'd0000000-0000-0000-0000-000000000024',
                     'd0000000-0000-0000-0000-000000000026', 'd0000000-0000-0000-0000-000000000027']::uuid[];
  for s in select id from public.salons where is_demo and status = 'active' loop
    for tr in
      select t.id, coalesce(st.credits_override, t.credits) as credits, st.payout_cents
      from public.salon_treatments st join public.treatments t on t.id = st.treatment_id
      where st.salon_id = s.id
    loop
      for d in 1..2 loop
        i := i + 1;
        v_member := reviewers[1 + (i % array_length(reviewers, 1))];
        ts := (((now() at time zone 'Europe/Amsterdam')::date - (1 + floor(random() * 20))::int) + make_time(10 + (i % 7), 0, 0)) at time zone 'Europe/Amsterdam';
        insert into public.slots (salon_id, starts_at, ends_at, status) values (s.id, ts, ts + interval '1 hour', 'booked') returning id into v_slot;
        insert into public.bookings (user_id, salon_id, slot_id, treatment_id, starts_at, credits, payout_cents, status, checked_in_at)
        values (v_member, s.id, v_slot, tr.id, ts, tr.credits, tr.payout_cents,
                case when i % 11 = 0 then 'no_show' else 'completed' end::public.booking_status, ts)
        returning id into v_booking;
        insert into public.credit_ledger (user_id, delta, reason, booking_id, created_at) values (v_member, -tr.credits, 'booking', v_booking, ts);
        if i % 11 <> 0 and random() < 0.8 then
          insert into public.reviews (booking_id, user_id, salon_id, rating, comment, created_at)
          values (v_booking, v_member, s.id, case when random() < 0.7 then 5 else 4 end,
                  comments[1 + floor(random() * array_length(comments, 1))::int], ts + interval '3 hours');
        end if;
      end loop;
    end loop;
  end loop;

  -- 9. Upcoming bookings (including one right now, so the salon can test "Voltooid" / "No-show")
  for tr in
    select * from (values
      -- day offset / local hour; null = right now
      ('d0000000-0000-0000-0000-000000000024'::uuid, '5a000000-0000-0000-0000-000000000001'::uuid, 'biab',            null::int, null::int),
      ('d0000000-0000-0000-0000-000000000021'::uuid, '5a000000-0000-0000-0000-000000000001'::uuid, 'biab',            1, 11),
      ('d0000000-0000-0000-0000-000000000021'::uuid, '5a000000-0000-0000-0000-000000000002'::uuid, 'lash-lift',       3, 14),
      ('d0000000-0000-0000-0000-000000000027'::uuid, '5a000000-0000-0000-0000-000000000001'::uuid, 'pedicure',        2, 16),
      ('d0000000-0000-0000-0000-000000000026'::uuid, '5a000000-0000-0000-0000-000000000006'::uuid, 'brow-lamination', 1, 13)
    ) as v(user_id, salon_id, slug, day_offset, hour)
  loop
    ts := case when tr.day_offset is null then date_trunc('hour', now() - interval '30 minutes')
               else (((now() at time zone 'Europe/Amsterdam')::date + tr.day_offset) + make_time(tr.hour, 0, 0)) at time zone 'Europe/Amsterdam' end;
    insert into public.slots (salon_id, starts_at, ends_at, status) values (tr.salon_id, ts, ts + interval '1 hour', 'booked') returning id into v_slot;
    insert into public.bookings (user_id, salon_id, slot_id, treatment_id, starts_at, credits, payout_cents, status)
    select tr.user_id, tr.salon_id, v_slot, t.id, ts, coalesce(st.credits_override, t.credits), st.payout_cents, 'booked'
    from public.treatments t join public.salon_treatments st on st.treatment_id = t.id and st.salon_id = tr.salon_id
    where t.slug = tr.slug
    returning id into v_booking;
    insert into public.credit_ledger (user_id, delta, reason, booking_id)
    select user_id, -credits, 'booking', id from public.bookings where id = v_booking;
  end loop;

  -- 10. Bring each demo member's balance to a realistic amount for testing
  for v_plan in
    select m.user_id, p.monthly_credits from public.memberships m join public.plans p on p.id = m.plan_id
    where m.user_id::text like 'd0000000-%' and m.status in ('active', 'paused')
  loop
    insert into public.credit_ledger (user_id, delta, reason, note)
    select v_plan.user_id, target - public.credit_balance(v_plan.user_id), 'adjustment', 'Demo-saldo'
    from (select (v_plan.monthly_credits * 0.65)::integer as target) x
    where target - public.credit_balance(v_plan.user_id) <> 0;
  end loop;

  -- 11. Favourites
  insert into public.favorites (user_id, salon_id) values
    ('d0000000-0000-0000-0000-000000000021', '5a000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0000-000000000021', '5a000000-0000-0000-0000-000000000002');
end $$;

-- Profile details for the demo salons (only when migration 004 has been run)
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'salons' and column_name = 'tagline') then
    execute $q$
      update public.salons s set tagline = v.tagline, opening_hours = v.hours, instagram = v.ig
      from (values
        ('5a000000-0000-0000-0000-000000000001'::uuid, 'Natuurlijke nagels, met aandacht gemaakt', E'Di–vr 9:00–18:00\nZa 10:00–16:00\nZo & ma gesloten', 'studionoor.demo'),
        ('5a000000-0000-0000-0000-000000000002'::uuid, 'Brows & lashes, persoonlijk advies', E'Ma–za 10:00–18:00', 'maisoneva.demo'),
        ('5a000000-0000-0000-0000-000000000003'::uuid, 'In 45 minuten klaar voor je avond', E'Ma–vr 9:00–20:00\nZa 9:00–17:00', 'blowbarwest.demo'),
        ('5a000000-0000-0000-0000-000000000004'::uuid, 'Klein atelier, groot in detail', E'Di–za 10:00–18:00', ''),
        ('5a000000-0000-0000-0000-000000000005'::uuid, 'Alles onder één dak in Oost', E'Ma–za 9:00–19:00', 'glowstudiooost.demo'),
        ('5a000000-0000-0000-0000-000000000006'::uuid, 'Brow specialists in het centrum', E'Di–za 10:00–18:00', ''),
        ('5a000000-0000-0000-0000-000000000007'::uuid, 'Premium beauty op de Zuidas', E'Ma–vr 8:00–20:00', 'salonlumiere.demo'),
        ('5a000000-0000-0000-0000-000000000008'::uuid, 'Pedicure & gellak, vlak bij de pont', E'Di–za 10:00–17:00', ''),
        ('5a000000-0000-0000-0000-000000000009'::uuid, 'Licht en ruim aan het water', E'Wo–zo 10:00–18:00', '')
      ) as v(id, tagline, hours, ig)
      where s.id = v.id
    $q$;
  end if;
end $$;

-- Demo photos (only when migration 004 has been run)
do $outer$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'salons' and column_name = 'cover_url') then
    execute $q$
update public.salons s set cover_url = v.cover, gallery = v.gallery
from (values
  ('5a000000-0000-0000-0000-000000000001'::uuid, 'https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155255_8c6159b6-af57-47ae-a236-7cab659e17ff.png', array['https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155452_0c1d01a0-cd4b-4dd0-b2d3-525cc4ce7535_min.webp', 'https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155402_5dfac4f7-cae9-4057-90fb-48004e5eb764_min.webp', 'https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155452_0c1d01a0-cd4b-4dd0-b2d3-525cc4ce7535_min.webp']),
  ('5a000000-0000-0000-0000-000000000002'::uuid, 'https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155326_dd188326-b1dc-4ed1-90f4-17e9d4c6c018.png', array['https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155255_ddcc5830-6c18-43e8-9e66-a16226540cbb_min.webp', 'https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155255_b1d6e6d8-8ff7-4563-a19b-e965e968f0d8_min.webp']),
  ('5a000000-0000-0000-0000-000000000003'::uuid, 'https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155255_ca9c1c7f-ae99-4b32-87b5-f2a87266229b.png', array['https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155255_57e49157-64e7-4dc5-8343-84b57fa2fec7_min.webp']),
  ('5a000000-0000-0000-0000-000000000004'::uuid, 'https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155402_5dfac4f7-cae9-4057-90fb-48004e5eb764.png', array['https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155452_0c1d01a0-cd4b-4dd0-b2d3-525cc4ce7535_min.webp', 'https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155452_0c1d01a0-cd4b-4dd0-b2d3-525cc4ce7535_min.webp']),
  ('5a000000-0000-0000-0000-000000000005'::uuid, 'https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155255_b1d6e6d8-8ff7-4563-a19b-e965e968f0d8.png', array['https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155345_e86433df-a3c8-4604-bd19-cf8a1c7307a4_min.webp', 'https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155255_ddcc5830-6c18-43e8-9e66-a16226540cbb_min.webp', 'https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155452_0c1d01a0-cd4b-4dd0-b2d3-525cc4ce7535_min.webp']),
  ('5a000000-0000-0000-0000-000000000006'::uuid, 'https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155255_ddcc5830-6c18-43e8-9e66-a16226540cbb.png', array['https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155326_dd188326-b1dc-4ed1-90f4-17e9d4c6c018_min.webp']),
  ('5a000000-0000-0000-0000-000000000007'::uuid, 'https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155255_57e49157-64e7-4dc5-8343-84b57fa2fec7.png', array['https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155255_ca9c1c7f-ae99-4b32-87b5-f2a87266229b_min.webp', 'https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155402_5dfac4f7-cae9-4057-90fb-48004e5eb764_min.webp']),
  ('5a000000-0000-0000-0000-000000000008'::uuid, 'https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155345_e86433df-a3c8-4604-bd19-cf8a1c7307a4.png', array['https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155452_0c1d01a0-cd4b-4dd0-b2d3-525cc4ce7535_min.webp']),
  ('5a000000-0000-0000-0000-000000000009'::uuid, 'https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155255_fd6cebf4-8cbc-4832-be43-2759b5e26cbc.png', array['https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/hf_20261010_155255_ca9c1c7f-ae99-4b32-87b5-f2a87266229b_min.webp'])
) as v(id, cover, gallery)
where s.id = v.id
    $q$;
  end if;
end $outer$;

-- Overview of what was created
select 'salons' as wat, count(*) from public.salons where is_demo
union all select 'vrije tijden', count(*) from public.slots s join public.salons x on x.id = s.salon_id where x.is_demo and s.status = 'open'
union all select 'boekingen', count(*) from public.bookings b join public.salons x on x.id = b.salon_id where x.is_demo
union all select 'reviews', count(*) from public.reviews r join public.salons x on x.id = r.salon_id where x.is_demo
union all select 'demo-accounts', count(*) from auth.users where email like 'demo.%@example.com';
