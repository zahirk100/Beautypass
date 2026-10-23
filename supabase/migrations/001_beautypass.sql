-- BeautyPass: one salon (BeautyPass house, Amsterdam). Run once in the Supabase SQL Editor of the new project.
-- Based on design_handoff_beautypass_backend/supabase/schema.sql, hardened:
--   * every write that has business rules goes through a security definer function; tables only allow
--     what is safe to do directly (members can never set their own plan, status or payment data)
--   * booking checks plan, monthly limit, opening hours, specialist skill + workday, room type and
--     availability, and the database itself refuses double bookings of a specialist, a room or a member
--   * late cancellations and no-shows count towards the month (per settings); six hands counts once
--   * specialists only see their own appointments and only the member details those need
--   * role rights live in a table, so Beheer → Instellingen → Rollen & rechten really works

set search_path = public, extensions;
create extension if not exists btree_gist with schema extensions;

-- ───────────────────────────── Types ─────────────────────────────
create type app_role as enum ('member', 'specialist', 'desk', 'manager', 'owner');
create type room_type as enum ('solo', 'duo', 'six');
create type member_status as enum ('nieuw', 'actief', 'betaling mislukt', 'gepauzeerd', 'opgezegd');
create type appt_status as enum ('gepland', 'afgerond', 'geannuleerd', 'no-show');
create type waitlist_status as enum ('wachtend', 'uitgenodigd', 'member');
create type payment_status as enum ('open', 'betaald', 'mislukt', 'terugbetaald');
create type payment_kind as enum ('eerste', 'maand', 'los', 'upgrade', 'verificatie');

-- ───────────────────────────── People & rights ─────────────────────────────
create table profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text not null,
  name       text not null default '',
  role       app_role not null default 'member',
  created_at timestamptz not null default now()
);

-- Rights per role, editable by the owner in Beheer → Instellingen. The owner always has everything.
create table role_perms (
  role  app_role primary key,
  name  text not null,
  perms text[] not null default '{}'
);
insert into role_perms (role, name, perms) values
  ('owner', 'Eigenaar', '{dash,agenda,members,plans,team,waitlist,settings,finance}'),
  ('manager', 'Manager', '{dash,agenda,members,plans,team,waitlist}'),
  ('desk', 'Receptie', '{dash,agenda,members,waitlist}'),
  ('specialist', 'Specialist', '{agenda}');

create function my_role() returns app_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;
create function is_team() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(my_role() <> 'member', false)
$$;
create function has_perm(p text) returns boolean language sql stable security definer set search_path = public as $$
  select case
    when my_role() is null or my_role() = 'member' then false
    when my_role() = 'owner' then true
    else coalesce((select p = any(perms) from role_perms where role = my_role()), false)
  end
$$;

create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, name) values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Keep profile + member e-mail in sync when someone confirms a new address
create function handle_user_email_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update profiles set email = new.email where id = new.id;
    update members set email = new.email where user_id = new.id;
  end if;
  return new;
end $$;
create trigger on_auth_user_email after update of email on auth.users for each row execute function handle_user_email_change();

-- Only the owner changes roles, and the last owner can't be demoted. The SQL editor (no auth.uid()) may.
create function protect_role() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and my_role() <> 'owner' then raise exception 'Alleen de eigenaar kan rollen wijzigen'; end if;
    if old.role = 'owner' and not exists (select 1 from profiles where role = 'owner' and id <> old.id) then
      raise exception 'Er moet altijd minstens één eigenaar zijn';
    end if;
  end if;
  if new.id is distinct from old.id or new.email is distinct from old.email then
    if auth.uid() is not null then raise exception 'Dit veld kan niet worden gewijzigd'; end if;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on profiles for each row execute function protect_role();

-- ───────────────────────────── Catalogue ─────────────────────────────
create table categories (
  id text primary key, name text not null, title text, title_it text, img text, sort int not null default 0
);
create table treatments (
  id text primary key default 'tr' || substr(md5(random()::text), 1, 8),
  category_id text not null references categories,
  name text not null check (char_length(name) between 1 and 120),
  duration_min int not null check (duration_min between 10 and 480),
  price numeric(8,2) not null check (price >= 0),
  room room_type not null default 'solo',
  active boolean not null default true,
  sort int not null default 0
);
create table plans (
  id text primary key default 'plan' || substr(md5(random()::text), 1, 8),
  name text not null check (char_length(name) between 1 and 80),
  price numeric(8,2) not null check (price > 0),
  per_month int not null check (per_month between 1 and 31),
  description text not null default '',
  active boolean not null default false,
  sort int not null default 0
);
create table plan_treatments (
  plan_id text references plans on delete cascade,
  treatment_id text references treatments on delete cascade,
  primary key (plan_id, treatment_id)
);
create table rooms (id text primary key, name text not null unique, type room_type not null, sort int not null default 0, active boolean not null default true);

-- ───────────────────────────── Team ─────────────────────────────
create table staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users on delete set null,
  name text not null, role_title text not null default 'Specialist', color text not null default '#b7a48f',
  -- Monday..Sunday; working hours are the salon's opening hours
  workdays boolean[] not null default '{t,t,t,t,t,f,f}' check (array_length(workdays, 1) = 7),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table staff_skills (
  staff_id uuid references staff on delete cascade,
  category_id text references categories on delete cascade,
  primary key (staff_id, category_id)
);

-- ───────────────────────────── Settings (one row) ─────────────────────────────
create table settings (
  id int primary key default 1 check (id = 1),
  -- [["Maandag","10:00","20:00"], …] Monday..Sunday; a day with null times is closed
  hours jsonb not null,
  slot_times text[] not null default '{09:30,10:00,10:30,11:00,11:30,12:00,13:00,13:30,14:00,14:30,15:00,15:30,16:00,16:30,17:00,17:30}',
  booking_days int not null default 14 check (booking_days between 1 and 90),
  cancel_hours int not null default 24 check (cancel_hours between 0 and 168),
  no_show_counts boolean not null default true,
  rollover boolean not null default false,
  pause_months_per_year int not null default 2,
  mollie_mode text not null default 'test' check (mollie_mode in ('test', 'live')),
  mollie_profile text
);

-- ───────────────────────────── Members ─────────────────────────────
create table members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  email text not null,
  phone text check (phone is null or char_length(phone) <= 30),
  plan_id text references plans,
  next_plan_id text references plans,            -- downgrade that starts next period
  status member_status not null default 'nieuw',
  since date not null default current_date,
  paused_until date,
  cancel_at date,                                -- membership ends on this date
  mollie_customer_id text unique, mollie_subscription_id text unique, mandate_id text,
  mandate_method text, mandate_label text,
  routine text[] not null default '{}',
  prefs jsonb not null default '{"reminders": true, "newsletter": false}',
  notes text not null default '' check (char_length(notes) <= 2000),   -- written by the member ("Goed om te weten")
  created_at timestamptz not null default now()
);
create unique index members_email on members (lower(email));

-- Internal notes are for the team only, so they live outside the members row the member can read
create table member_team_notes (
  member_id uuid primary key references members on delete cascade,
  body text not null default '' check (char_length(body) <= 4000),
  updated_by uuid references auth.users, updated_at timestamptz not null default now()
);

-- Extra treatments for one month ("+1 behandeling (coulance)")
create table allowance_adjustments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members on delete cascade,
  month date not null check (extract(day from month) = 1),
  delta int not null check (delta between -10 and 10 and delta <> 0),
  reason text not null default '',
  created_by uuid references auth.users, created_at timestamptz not null default now()
);

-- Members may change only their own name, phone, routine, preferences and note; everything else
-- (plan, status, payment data, e-mail) changes through the server or a team function.
create function members_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or has_perm('members') then return new; end if;
  if (new.id, new.user_id, new.email, new.plan_id, new.next_plan_id, new.status, new.since, new.paused_until, new.cancel_at,
      new.mollie_customer_id, new.mollie_subscription_id, new.mandate_id, new.mandate_method, new.mandate_label, new.created_at)
     is distinct from
     (old.id, old.user_id, old.email, old.plan_id, old.next_plan_id, old.status, old.since, old.paused_until, old.cancel_at,
      old.mollie_customer_id, old.mollie_subscription_id, old.mandate_id, old.mandate_method, old.mandate_label, old.created_at) then
    raise exception 'Dit kun je niet zelf wijzigen';
  end if;
  if new.routine <> '{}' and exists (select 1 from unnest(new.routine) t where t not in (select id from treatments)) then
    raise exception 'Onbekende behandeling in je routine';
  end if;
  return new;
end $$;
create trigger members_guard before update on members for each row execute function members_guard();

-- ───────────────────────────── Appointments ─────────────────────────────
create table appointments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members on delete cascade,
  treatment_id text not null references treatments,
  staff_id uuid not null references staff,
  room_id text not null references rooms,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  status appt_status not null default 'gepland',
  -- six hands = two rows (two specialists) with the same group; only the primary row counts and blocks the room
  group_id uuid not null default gen_random_uuid(),
  is_primary boolean not null default true,
  late_cancel boolean not null default false,       -- cancelled inside cancel_hours: counts as used
  paid_amount numeric(8,2) not null default 0,      -- booked outside the plan or over the limit
  confirmed boolean not null default true,          -- false while a separate payment is pending
  hold_until timestamptz,                           -- unpaid holds expire
  note text not null default '' check (char_length(note) <= 500),
  rescheduled_from uuid references appointments on delete set null,
  reminder_sent_at timestamptz,
  created_by uuid references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_free exclude using gist (staff_id with =, tstzrange(starts_at, ends_at) with &&) where (status <> 'geannuleerd'),
  constraint room_free exclude using gist (room_id with =, tstzrange(starts_at, ends_at) with &&) where (status <> 'geannuleerd' and is_primary),
  constraint member_free exclude using gist (member_id with =, tstzrange(starts_at, ends_at) with &&) where (status <> 'geannuleerd' and is_primary)
);
create index on appointments (member_id, starts_at);
create index on appointments (starts_at);

-- ───────────────────────────── First access, payments, audit ─────────────────────────────
create table waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null, source text not null default 'website', interest text[] not null default '{}',
  status waitlist_status not null default 'wachtend', round int, invited_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index waitlist_email on waitlist (lower(email));

create table invoice_counters (month text primary key, n int not null default 0);
create table payments (
  id uuid primary key default gen_random_uuid(),
  invoice_no text unique,                            -- given when paid: BP-YYYYMM-####
  member_id uuid not null references members on delete cascade,
  kind payment_kind not null,
  description text not null,
  appointment_group uuid,
  mollie_payment_id text unique,
  amount numeric(8,2) not null check (amount >= 0),
  vat_rate numeric(4,2) not null default 21,
  status payment_status not null default 'open',
  method text, paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index on payments (member_id, created_at desc);

create table audit_log (
  id bigserial primary key, actor uuid, action text not null, entity text not null, entity_id text,
  details jsonb not null default '{}', at timestamptz not null default now()
);
create function log_action(p_action text, p_entity text, p_id text, p_details jsonb default '{}') returns void
language sql security definer set search_path = public as $$
  insert into audit_log (actor, action, entity, entity_id, details) values (auth.uid(), p_action, p_entity, p_id, p_details)
$$;

-- Next invoice number for the month of p_at, gap-free per month
create function next_invoice_no(p_at timestamptz default now()) returns text language plpgsql security definer set search_path = public as $$
declare v_month text := to_char(p_at at time zone 'Europe/Amsterdam', 'YYYYMM'); v_n int;
begin
  insert into invoice_counters (month, n) values (v_month, 1)
    on conflict (month) do update set n = invoice_counters.n + 1 returning n into v_n;
  return 'BP-' || v_month || '-' || lpad(v_n::text, 4, '0');
end $$;

-- ───────────────────────────── Helpers ─────────────────────────────
create function my_member_id() returns uuid language sql stable security definer set search_path = public as $$
  select id from members where user_id = auth.uid()
$$;
create function local_ts(p_date date, p_time text) returns timestamptz language sql immutable as $$
  select (p_date + p_time::time) at time zone 'Europe/Amsterdam'
$$;
create function weekday_idx(p_date date) returns int language sql immutable as $$
  select (extract(isodow from p_date)::int - 1)   -- 0 = Monday
$$;

-- How many treatments of a member count for the calendar month of p_month (Europe/Amsterdam)
create function used_in_month(p_member uuid, p_month date, p_skip_group uuid default null) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from appointments a, settings s
  where a.member_id = p_member and a.is_primary and a.paid_amount = 0
    and (p_skip_group is null or a.group_id <> p_skip_group)
    and date_trunc('month', a.starts_at at time zone 'Europe/Amsterdam') = date_trunc('month', p_month::timestamp)
    and (a.status in ('gepland', 'afgerond')
         or (a.status = 'no-show' and s.no_show_counts)
         or (a.status = 'geannuleerd' and a.late_cancel))
    and (a.confirmed or a.hold_until > now())
$$;
create function limit_in_month(p_member uuid, p_month date) returns int language sql stable security definer set search_path = public as $$
  select coalesce((select p.per_month from members m join plans p on p.id = m.plan_id where m.id = p_member), 0)
       + coalesce((select sum(delta) from allowance_adjustments where member_id = p_member
                   and month = date_trunc('month', p_month::timestamp)::date), 0)::int
$$;

-- Unpaid holds give their time back once expired
create function release_expired_holds() returns void language sql security definer set search_path = public as $$
  update appointments set status = 'geannuleerd', updated_at = now()
  where not confirmed and status = 'gepland' and hold_until <= now()
$$;

-- ───────────────────────────── Availability ─────────────────────────────
-- Free start times on a day for a treatment, with the specialists that can take it.
-- Used by the member app (date/time picker) and by booking itself, so both always agree.
create function available_slots(p_treatment text, p_date date, p_skip_group uuid default null, p_member uuid default null)
returns table (slot text, staff_ids uuid[])
language plpgsql stable security definer set search_path = public as $$
declare
  t treatments; s settings; v_day jsonb; v_open time; v_close time; v_slot text; v_start timestamptz; v_end timestamptz;
  v_staff uuid[]; v_need int;
begin
  select * into t from treatments where id = p_treatment and active;
  select * into s from settings where id = 1;
  if t.id is null or p_date < (now() at time zone 'Europe/Amsterdam')::date then return; end if;
  v_day := s.hours -> weekday_idx(p_date);
  if v_day is null or v_day->>1 is null or v_day->>2 is null then return; end if;
  v_open := (v_day->>1)::time; v_close := (v_day->>2)::time;
  v_need := case when t.room = 'six' then 2 else 1 end;
  -- members only see times they are free themselves; the team may pass the member it books for
  p_member := case when is_team() then p_member else my_member_id() end;
  foreach v_slot in array s.slot_times loop
    v_start := local_ts(p_date, v_slot); v_end := v_start + make_interval(mins => t.duration_min);
    continue when v_slot::time < v_open or (v_slot::time + make_interval(mins => t.duration_min)) > v_close;
    continue when v_start < now() + interval '1 hour';
    continue when p_member is not null and exists (
      select 1 from appointments a where a.member_id = p_member and a.is_primary and a.status <> 'geannuleerd'
        and (a.confirmed or a.hold_until > now()) and (p_skip_group is null or a.group_id <> p_skip_group)
        and tstzrange(a.starts_at, a.ends_at) && tstzrange(v_start, v_end));
    -- a room of the right type must be free
    continue when not exists (
      select 1 from rooms r where r.type = t.room and r.active and not exists (
        select 1 from appointments a where a.room_id = r.id and a.is_primary and a.status <> 'geannuleerd'
          and (a.confirmed or a.hold_until > now()) and (p_skip_group is null or a.group_id <> p_skip_group)
          and tstzrange(a.starts_at, a.ends_at) && tstzrange(v_start, v_end)));
    select array_agg(st.id order by (select count(*) from appointments x where x.staff_id = st.id
             and x.status <> 'geannuleerd' and x.starts_at::date = v_start::date), st.created_at)
      into v_staff
    from staff st
    where st.active and st.workdays[weekday_idx(p_date) + 1]
      and exists (select 1 from staff_skills k where k.staff_id = st.id and k.category_id = t.category_id)
      and not exists (select 1 from appointments a where a.staff_id = st.id and a.status <> 'geannuleerd'
          and (a.confirmed or a.hold_until > now()) and (p_skip_group is null or a.group_id <> p_skip_group)
          and tstzrange(a.starts_at, a.ends_at) && tstzrange(v_start, v_end));
    if coalesce(array_length(v_staff, 1), 0) >= v_need then slot := v_slot; staff_ids := v_staff; return next; end if;
  end loop;
end $$;

-- ───────────────────────────── Booking (internal) ─────────────────────────────
-- Clear messages for times that can never be booked (closed, past, not a start time)
create function check_bookable_time(p_treatment text, p_date date, p_time text) returns void
language plpgsql stable security definer set search_path = public as $$
declare s settings; t treatments; v_day jsonb;
begin
  select * into s from settings where id = 1;
  select * into t from treatments where id = p_treatment;
  if p_time is null or not p_time = any(s.slot_times) then raise exception 'Kies een van de beschikbare starttijden'; end if;
  if local_ts(p_date, p_time) < now() + interval '1 hour' then raise exception 'Dit moment ligt in het verleden of is te kort dag'; end if;
  v_day := s.hours -> weekday_idx(p_date);
  if v_day is null or v_day->>1 is null then raise exception 'We zijn op deze dag gesloten'; end if;
  if p_time::time < (v_day->>1)::time or p_time::time + make_interval(mins => t.duration_min) > (v_day->>2)::time then
    raise exception 'Dit valt buiten onze openingstijden (% – %)', v_day->>1, v_day->>2;
  end if;
end $$;

-- Places the appointment row(s). Callers check who may book; this checks the salon rules.
create function place_appointment(p_member uuid, p_treatment text, p_date date, p_time text, p_staff uuid,
  p_room text, p_note text, p_paid numeric, p_confirmed boolean, p_skip_group uuid, p_by uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  t treatments; v_slot record; v_staff uuid[]; v_room text; v_group uuid := gen_random_uuid(); v_start timestamptz;
begin
  select * into t from treatments where id = p_treatment and active;
  if t.id is null then raise exception 'Deze behandeling is niet beschikbaar'; end if;
  perform check_bookable_time(p_treatment, p_date, p_time);
  if exists (select 1 from appointments a where a.member_id = p_member and a.is_primary and a.status <> 'geannuleerd'
       and (a.confirmed or a.hold_until > now()) and (p_skip_group is null or a.group_id <> p_skip_group)
       and tstzrange(a.starts_at, a.ends_at) && tstzrange(local_ts(p_date, p_time), local_ts(p_date, p_time) + make_interval(mins => t.duration_min))) then
    raise exception 'Je hebt op dit tijdstip al een afspraak';
  end if;
  select * into v_slot from available_slots(p_treatment, p_date, p_skip_group, p_member) a where a.slot = p_time;
  if v_slot.slot is null then raise exception 'Dit tijdstip is niet meer beschikbaar. Kies een ander moment.'; end if;
  if p_staff is not null then
    if not p_staff = any(v_slot.staff_ids) then raise exception 'Deze specialist is op dit tijdstip niet beschikbaar'; end if;
    v_staff := array[p_staff] || array_remove(v_slot.staff_ids, p_staff);
  else
    v_staff := v_slot.staff_ids;
  end if;
  v_start := local_ts(p_date, p_time);
  select r.id into v_room from rooms r
   where r.type = t.room and r.active and (p_room is null or r.id = p_room)
     and not exists (select 1 from appointments a where a.room_id = r.id and a.is_primary and a.status <> 'geannuleerd'
       and (a.confirmed or a.hold_until > now()) and (p_skip_group is null or a.group_id <> p_skip_group)
       and tstzrange(a.starts_at, a.ends_at) && tstzrange(v_start, v_start + make_interval(mins => t.duration_min)))
   order by r.sort limit 1;
  if v_room is null then raise exception 'Er is op dit tijdstip geen ruimte vrij'; end if;

  insert into appointments (member_id, treatment_id, staff_id, room_id, starts_at, ends_at, group_id, is_primary,
                            paid_amount, confirmed, hold_until, note, rescheduled_from, created_by)
  values (p_member, t.id, v_staff[1], v_room, v_start, v_start + make_interval(mins => t.duration_min), v_group, true,
          coalesce(p_paid, 0), p_confirmed, case when p_confirmed then null else now() + interval '30 minutes' end,
          left(coalesce(p_note, ''), 500), null, p_by);
  if t.room = 'six' then
    insert into appointments (member_id, treatment_id, staff_id, room_id, starts_at, ends_at, group_id, is_primary,
                              paid_amount, confirmed, hold_until, created_by)
    values (p_member, t.id, v_staff[2], v_room, v_start, v_start + make_interval(mins => t.duration_min), v_group, false,
            0, p_confirmed, case when p_confirmed then null else now() + interval '30 minutes' end, p_by);
  end if;
  return v_group;
exception
  when exclusion_violation then
    declare v_c text; begin
      get stacked diagnostics v_c = constraint_name;
      if v_c = 'member_free' then raise exception 'Je hebt op dit tijdstip al een afspraak'; end if;
      raise exception 'Dit tijdstip is net door iemand anders geboekt. Kies een ander moment.';
    end;
end $$;

-- ───────────────────────────── Member functions ─────────────────────────────
-- Onboarding: create or update the member's own row before the first payment
create function member_onboard(p_name text, p_phone text, p_routine text[], p_plan text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_email text;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Vul je naam in'; end if;
  if not exists (select 1 from plans where id = p_plan and active) then raise exception 'Kies een membership'; end if;
  select email into v_email from auth.users where id = auth.uid();
  select id into v_id from members where user_id = auth.uid();
  if v_id is null then
    insert into members (user_id, name, email, phone, plan_id, routine)
    values (auth.uid(), left(trim(p_name), 120), v_email, nullif(left(trim(coalesce(p_phone, '')), 30), ''), p_plan,
            coalesce((select array_agg(x) from unnest(p_routine) x where x in (select id from treatments)), '{}'))
    returning id into v_id;
  elsif (select status from members where id = v_id) = 'nieuw' then
    update members set name = left(trim(p_name), 120), phone = nullif(left(trim(coalesce(p_phone, '')), 30), ''),
      plan_id = p_plan, routine = coalesce((select array_agg(x) from unnest(p_routine) x where x in (select id from treatments)), '{}')
    where id = v_id;
  else
    raise exception 'Je bent al member. Wijzig je membership in de app.';
  end if;
  update profiles set name = left(trim(p_name), 120) where id = auth.uid();
  update waitlist set status = 'member' where lower(email) = lower(v_email);
  return v_id;
end $$;

-- Book (or reschedule) an own appointment. Returns whether a separate payment is needed.
create function book_appointment(p_treatment text, p_date date, p_time text, p_staff uuid default null,
  p_note text default '', p_reschedule uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m members; t treatments; s settings; v_old appointments; v_used int; v_limit int; v_included boolean;
  v_paid numeric := 0; v_group uuid; v_start timestamptz;
begin
  perform release_expired_holds();
  select * into m from members where user_id = auth.uid();
  if m.id is null then raise exception 'Je hebt nog geen membership'; end if;
  if m.status <> 'actief' then raise exception 'Je membership is niet actief (%).', m.status; end if;
  select * into t from treatments where id = p_treatment and active;
  if t.id is null then raise exception 'Deze behandeling is niet beschikbaar'; end if;
  select * into s from settings where id = 1;
  if p_date > (now() at time zone 'Europe/Amsterdam')::date + s.booking_days then
    raise exception 'Je kunt maximaal % dagen vooruit boeken', s.booking_days;
  end if;
  if m.cancel_at is not null and p_date >= m.cancel_at then raise exception 'Je membership loopt af vóór deze datum'; end if;
  v_start := local_ts(p_date, p_time);

  if p_reschedule is not null then
    select * into v_old from appointments where id = p_reschedule and member_id = m.id and is_primary for update;
    if v_old.id is null or v_old.status <> 'gepland' or not v_old.confirmed then raise exception 'Deze afspraak kun je niet verzetten'; end if;
    if v_old.starts_at - now() < make_interval(hours => s.cancel_hours) then
      raise exception 'Verzetten kan tot % uur van tevoren', s.cancel_hours;
    end if;
    if v_old.treatment_id <> p_treatment then raise exception 'Bij verzetten blijft de behandeling gelijk'; end if;
    v_paid := v_old.paid_amount;       -- an already paid treatment stays paid
  else
    v_included := exists (select 1 from plan_treatments where plan_id = m.plan_id and treatment_id = t.id);
    v_used := used_in_month(m.id, p_date);
    v_limit := limit_in_month(m.id, p_date);
    if not v_included or v_used >= v_limit then v_paid := t.price; end if;
  end if;

  v_group := place_appointment(m.id, t.id, p_date, p_time, p_staff, null, p_note, v_paid,
                               v_paid = 0 or p_reschedule is not null, v_old.group_id, auth.uid());
  if p_reschedule is not null then
    update appointments set status = 'geannuleerd', updated_at = now() where group_id = v_old.group_id;
    update appointments set rescheduled_from = v_old.id where group_id = v_group and is_primary;
    update payments set appointment_group = v_group where appointment_group = v_old.group_id;
  end if;
  return jsonb_build_object('group_id', v_group, 'needs_payment', v_paid > 0 and p_reschedule is null, 'amount', v_paid);
end $$;

-- Cancel an own appointment; inside cancel_hours it counts as used
create function cancel_appointment(p_appointment uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a appointments; s settings; v_late boolean;
begin
  select * into a from appointments where id = p_appointment and is_primary for update;
  if a.id is null or a.member_id is distinct from my_member_id() then raise exception 'Afspraak niet gevonden'; end if;
  if a.status <> 'gepland' then raise exception 'Deze afspraak kan niet meer geannuleerd worden'; end if;
  if a.starts_at <= now() then raise exception 'Deze afspraak is al begonnen'; end if;
  select * into s from settings where id = 1;
  v_late := a.confirmed and a.starts_at - now() < make_interval(hours => s.cancel_hours);
  update appointments set status = 'geannuleerd', late_cancel = v_late, updated_at = now() where group_id = a.group_id;
  return jsonb_build_object('late', v_late, 'refund', not v_late and a.paid_amount > 0 and a.confirmed, 'amount', a.paid_amount);
end $$;

-- ───────────────────────────── Team functions ─────────────────────────────
create function can_see_appointment(p_staff uuid) returns boolean language sql stable security definer set search_path = public as $$
  select has_perm('agenda') and (my_role() <> 'specialist' or p_staff in (select id from staff where user_id = auth.uid()))
$$;

-- Team plans an appointment for a member (Beheer → Agenda → Afspraak). Outside the plan or over the
-- limit it is marked as paid separately (the payment request is sent by the server).
create function team_book_appointment(p_member uuid, p_treatment text, p_date date, p_time text,
  p_staff uuid default null, p_room text default null, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare m members; t treatments; v_paid numeric := 0; v_group uuid;
begin
  if not has_perm('agenda') or my_role() = 'specialist' then raise exception 'Geen rechten om afspraken te plannen'; end if;
  perform release_expired_holds();
  select * into m from members where id = p_member;
  if m.id is null or m.status in ('nieuw', 'opgezegd') then raise exception 'Deze member kan niet boeken'; end if;
  select * into t from treatments where id = p_treatment;
  if not exists (select 1 from plan_treatments where plan_id = m.plan_id and treatment_id = p_treatment)
     or used_in_month(m.id, p_date) >= limit_in_month(m.id, p_date) then
    v_paid := t.price;
  end if;
  v_group := place_appointment(m.id, p_treatment, p_date, p_time, p_staff, p_room, p_note, v_paid, true, null, auth.uid());
  perform log_action('team_book', 'appointment', v_group::text, jsonb_build_object('member', p_member, 'treatment', p_treatment));
  return jsonb_build_object('group_id', v_group, 'paid_amount', v_paid);
end $$;

create function team_set_appointment_status(p_appointment uuid, p_status appt_status) returns void
language plpgsql security definer set search_path = public as $$
declare a appointments;
begin
  select * into a from appointments where id = p_appointment for update;
  if a.id is null or not can_see_appointment(a.staff_id) then raise exception 'Afspraak niet gevonden'; end if;
  if p_status = 'gepland' and a.status = 'geannuleerd' then
    raise exception 'Een geannuleerde afspraak plan je opnieuw in via Afspraak';
  end if;
  if p_status in ('afgerond', 'no-show') and a.starts_at > now() + interval '30 minutes' then
    raise exception 'Je kunt een afspraak pas afronden rond het starttijdstip';
  end if;
  -- the team cancels without counting it, unless it is marked as a no-show
  update appointments set status = p_status, late_cancel = false, updated_at = now() where group_id = a.group_id;
  perform log_action('appointment_status', 'appointment', a.group_id::text, jsonb_build_object('status', p_status));
end $$;

create function team_add_allowance(p_member uuid, p_delta int, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_perm('members') then raise exception 'Geen rechten'; end if;
  insert into allowance_adjustments (member_id, month, delta, reason, created_by)
  values (p_member, date_trunc('month', now() at time zone 'Europe/Amsterdam')::date, p_delta, left(coalesce(p_reason, ''), 200), auth.uid());
  perform log_action('allowance', 'member', p_member::text, jsonb_build_object('delta', p_delta));
end $$;

create function team_save_note(p_member uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_perm('members') then raise exception 'Geen rechten'; end if;
  insert into member_team_notes (member_id, body, updated_by) values (p_member, left(coalesce(p_body, ''), 4000), auth.uid())
  on conflict (member_id) do update set body = excluded.body, updated_by = auth.uid(), updated_at = now();
end $$;

-- Owner: give a team member a role (the account must exist; invitations go through the server)
create function owner_set_role(p_user uuid, p_role app_role) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_role() is distinct from 'owner' then raise exception 'Alleen de eigenaar kan rollen wijzigen'; end if;
  update profiles set role = p_role where id = p_user;
  perform log_action('set_role', 'profile', p_user::text, jsonb_build_object('role', p_role));
end $$;

-- Member details the agenda needs. Specialists only get members they have an appointment with,
-- and only name, plan, drink and the member's own note (no e-mail, phone or payment data).
create function agenda_members() returns table (id uuid, name text, plan_id text, drink text, notes text, used int, month_limit int)
language sql stable security definer set search_path = public as $$
  select m.id, m.name, m.plan_id, m.prefs->>'drink', m.notes,
         used_in_month(m.id, (now() at time zone 'Europe/Amsterdam')::date),
         limit_in_month(m.id, (now() at time zone 'Europe/Amsterdam')::date)
  from members m
  where has_perm('members')
     or (has_perm('agenda') and exists (select 1 from appointments a join staff s on s.id = a.staff_id
                                        where a.member_id = m.id and s.user_id = auth.uid()))
$$;

-- ───────────────────────────── Row level security ─────────────────────────────
alter table profiles enable row level security;
alter table role_perms enable row level security;
alter table categories enable row level security;
alter table treatments enable row level security;
alter table plans enable row level security;
alter table plan_treatments enable row level security;
alter table rooms enable row level security;
alter table staff enable row level security;
alter table staff_skills enable row level security;
alter table settings enable row level security;
alter table members enable row level security;
alter table member_team_notes enable row level security;
alter table allowance_adjustments enable row level security;
alter table appointments enable row level security;
alter table waitlist enable row level security;
alter table invoice_counters enable row level security;
alter table payments enable row level security;
alter table audit_log enable row level security;

create policy "own or settings" on profiles for select using (id = auth.uid() or has_perm('settings'));
create policy "own name" on profiles for update using (id = auth.uid() or my_role() = 'owner') with check (id = auth.uid() or my_role() = 'owner');
create policy "read" on role_perms for select using (auth.uid() is not null);
create policy "owner" on role_perms for update using (my_role() = 'owner' and role <> 'owner') with check (my_role() = 'owner' and role <> 'owner');

-- Catalogue: everyone may read what is live (onboarding happens before login); the team sees all
create policy "read" on categories for select using (true);
create policy "read" on treatments for select using (active or is_team());
create policy "read" on plans for select using (active or is_team());
create policy "read" on plan_treatments for select using (true);
create policy "read" on rooms for select using (true);
create policy "read" on staff for select using (active or is_team());
create policy "read" on staff_skills for select using (true);
create policy "read" on settings for select using (true);
create policy "write" on categories for all using (has_perm('plans')) with check (has_perm('plans'));
create policy "write" on treatments for all using (has_perm('plans')) with check (has_perm('plans'));
create policy "write" on plans for all using (has_perm('plans')) with check (has_perm('plans'));
create policy "write" on plan_treatments for all using (has_perm('plans')) with check (has_perm('plans'));
create policy "write" on rooms for all using (has_perm('settings')) with check (has_perm('settings'));
create policy "write" on staff for all using (has_perm('team')) with check (has_perm('team'));
create policy "write" on staff_skills for all using (has_perm('team')) with check (has_perm('team'));
create policy "write" on settings for update using (has_perm('settings')) with check (has_perm('settings'));

create policy "own or team" on members for select using (user_id = auth.uid() or has_perm('members'));
create policy "own or team update" on members for update using (user_id = auth.uid() or has_perm('members'))
  with check (user_id = auth.uid() or has_perm('members'));
create policy "team" on member_team_notes for select using (has_perm('members'));
create policy "own or team" on allowance_adjustments for select using (member_id = my_member_id() or has_perm('members'));

create policy "own or agenda" on appointments for select using (member_id = my_member_id() or can_see_appointment(staff_id));
create policy "team" on waitlist for select using (has_perm('waitlist'));
create policy "team update" on waitlist for update using (has_perm('waitlist')) with check (has_perm('waitlist'));
create policy "own or team" on payments for select using (member_id = my_member_id() or has_perm('finance') or has_perm('members'));
create policy "settings" on audit_log for select using (has_perm('settings'));

-- Table privileges: Supabase grants everything to anon/authenticated by default; narrow it down so
-- RLS is not the only line of defence. Writes with rules go through the functions above.
revoke all on all tables in schema public from anon, authenticated;
grant select on categories, treatments, plans, plan_treatments, rooms, staff, staff_skills, settings to anon, authenticated;
grant select on profiles, role_perms, members, member_team_notes, allowance_adjustments, appointments, waitlist, payments, audit_log to authenticated;
grant update (name) on profiles to authenticated;
grant update (perms) on role_perms to authenticated;
grant insert, update, delete on categories, treatments, plans, plan_treatments, rooms, staff, staff_skills to authenticated;
grant update (hours, slot_times, booking_days, cancel_hours, no_show_counts, rollover, pause_months_per_year, mollie_mode) on settings to authenticated;
grant update (name, phone, routine, prefs, notes) on members to authenticated;
grant update (status) on waitlist to authenticated;

revoke execute on all functions in schema public from public, anon;
-- Policies call these, also for visitors that are not logged in (they simply return false/null then)
grant execute on function my_role(), is_team(), has_perm(text), my_member_id(), can_see_appointment(uuid) to anon, authenticated;
grant execute on function available_slots(text, date, uuid, uuid), used_in_month(uuid, date, uuid), limit_in_month(uuid, date) to authenticated;
grant execute on function member_onboard(text, text, text[], text), book_appointment(text, date, text, uuid, text, uuid),
  cancel_appointment(uuid), team_book_appointment(uuid, text, date, text, uuid, text, text),
  team_set_appointment_status(uuid, appt_status), team_add_allowance(uuid, int, text), team_save_note(uuid, text),
  owner_set_role(uuid, app_role), agenda_members() to authenticated;
-- Internal helpers stay callable only by the database itself (and the service role)
revoke execute on function check_bookable_time(text, date, text) from authenticated;
revoke execute on function place_appointment(uuid, text, date, text, uuid, text, text, numeric, boolean, uuid, uuid),
  release_expired_holds(), next_invoice_no(timestamptz), log_action(text, text, text, jsonb) from authenticated;

-- Live agenda in Beheer and the member app
alter publication supabase_realtime add table appointments;

-- ───────────────────────────── Seed (same as the prototype) ─────────────────────────────
insert into categories (id, name, title, title_it, img, sort) values
('nails', 'Manicure & pedicure', 'Perfectly', 'polished.', '/assets/nails-mobile-v21.webp', 1),
('brows', 'Brows & lashes', 'Eyes', 'on you.', '/assets/brows-v23.webp', 2),
('hair', 'Blowouts', 'Good hair', 'energy.', '/assets/blowouts-v18.webp', 3),
('skin', 'Skincare & facials', 'Face', 'the day.', '/assets/skincare-v21.webp', 4),
('smooth', 'Laser & wax', 'Smooth', 'your way.', '/assets/smooth-v23.webp', 5),
('six', 'Six hands', 'Better', 'together.', '/assets/tour-duo-v26.webp', 6);

insert into treatments (id, category_id, name, duration_min, price, room, sort) values
('mani', 'nails', 'Manicure classic', 45, 45, 'solo', 1), ('gel', 'nails', 'Gellak manicure', 60, 55, 'solo', 2),
('pedi', 'nails', 'Pedicure', 60, 55, 'solo', 3), ('art', 'nails', 'Nail art', 30, 25, 'solo', 4),
('browlam', 'brows', 'Brow lamination', 45, 59, 'solo', 5), ('lash', 'brows', 'Lash lift', 60, 65, 'solo', 6),
('browtint', 'brows', 'Brow shape & tint', 30, 35, 'solo', 7), ('blow', 'hair', 'Blowout', 45, 45, 'solo', 8),
('curls', 'hair', 'Blowout met krullen', 60, 55, 'solo', 9), ('fexp', 'skin', 'Express facial', 30, 49, 'solo', 10),
('fsig', 'skin', 'Signature facial', 75, 110, 'solo', 11), ('waxl', 'smooth', 'Wax benen', 45, 49, 'solo', 12),
('lasers', 'smooth', 'Laser klein gebied', 30, 69, 'solo', 13), ('laserl', 'smooth', 'Laser groot gebied', 60, 139, 'solo', 14),
('six1', 'six', 'Six hands: mani, pedi & blowout', 75, 149, 'six', 15), ('duo', 'six', 'Duo-moment voor twee', 60, 120, 'duo', 16);

insert into plans (id, name, price, per_month, description, active, sort) values
('essential', 'Essential', 79, 2, 'De basis van je routine.', true, 1),
('signature', 'Signature', 149, 4, 'Je vaste rituelen, elke maand.', true, 2),
('edit', 'The Edit', 229, 6, 'Alles, inclusief six hands.', true, 3);

insert into plan_treatments (plan_id, treatment_id)
select 'essential', unnest(array['mani', 'gel', 'browtint', 'blow', 'fexp']) union all
select 'signature', unnest(array['mani', 'gel', 'pedi', 'browtint', 'browlam', 'lash', 'blow', 'curls', 'fexp', 'waxl']) union all
select 'edit', unnest(array['mani', 'gel', 'pedi', 'art', 'browtint', 'browlam', 'lash', 'blow', 'curls', 'fexp', 'fsig', 'waxl', 'lasers', 'six1', 'duo']);

insert into rooms (id, name, type, sort) values
('solo1', 'Solo 1', 'solo', 1), ('solo2', 'Solo 2', 'solo', 2), ('solo3', 'Solo 3', 'solo', 3), ('solo4', 'Solo 4', 'solo', 4),
('duo', 'Duo-suite', 'duo', 5), ('six', 'Six hands suite', 'six', 6);

insert into settings (id, hours) values (1,
'[["Maandag","10:00","20:00"],["Dinsdag","09:00","20:00"],["Woensdag","09:00","20:00"],["Donderdag","09:00","21:00"],["Vrijdag","09:00","21:00"],["Zaterdag","09:00","18:00"],["Zondag","11:00","17:00"]]');

-- After your first login as hallo@beautypass.nl, make yourself owner (run in the SQL Editor):
--   update profiles set role = 'owner' where email = 'hallo@beautypass.nl';
