-- BeautyPass platform: members, salons and admin, with row level security.
-- Run after 001_waitlist.sql. Safe to re-run only on an empty platform (it creates types and tables).

-- ───────────────────────────── Types ─────────────────────────────
create type public.admin_role as enum ('super_admin', 'ops', 'support', 'finance');
create type public.salon_role as enum ('owner', 'staff');
create type public.salon_status as enum ('lead', 'active', 'paused');
create type public.membership_status as enum ('pending', 'active', 'paused', 'cancelled');
create type public.slot_status as enum ('open', 'booked', 'blocked');
create type public.booking_status as enum ('booked', 'completed', 'no_show', 'cancelled', 'cancelled_late', 'cancelled_by_salon');
create type public.ledger_reason as enum ('monthly_grant', 'booking', 'refund', 'expiry', 'adjustment');

-- ───────────────────────────── Tables ─────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  first_name  text not null default '' check (char_length(first_name) <= 60),
  last_name   text not null default '' check (char_length(last_name) <= 80),
  phone       text check (phone is null or char_length(phone) <= 30),
  admin_role  public.admin_role,
  created_at  timestamptz not null default now()
);

create table public.treatments (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  name                 text not null,
  category             text not null,
  description          text not null default '',
  credits              integer not null check (credits > 0),
  retail_price_cents   integer not null check (retail_price_cents >= 0),
  default_payout_cents integer not null check (default_payout_cents >= 0),
  duration_min         integer not null default 45 check (duration_min > 0),
  active               boolean not null default true,
  sort                 integer not null default 0
);

create table public.plans (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  name                text not null,
  tagline             text not null default '',
  monthly_price_cents integer not null check (monthly_price_cents > 0),
  monthly_credits     integer not null check (monthly_credits > 0),
  rollover_max        integer not null default 0 check (rollover_max >= 0),
  active              boolean not null default true,
  sort                integer not null default 0
);

create table public.salons (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 120),
  district      text not null default '',
  address       text not null default '',
  description   text not null default '' check (char_length(description) <= 2000),
  contact_name  text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  status        public.salon_status not null default 'lead',
  notes         text not null default '',
  created_at    timestamptz not null default now()
);

create table public.salon_members (
  salon_id   uuid not null references public.salons (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.salon_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (salon_id, user_id)
);

create table public.salon_treatments (
  salon_id         uuid not null references public.salons (id) on delete cascade,
  treatment_id     uuid not null references public.treatments (id) on delete cascade,
  credits_override integer check (credits_override is null or credits_override > 0),
  payout_cents     integer not null check (payout_cents >= 0),
  active           boolean not null default true,
  primary key (salon_id, treatment_id)
);

create table public.slots (
  id         uuid primary key default gen_random_uuid(),
  salon_id   uuid not null references public.salons (id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  status     public.slot_status not null default 'open',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index slots_salon_time on public.slots (salon_id, starts_at);

create table public.memberships (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  plan_id            uuid not null references public.plans (id),
  status             public.membership_status not null default 'pending',
  founding_number    integer unique check (founding_number between 1 and 100),
  started_at         timestamptz,
  current_period_end timestamptz,
  created_at         timestamptz not null default now()
);
-- At most one non-cancelled membership per member
create unique index memberships_one_open on public.memberships (user_id) where status <> 'cancelled';

create table public.bookings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  salon_id      uuid not null references public.salons (id),
  slot_id       uuid not null references public.slots (id),
  treatment_id  uuid not null references public.treatments (id),
  starts_at     timestamptz not null,
  credits       integer not null check (credits > 0),
  payout_cents  integer not null check (payout_cents >= 0),
  status        public.booking_status not null default 'booked',
  checked_in_at timestamptz,
  created_at    timestamptz not null default now()
);
create index bookings_user on public.bookings (user_id, starts_at desc);
create index bookings_salon on public.bookings (salon_id, starts_at desc);
-- A slot can only carry one live booking
create unique index bookings_one_per_slot on public.bookings (slot_id) where status in ('booked', 'completed', 'no_show');

create table public.credit_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  delta      integer not null check (delta <> 0),
  reason     public.ledger_reason not null,
  booking_id uuid references public.bookings (id) on delete set null,
  note       text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index credit_ledger_user on public.credit_ledger (user_id, created_at desc);

create table public.reviews (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  salon_id   uuid not null references public.salons (id) on delete cascade,
  rating     integer not null check (rating between 1 and 5),
  comment    text not null default '' check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor      uuid references public.profiles (id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  text,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ───────────────────────────── Helpers ─────────────────────────────
create or replace function public.current_admin_role() returns public.admin_role
language sql stable security definer set search_path = public as $$
  select admin_role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin(roles public.admin_role[] default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and admin_role is not null
      and (roles is null or admin_role = 'super_admin' or admin_role = any (roles))
  )
$$;

create or replace function public.is_salon_member(p_salon uuid, owner_only boolean default false) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.salon_members
    where salon_id = p_salon and user_id = auth.uid() and (not owner_only or role = 'owner')
  )
$$;

create or replace function public.credit_balance(p_user uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::integer from public.credit_ledger where user_id = p_user
$$;

create or replace function public.my_credit_balance() returns integer
language sql stable security definer set search_path = public as $$
  select public.credit_balance(auth.uid())
$$;

create or replace function public.log_action(p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor, action, entity, entity_id, details) values (auth.uid(), p_action, p_entity, p_entity_id, p_details)
$$;

-- New auth user → profile row
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (new.id,
          left(coalesce(new.raw_user_meta_data ->> 'first_name', ''), 60),
          left(coalesce(new.raw_user_meta_data ->> 'last_name', ''), 80))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Members may edit their own name/phone but never their admin role
create or replace function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null for trusted server-side contexts (SQL editor, service role, cron)
  if new.admin_role is distinct from old.admin_role and auth.uid() is not null
     and not public.is_admin(array['super_admin']::public.admin_role[]) then
    raise exception 'Alleen een super-admin kan rollen wijzigen';
  end if;
  return new;
end $$;

create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ───────────────────────────── Row level security ─────────────────────────────
alter table public.profiles         enable row level security;
alter table public.treatments       enable row level security;
alter table public.plans            enable row level security;
alter table public.salons           enable row level security;
alter table public.salon_members    enable row level security;
alter table public.salon_treatments enable row level security;
alter table public.slots            enable row level security;
alter table public.memberships      enable row level security;
alter table public.bookings         enable row level security;
alter table public.credit_ledger    enable row level security;
alter table public.reviews          enable row level security;
alter table public.audit_log        enable row level security;

-- Visitors who are not logged in get nothing from the platform tables
revoke all on public.profiles, public.treatments, public.plans, public.salons, public.salon_members,
  public.salon_treatments, public.slots, public.memberships, public.bookings, public.credit_ledger,
  public.reviews, public.audit_log from anon;

-- profiles
create policy "own profile read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin(array['super_admin', 'support']::public.admin_role[]))
  with check (id = auth.uid() or public.is_admin(array['super_admin', 'support']::public.admin_role[]));

-- catalogue: readable by every logged-in user, editable by ops
create policy "treatments read" on public.treatments for select to authenticated using (active or public.is_admin());
create policy "treatments write" on public.treatments for all to authenticated
  using (public.is_admin(array['ops']::public.admin_role[])) with check (public.is_admin(array['ops']::public.admin_role[]));
create policy "plans read" on public.plans for select to authenticated using (active or public.is_admin());
create policy "plans write" on public.plans for all to authenticated
  using (public.is_admin(array['ops']::public.admin_role[])) with check (public.is_admin(array['ops']::public.admin_role[]));

-- salons: members see active salons, salon team sees its own salon, admins see all
create policy "salons read" on public.salons for select to authenticated
  using (status = 'active' or public.is_salon_member(id) or public.is_admin());
create policy "salons admin write" on public.salons for all to authenticated
  using (public.is_admin(array['ops']::public.admin_role[])) with check (public.is_admin(array['ops']::public.admin_role[]));
-- Salon owners edit their public profile through update_salon_profile() so they cannot change status or notes.

-- salon members
create policy "salon members read" on public.salon_members for select to authenticated
  using (user_id = auth.uid() or public.is_salon_member(salon_id, true) or public.is_admin());
create policy "salon members admin write" on public.salon_members for all to authenticated
  using (public.is_admin(array['ops']::public.admin_role[])) with check (public.is_admin(array['ops']::public.admin_role[]));
create policy "salon owner removes staff" on public.salon_members for delete to authenticated
  using (public.is_salon_member(salon_id, true) and role = 'staff');

-- salon treatments (prices are set by ops; members see what an active salon offers)
create policy "salon treatments read" on public.salon_treatments for select to authenticated
  using (public.is_salon_member(salon_id) or public.is_admin()
         or (active and exists (select 1 from public.salons s where s.id = salon_id and s.status = 'active')));
create policy "salon treatments admin write" on public.salon_treatments for all to authenticated
  using (public.is_admin(array['ops']::public.admin_role[])) with check (public.is_admin(array['ops']::public.admin_role[]));

-- slots: salon team manages its own availability, members see open future slots of active salons
create policy "slots read" on public.slots for select to authenticated
  using (public.is_salon_member(salon_id) or public.is_admin()
         or (status = 'open' and starts_at > now() and exists (select 1 from public.salons s where s.id = salon_id and s.status = 'active')));
create policy "slots salon insert" on public.slots for insert to authenticated
  with check ((public.is_salon_member(salon_id) or public.is_admin(array['ops']::public.admin_role[])) and status <> 'booked');
create policy "slots salon update" on public.slots for update to authenticated
  using ((public.is_salon_member(salon_id) or public.is_admin(array['ops']::public.admin_role[])) and status <> 'booked')
  with check ((public.is_salon_member(salon_id) or public.is_admin(array['ops']::public.admin_role[])) and status <> 'booked');
create policy "slots salon delete" on public.slots for delete to authenticated
  using ((public.is_salon_member(salon_id) or public.is_admin(array['ops']::public.admin_role[])) and status <> 'booked');

-- memberships: members read their own and request one via request_membership(); admins manage
create policy "memberships read" on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "memberships admin write" on public.memberships for update to authenticated
  using (public.is_admin(array['ops', 'support']::public.admin_role[])) with check (public.is_admin(array['ops', 'support']::public.admin_role[]));

-- bookings: members see their own, salon team sees its salon (names via salon_bookings()), admins all
create policy "bookings read" on public.bookings for select to authenticated
  using (user_id = auth.uid() or public.is_salon_member(salon_id) or public.is_admin());
-- All writes go through the booking functions below.

-- credit ledger: read own, admins read all; writes only through functions
create policy "ledger read" on public.credit_ledger for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- reviews
create policy "reviews read" on public.reviews for select to authenticated
  using (user_id = auth.uid() or public.is_salon_member(salon_id) or public.is_admin());
create policy "reviews insert" on public.reviews for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid() and b.salon_id = reviews.salon_id and b.status = 'completed'));

-- audit log: admins only
create policy "audit read" on public.audit_log for select to authenticated using (public.is_admin());

-- waitlist (from 001): admins may read and update status
grant select, update (status, launch_round) on public.waitlist to authenticated;
create policy "waitlist admin read" on public.waitlist for select to authenticated using (public.is_admin());
create policy "waitlist admin update" on public.waitlist for update to authenticated
  using (public.is_admin(array['ops']::public.admin_role[])) with check (public.is_admin(array['ops']::public.admin_role[]));

-- ───────────────────────────── Member functions ─────────────────────────────
create or replace function public.request_membership(p_plan uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  if not exists (select 1 from public.plans where id = p_plan and active) then raise exception 'Onbekend membership'; end if;
  if exists (select 1 from public.memberships where user_id = auth.uid() and status <> 'cancelled') then
    raise exception 'Je hebt al een membership';
  end if;
  insert into public.memberships (user_id, plan_id) values (auth.uid(), p_plan) returning id into v_id;
  return v_id;
end $$;

create or replace function public.treatment_credits(p_salon uuid, p_treatment uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(st.credits_override, t.credits)
  from public.salon_treatments st join public.treatments t on t.id = st.treatment_id
  where st.salon_id = p_salon and st.treatment_id = p_treatment
$$;

create or replace function public.book_slot(p_slot uuid, p_treatment uuid) returns uuid
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

  -- Serialize bookings per member so the balance check cannot be raced
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  if public.credit_balance(auth.uid()) < v_credits then
    raise exception 'Niet genoeg credits (nodig: %)', v_credits;
  end if;

  insert into public.bookings (user_id, salon_id, slot_id, treatment_id, starts_at, credits, payout_cents)
  values (auth.uid(), v_slot.salon_id, v_slot.id, p_treatment, v_slot.starts_at, v_credits, v_payout)
  returning id into v_booking;
  update public.slots set status = 'booked' where id = v_slot.id;
  insert into public.credit_ledger (user_id, delta, reason, booking_id, created_by)
  values (auth.uid(), -v_credits, 'booking', v_booking, auth.uid());
  return v_booking;
end $$;

-- Member cancels: free until 24 hours before, after that the credits are kept
create or replace function public.cancel_booking(p_booking uuid) returns public.booking_status
language plpgsql security definer set search_path = public as $$
declare
  v_b public.bookings;
  v_status public.booking_status;
begin
  select * into v_b from public.bookings where id = p_booking for update;
  if not found or v_b.user_id <> auth.uid() then raise exception 'Boeking niet gevonden'; end if;
  if v_b.status <> 'booked' then raise exception 'Deze boeking kan niet meer geannuleerd worden'; end if;
  if v_b.starts_at <= now() then raise exception 'Deze afspraak is al begonnen'; end if;

  if v_b.starts_at - now() >= interval '24 hours' then
    v_status := 'cancelled';
    insert into public.credit_ledger (user_id, delta, reason, booking_id, created_by, note)
    values (v_b.user_id, v_b.credits, 'refund', v_b.id, auth.uid(), 'Tijdig geannuleerd');
    update public.slots set status = 'open' where id = v_b.slot_id;
  else
    v_status := 'cancelled_late';
    -- The slot stays closed: the salon keeps the time reserved and is paid for a late cancellation.
  end if;
  update public.bookings set status = v_status where id = v_b.id;
  return v_status;
end $$;

-- ───────────────────────────── Salon functions ─────────────────────────────
create or replace function public.salon_set_booking_status(p_booking uuid, p_status public.booking_status) returns void
language plpgsql security definer set search_path = public as $$
declare v_b public.bookings;
begin
  select * into v_b from public.bookings where id = p_booking for update;
  if not found or not (public.is_salon_member(v_b.salon_id) or public.is_admin(array['ops', 'support']::public.admin_role[])) then
    raise exception 'Boeking niet gevonden';
  end if;
  if p_status not in ('completed', 'no_show', 'cancelled_by_salon') then raise exception 'Ongeldige status'; end if;
  if v_b.status not in ('booked', 'completed', 'no_show') then raise exception 'Deze boeking is al afgesloten'; end if;
  if p_status in ('completed', 'no_show') and v_b.starts_at > now() + interval '30 minutes' then
    raise exception 'Je kunt een afspraak pas afronden rond het starttijdstip';
  end if;

  if p_status = 'cancelled_by_salon' then
    if v_b.status <> 'booked' then raise exception 'Alleen geplande afspraken kunnen geannuleerd worden'; end if;
    insert into public.credit_ledger (user_id, delta, reason, booking_id, created_by, note)
    values (v_b.user_id, v_b.credits, 'refund', v_b.id, auth.uid(), 'Geannuleerd door salon');
    update public.slots set status = 'blocked' where id = v_b.slot_id;
  end if;

  update public.bookings
     set status = p_status,
         checked_in_at = case when p_status = 'completed' then coalesce(checked_in_at, now()) else checked_in_at end
   where id = v_b.id;
  perform public.log_action('booking_status', 'booking', v_b.id::text, jsonb_build_object('status', p_status));
end $$;

-- Bookings of a salon with a privacy-friendly member name (first name + initial)
create or replace function public.salon_bookings(p_salon uuid, p_from timestamptz, p_to timestamptz)
returns table (id uuid, starts_at timestamptz, status public.booking_status, treatment text, credits integer,
               payout_cents integer, member_name text, checked_in_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id, b.starts_at, b.status, t.name, b.credits, b.payout_cents,
         trim(p.first_name || ' ' || left(p.last_name, 1) || case when p.last_name <> '' then '.' else '' end),
         b.checked_in_at
  from public.bookings b
  join public.treatments t on t.id = b.treatment_id
  join public.profiles p on p.id = b.user_id
  where b.salon_id = p_salon and b.starts_at >= p_from and b.starts_at < p_to
    and (public.is_salon_member(p_salon) or public.is_admin())
  order by b.starts_at
$$;

create or replace function public.update_salon_profile(p_salon uuid, p_description text, p_address text, p_district text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_salon_member(p_salon, true) or public.is_admin(array['ops']::public.admin_role[])) then
    raise exception 'Geen toegang';
  end if;
  update public.salons
     set description = left(coalesce(p_description, ''), 2000),
         address = left(coalesce(p_address, ''), 200),
         district = left(coalesce(p_district, ''), 80)
   where id = p_salon;
end $$;

-- Owner (or ops) adds a team member by e-mail; the person must already have an account
create or replace function public.add_salon_member(p_salon uuid, p_email text, p_role public.salon_role) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_user uuid;
begin
  if not (public.is_admin(array['ops']::public.admin_role[]) or (public.is_salon_member(p_salon, true) and p_role = 'staff')) then
    raise exception 'Geen toegang';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'Er is nog geen account met dit e-mailadres. Laat diegene eerst een account aanmaken.'; end if;
  insert into public.salon_members (salon_id, user_id, role) values (p_salon, v_user, p_role)
  on conflict (salon_id, user_id) do update set role = excluded.role;
  perform public.log_action('add_salon_member', 'salon', p_salon::text, jsonb_build_object('user', v_user, 'role', p_role));
end $$;

-- Team of a salon with names, visible to that salon's team and admins
create or replace function public.salon_team(p_salon uuid)
returns table (user_id uuid, role public.salon_role, name text, email text)
language sql stable security definer set search_path = public, auth as $$
  select sm.user_id, sm.role, trim(p.first_name || ' ' || p.last_name), u.email::text
  from public.salon_members sm
  join public.profiles p on p.id = sm.user_id
  join auth.users u on u.id = sm.user_id
  where sm.salon_id = p_salon and (public.is_salon_member(p_salon) or public.is_admin())
  order by sm.role, p.first_name
$$;

-- ───────────────────────────── Admin functions ─────────────────────────────
create or replace function public.admin_activate_membership(p_membership uuid, p_founding boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_m public.memberships;
  v_plan public.plans;
  v_number integer;
begin
  if not public.is_admin(array['ops']::public.admin_role[]) then raise exception 'Geen toegang'; end if;
  select * into v_m from public.memberships where id = p_membership for update;
  if not found then raise exception 'Membership niet gevonden'; end if;
  if v_m.status = 'active' then raise exception 'Dit membership is al actief'; end if;
  if v_m.status = 'cancelled' then raise exception 'Dit membership is opgezegd'; end if;
  select * into v_plan from public.plans where id = v_m.plan_id;

  if p_founding and v_m.founding_number is null then
    perform pg_advisory_xact_lock(hashtext('founding_number'));
    select coalesce(max(founding_number), 0) + 1 into v_number from public.memberships;
    if v_number > 100 then v_number := null; end if;
  end if;

  update public.memberships
     set status = 'active',
         founding_number = coalesce(founding_number, v_number),
         started_at = coalesce(started_at, now()),
         current_period_end = case when status = 'pending' then now() + interval '1 month' else current_period_end end
   where id = v_m.id;

  if v_m.status = 'pending' then
    insert into public.credit_ledger (user_id, delta, reason, created_by, note)
    values (v_m.user_id, v_plan.monthly_credits, 'monthly_grant', auth.uid(), 'Start membership ' || v_plan.name);
  end if;
  perform public.log_action('activate_membership', 'membership', v_m.id::text, '{}'::jsonb);
end $$;

create or replace function public.admin_set_membership_status(p_membership uuid, p_status public.membership_status) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(array['ops', 'support']::public.admin_role[]) then raise exception 'Geen toegang'; end if;
  if p_status = 'active' then raise exception 'Gebruik activeren'; end if;
  update public.memberships set status = p_status where id = p_membership;
  perform public.log_action('membership_status', 'membership', p_membership::text, jsonb_build_object('status', p_status));
end $$;

create or replace function public.admin_adjust_credits(p_user uuid, p_delta integer, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(array['ops', 'support']::public.admin_role[]) then raise exception 'Geen toegang'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Geef een reden op'; end if;
  if p_delta = 0 or abs(p_delta) > 500 then raise exception 'Ongeldig aantal credits'; end if;
  insert into public.credit_ledger (user_id, delta, reason, created_by, note)
  values (p_user, p_delta, 'adjustment', auth.uid(), left(p_note, 300));
  perform public.log_action('adjust_credits', 'profile', p_user::text, jsonb_build_object('delta', p_delta, 'note', p_note));
end $$;

-- Monthly renewal: cap rolled-over credits and grant the new month for every active membership that is due.
-- Run daily (Supabase cron) or by hand from the admin dashboard. Payment collection (Mollie) hooks in here later.
create or replace function public.run_monthly_renewals() returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_balance integer;
  v_count integer := 0;
begin
  if auth.uid() is not null and not public.is_admin(array['ops']::public.admin_role[]) then raise exception 'Geen toegang'; end if;
  for r in
    select m.id, m.user_id, m.current_period_end, p.monthly_credits, p.rollover_max, p.name
    from public.memberships m join public.plans p on p.id = m.plan_id
    where m.status = 'active' and m.current_period_end <= now()
    for update of m
  loop
    v_balance := public.credit_balance(r.user_id);
    if v_balance > r.rollover_max then
      insert into public.credit_ledger (user_id, delta, reason, note)
      values (r.user_id, r.rollover_max - v_balance, 'expiry', 'Niet gebruikte credits boven het maximum vervallen');
    end if;
    insert into public.credit_ledger (user_id, delta, reason, note)
    values (r.user_id, r.monthly_credits, 'monthly_grant', 'Nieuwe maand ' || r.name);
    update public.memberships set current_period_end = r.current_period_end + interval '1 month' where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

create or replace function public.admin_set_role(p_email text, p_role public.admin_role) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_user uuid;
begin
  if not public.is_admin(array['super_admin']::public.admin_role[]) then raise exception 'Alleen een super-admin kan rollen wijzigen'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'Er is nog geen account met dit e-mailadres'; end if;
  if v_user = auth.uid() and p_role is distinct from 'super_admin' then raise exception 'Je kunt je eigen super-admin rol niet afnemen'; end if;
  update public.profiles set admin_role = p_role where id = v_user;
  perform public.log_action('set_admin_role', 'profile', v_user::text, jsonb_build_object('role', p_role));
end $$;

-- Team overview for the admin team page (e-mail lives in auth.users)
create or replace function public.admin_team() returns table (id uuid, email text, first_name text, last_name text, admin_role public.admin_role)
language sql stable security definer set search_path = public, auth as $$
  select p.id, u.email::text, p.first_name, p.last_name, p.admin_role
  from public.profiles p join auth.users u on u.id = p.id
  where p.admin_role is not null and public.is_admin()
  order by p.admin_role, p.first_name
$$;

-- Members overview for admins: profile, e-mail, membership and balance in one row
create or replace function public.admin_members()
returns table (user_id uuid, email text, first_name text, last_name text, phone text, membership_id uuid,
               plan_name text, status public.membership_status, founding_number integer,
               current_period_end timestamptz, balance integer, created_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select p.id, u.email::text, p.first_name, p.last_name, p.phone, m.id, pl.name, m.status, m.founding_number,
         m.current_period_end, public.credit_balance(p.id), coalesce(m.created_at, p.created_at)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join lateral (
    select * from public.memberships mm where mm.user_id = p.id order by (mm.status = 'cancelled'), mm.created_at desc limit 1
  ) m on true
  left join public.plans pl on pl.id = m.plan_id
  where public.is_admin() and (m.id is not null or not exists (select 1 from public.salon_members sm where sm.user_id = p.id))
    and p.admin_role is null
  order by coalesce(m.created_at, p.created_at) desc
$$;

-- Economics for the admin dashboard (one month window)
create or replace function public.admin_economics(p_month date default date_trunc('month', now())::date)
returns table (active_members integer, pending_members integer, mrr_cents bigint, credits_granted bigint,
               credits_used bigint, bookings_completed integer, bookings_booked integer, no_shows integer,
               payout_cents bigint)
language sql stable security definer set search_path = public as $$
  with win as (select p_month::timestamptz as s, (p_month + interval '1 month')::timestamptz as e)
  select
    (select count(*) from public.memberships where status = 'active')::integer,
    (select count(*) from public.memberships where status = 'pending')::integer,
    (select coalesce(sum(p.monthly_price_cents), 0) from public.memberships m join public.plans p on p.id = m.plan_id where m.status = 'active'),
    (select coalesce(sum(delta), 0) from public.credit_ledger, win where reason = 'monthly_grant' and created_at >= win.s and created_at < win.e),
    (select coalesce(sum(b.credits), 0) from public.bookings b, win where b.status in ('booked', 'completed', 'no_show', 'cancelled_late') and b.starts_at >= win.s and b.starts_at < win.e),
    (select count(*) from public.bookings b, win where b.status = 'completed' and b.starts_at >= win.s and b.starts_at < win.e)::integer,
    (select count(*) from public.bookings b, win where b.status = 'booked' and b.starts_at >= win.s and b.starts_at < win.e)::integer,
    (select count(*) from public.bookings b, win where b.status = 'no_show' and b.starts_at >= win.s and b.starts_at < win.e)::integer,
    (select coalesce(sum(b.payout_cents), 0) from public.bookings b, win where b.status in ('completed', 'no_show', 'cancelled_late') and b.starts_at >= win.s and b.starts_at < win.e)
  where public.is_admin()
$$;

-- Payout overview per salon for a month (completed + no-show + late cancellations are paid)
create or replace function public.salon_payouts(p_month date default date_trunc('month', now())::date)
returns table (salon_id uuid, salon_name text, bookings integer, payout_cents bigint)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, count(b.id)::integer, coalesce(sum(b.payout_cents), 0)
  from public.salons s
  left join public.bookings b on b.salon_id = s.id and b.status in ('completed', 'no_show', 'cancelled_late')
    and b.starts_at >= p_month::timestamptz and b.starts_at < (p_month + interval '1 month')::timestamptz
  where public.is_admin() or public.is_salon_member(s.id)
  group by s.id, s.name
  order by s.name
$$;

-- Functions are callable by logged-in users only (each checks its own permissions)
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
-- Internal helpers stay private
revoke execute on function public.handle_new_user(), public.protect_profile_role(), public.log_action(text, text, text, jsonb) from authenticated;

-- ───────────────────────────── Seed: catalogue and plans ─────────────────────────────
-- Prices are a starting point (see docs/prijsplan.md) and can be changed in the admin environment.
insert into public.treatments (slug, name, category, description, credits, retail_price_cents, default_payout_cents, duration_min, sort) values
  ('gellak',          'Manicure gellak',  'Nagels',  'Verzorgende manicure met gellak',                    40, 4500, 3400, 45, 10),
  ('biab',            'BIAB manicure',    'Nagels',  'Builder in a bottle voor sterke, natuurlijke nagels', 50, 5500, 4100, 60, 20),
  ('pedicure',        'Pedicure',         'Voeten',  'Verzorgende pedicure, met of zonder gellak',          50, 5500, 4100, 50, 30),
  ('blowout',         'Blowout',          'Haar',    'Wassen en professioneel föhnen',                      40, 4500, 3400, 45, 40),
  ('brow-lamination', 'Brow lamination',  'Brows',   'Lamination, verven en shapen',                        50, 5500, 4100, 45, 50),
  ('lash-lift',       'Lash lift',        'Lashes',  'Lash lift inclusief tint',                            55, 6000, 4500, 60, 60);

insert into public.plans (slug, name, tagline, monthly_price_cents, monthly_credits, rollover_max, sort) values
  ('essential', 'Essential', 'Twee behandelingen per maand',  8900,  95,  45, 10),
  ('signature', 'Signature', 'Je complete maandelijkse routine', 16900, 190, 95, 20),
  ('luxe',      'Luxe',      'Alles, en vaker',                  24900, 280, 140, 30);
