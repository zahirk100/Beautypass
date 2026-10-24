-- BeautyPass 007: kids corner, specialist absence and salon closing days. Run after 006.
--  · Kids corner: a member reserves a spot for 1–3 children with the booking; the salon sets how many
--    children fit at the same time. The team sees it in the agenda, on the dashboard and at check-in.
--  · Absence: a specialist who is on holiday or ill gets no bookings on those days.
--  · Closing days: holidays etc.; nobody can book then.
set search_path = public, extensions;

alter table settings add column if not exists kids_enabled boolean not null default true;
alter table settings add column if not exists kids_capacity int not null default 3 check (kids_capacity between 0 and 20);
alter table settings add column if not exists closed_dates date[] not null default '{}';
grant update (kids_enabled, kids_capacity, closed_dates) on settings to authenticated;

alter table appointments add column if not exists kids smallint not null default 0 check (kids between 0 and 3);

create table if not exists staff_absence (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff on delete cascade,
  starts date not null, ends date not null check (ends >= starts),
  reason text not null default '' check (char_length(reason) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists staff_absence_staff on staff_absence (staff_id, starts);
alter table staff_absence enable row level security;
drop policy if exists "team read" on staff_absence;
drop policy if exists "team write" on staff_absence;
create policy "team read" on staff_absence for select using (is_team());
create policy "team write" on staff_absence for all using (has_perm('team')) with check (has_perm('team'));
revoke all on staff_absence from anon, authenticated;
grant select, insert, update, delete on staff_absence to authenticated;

-- Free times: also skips closing days and absent specialists (otherwise unchanged)
create or replace function available_slots(p_treatment text, p_date date, p_skip_group uuid default null, p_member uuid default null)
returns table (slot text, staff_ids uuid[])
language plpgsql stable security definer set search_path = public as $$
declare
  t treatments; s settings; v_day jsonb; v_open time; v_close time; v_slot text; v_start timestamptz; v_end timestamptz;
  v_staff uuid[]; v_need int;
begin
  select * into t from treatments where id = p_treatment and active;
  select * into s from settings where id = 1;
  if t.id is null or p_date < (now() at time zone 'Europe/Amsterdam')::date then return; end if;
  if p_date = any(s.closed_dates) then return; end if;
  v_day := s.hours -> weekday_idx(p_date);
  if v_day is null or v_day->>1 is null or v_day->>2 is null then return; end if;
  v_open := (v_day->>1)::time; v_close := (v_day->>2)::time;
  v_need := case when t.room = 'six' then 2 else 1 end;
  p_member := case when is_team() then p_member else my_member_id() end;
  foreach v_slot in array s.slot_times loop
    v_start := local_ts(p_date, v_slot); v_end := v_start + make_interval(mins => t.duration_min);
    continue when v_slot::time < v_open or (v_slot::time + make_interval(mins => t.duration_min)) > v_close;
    continue when v_start < now() + interval '1 hour';
    continue when p_member is not null and exists (
      select 1 from appointments a where a.member_id = p_member and a.is_primary and a.status <> 'geannuleerd'
        and (a.confirmed or a.hold_until > now()) and (p_skip_group is null or a.group_id <> p_skip_group)
        and tstzrange(a.starts_at, a.ends_at) && tstzrange(v_start, v_end));
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
      and not exists (select 1 from staff_absence ab where ab.staff_id = st.id and p_date between ab.starts and ab.ends)
      and not exists (select 1 from appointments a where a.staff_id = st.id and a.status <> 'geannuleerd'
          and (a.confirmed or a.hold_until > now()) and (p_skip_group is null or a.group_id <> p_skip_group)
          and tstzrange(a.starts_at, a.ends_at) && tstzrange(v_start, v_end));
    if coalesce(array_length(v_staff, 1), 0) >= v_need then slot := v_slot; staff_ids := v_staff; return next; end if;
  end loop;
end $$;

create or replace function check_bookable_time(p_treatment text, p_date date, p_time text) returns void
language plpgsql stable security definer set search_path = public as $$
declare s settings; t treatments; v_day jsonb;
begin
  select * into s from settings where id = 1;
  select * into t from treatments where id = p_treatment;
  if p_time is null or not p_time = any(s.slot_times) then raise exception 'Kies een van de beschikbare starttijden'; end if;
  if local_ts(p_date, p_time) < now() + interval '1 hour' then raise exception 'Dit moment ligt in het verleden of is te kort dag'; end if;
  if p_date = any(s.closed_dates) then raise exception 'De salon is op % gesloten', to_char(p_date, 'DD-MM-YYYY'); end if;
  v_day := s.hours -> weekday_idx(p_date);
  if v_day is null or v_day->>1 is null then raise exception 'We zijn op deze dag gesloten'; end if;
  if p_time::time < (v_day->>1)::time or p_time::time + make_interval(mins => t.duration_min) > (v_day->>2)::time then
    raise exception 'Dit valt buiten onze openingstijden (% – %)', v_day->>1, v_day->>2;
  end if;
end $$;

-- Kids corner: children present at the same time may not exceed the capacity
create or replace function apply_kids(p_group uuid, p_kids int) returns void
language plpgsql security definer set search_path = public as $$
declare s settings; a appointments; v_taken int;
begin
  p_kids := greatest(0, least(3, coalesce(p_kids, 0)));
  select * into a from appointments where group_id = p_group and is_primary;
  if p_kids > 0 then
    select * into s from settings where id = 1;
    if not s.kids_enabled then raise exception 'De kinderhoek is op dit moment niet te reserveren'; end if;
    select coalesce(sum(x.kids), 0) into v_taken from appointments x
     where x.is_primary and x.group_id <> p_group and x.status = 'gepland' and x.kids > 0
       and (x.confirmed or x.hold_until > now()) and tstzrange(x.starts_at, x.ends_at) && tstzrange(a.starts_at, a.ends_at);
    if v_taken + p_kids > s.kids_capacity then
      if s.kids_capacity - v_taken <= 0 then
        raise exception 'De kinderhoek is om % vol', to_char(a.starts_at at time zone 'Europe/Amsterdam', 'HH24:MI');
      end if;
      raise exception 'In de kinderhoek is om % nog plek voor % %', to_char(a.starts_at at time zone 'Europe/Amsterdam', 'HH24:MI'),
        s.kids_capacity - v_taken, case when s.kids_capacity - v_taken = 1 then 'kind' else 'kinderen' end;
    end if;
  end if;
  update appointments set kids = p_kids, updated_at = now() where group_id = p_group and is_primary;
end $$;
revoke execute on function apply_kids(uuid, int) from public, anon, authenticated;

-- How full the kids corner is on a day (no names), for the booking screen
create or replace function kids_busy(p_date date) returns table (starts_at timestamptz, ends_at timestamptz, kids int)
language sql stable security definer set search_path = public as $$
  select a.starts_at, a.ends_at, a.kids::int from appointments a
   where a.is_primary and a.status = 'gepland' and a.kids > 0 and (a.confirmed or a.hold_until > now())
     and (a.starts_at at time zone 'Europe/Amsterdam')::date = p_date and auth.uid() is not null
$$;

-- Change the kids corner on an existing appointment (the member's own, or the team)
create or replace function set_appointment_kids(p_appointment uuid, p_kids int) returns void
language plpgsql security definer set search_path = public as $$
declare a appointments;
begin
  select * into a from appointments where id = p_appointment and is_primary for update;
  if a.id is null or not (a.member_id = my_member_id() or can_see_appointment(a.staff_id)) then raise exception 'Afspraak niet gevonden'; end if;
  if a.status <> 'gepland' or a.starts_at < now() then raise exception 'Deze afspraak kun je niet meer wijzigen'; end if;
  perform apply_kids(a.group_id, p_kids);
end $$;

-- Booking with the kids corner (the old signature is replaced)
drop function if exists book_appointment(text, date, text, uuid, text, uuid);
create or replace function book_appointment(p_treatment text, p_date date, p_time text, p_staff uuid default null,
  p_note text default '', p_reschedule uuid default null, p_kids int default 0)
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
    v_paid := v_old.paid_amount;
  else
    v_included := exists (select 1 from plan_treatments where plan_id = m.plan_id and treatment_id = t.id);
    v_used := used_in_month(m.id, p_date);
    v_limit := limit_in_month(m.id, p_date);
    if not v_included or v_used >= v_limit then v_paid := t.price; end if;
  end if;

  v_group := place_appointment(m.id, t.id, p_date, p_time, p_staff, null, p_note, v_paid,
                               v_paid = 0 or p_reschedule is not null, v_old.group_id, auth.uid());
  if p_reschedule is not null then
    update appointments set status = 'geannuleerd', cancel_reason = 'verzet', updated_at = now() where group_id = v_old.group_id;
    update appointments set rescheduled_from = v_old.id where group_id = v_group and is_primary;
    update payments set appointment_group = v_group where appointment_group = v_old.group_id;
  end if;
  perform apply_kids(v_group, p_kids);
  return jsonb_build_object('group_id', v_group, 'needs_payment', v_paid > 0 and p_reschedule is null, 'amount', v_paid);
end $$;

drop function if exists team_book_appointment(uuid, text, date, text, uuid, text, text);
create or replace function team_book_appointment(p_member uuid, p_treatment text, p_date date, p_time text,
  p_staff uuid default null, p_room text default null, p_note text default '', p_kids int default 0)
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
  perform apply_kids(v_group, p_kids);
  perform log_action('team_book', 'appointment', v_group::text, jsonb_build_object('member', p_member, 'treatment', p_treatment));
  return jsonb_build_object('group_id', v_group, 'paid_amount', v_paid);
end $$;

-- Check-in also shows the kids corner
create or replace function team_checkin(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_code text; m members; v_today date := (now() at time zone 'Europe/Amsterdam')::date; v_appts jsonb; v_next jsonb;
begin
  if not has_perm('agenda') then raise exception 'Hiervoor heb je geen rechten'; end if;
  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_code := substring(v_code from '(BP[A-Z0-9]{10})$');
  if v_code is null then raise exception 'Dit is geen BeautyPass-pas'; end if;
  select * into m from members where checkin_code = v_code;
  if m.id is null then raise exception 'Deze pas is niet (meer) geldig'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'treatment', a.treatment_id, 'staff', a.staff_id, 'room', a.room_id,
           'starts_at', a.starts_at, 'status', a.status, 'checked_in_at', a.checked_in_at, 'paid', a.paid_amount,
           'confirmed', a.confirmed, 'kids', a.kids) order by a.starts_at), '[]')
    into v_appts
    from appointments a
   where a.member_id = m.id and a.is_primary and a.status <> 'geannuleerd'
     and (a.starts_at at time zone 'Europe/Amsterdam')::date = v_today and can_see_appointment(a.staff_id);
  select jsonb_build_object('treatment', a.treatment_id, 'starts_at', a.starts_at) into v_next
    from appointments a
   where a.member_id = m.id and a.is_primary and a.status = 'gepland' and a.starts_at > now()
     and (a.starts_at at time zone 'Europe/Amsterdam')::date > v_today
   order by a.starts_at limit 1;
  perform log_action('checkin_scan', 'member', m.id::text, '{}');
  return jsonb_build_object(
    'member', jsonb_build_object('id', m.id, 'name', m.name, 'plan', m.plan_id, 'status', m.status,
       'drink', m.prefs->>'drink', 'notes', m.notes, 'routine', to_jsonb(m.routine),
       'team_note', case when has_perm('members') then (select body from member_team_notes where member_id = m.id) end,
       'used', used_in_month(m.id, v_today), 'limit', limit_in_month(m.id, v_today)),
    'today', v_appts, 'next', v_next);
end $$;

revoke execute on function book_appointment(text, date, text, uuid, text, uuid, int),
  team_book_appointment(uuid, text, date, text, uuid, text, text, int), kids_busy(date), set_appointment_kids(uuid, int) from public, anon;
grant execute on function book_appointment(text, date, text, uuid, text, uuid, int),
  team_book_appointment(uuid, text, date, text, uuid, text, text, int), kids_busy(date), set_appointment_kids(uuid, int) to authenticated;

-- "Ongebruikte behandelingen meenemen" (Instellingen → Boekingsregels) now really works: what was left
-- last month carries over to this month (at most one month's worth, and only after a full month as member)
create or replace function limit_in_month(p_member uuid, p_month date) returns int
language plpgsql stable security definer set search_path = public as $$
declare v_month date := date_trunc('month', p_month::timestamp)::date; v_prev date := (date_trunc('month', p_month::timestamp) - interval '1 month')::date;
  v_per int; v_since date; v_extra int; v_prev_extra int; v_carry int := 0;
begin
  select p.per_month, m.since into v_per, v_since from members m join plans p on p.id = m.plan_id where m.id = p_member;
  if v_per is null then return 0; end if;
  select coalesce(sum(delta), 0) into v_extra from allowance_adjustments where member_id = p_member and month = v_month;
  if (select rollover from settings where id = 1) and v_since <= v_prev then
    select coalesce(sum(delta), 0) into v_prev_extra from allowance_adjustments where member_id = p_member and month = v_prev;
    v_carry := greatest(0, least(v_per, v_per + v_prev_extra - used_in_month(p_member, v_prev)));
  end if;
  return v_per + v_extra + v_carry;
end $$;

-- Usage and limit this month as the database counts it (members: their own; team with "members": everyone)
create or replace function month_usage() returns table (member_id uuid, used int, month_limit int)
language sql stable security definer set search_path = public as $$
  select m.id, used_in_month(m.id, (now() at time zone 'Europe/Amsterdam')::date), limit_in_month(m.id, (now() at time zone 'Europe/Amsterdam')::date)
  from members m where m.id = my_member_id() or has_perm('members')
$$;
revoke execute on function month_usage() from public, anon;
grant execute on function month_usage() to authenticated;
