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
