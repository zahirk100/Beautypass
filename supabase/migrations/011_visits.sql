-- BeautyPass 011: your whole routine in one visit. Several treatments are planned back to back, or at the same
-- time by several specialists (six hands) when they do not get in each other's way. Run after 010.
set search_path = public, extensions;

-- ───────── Where on the body a treatment happens: two treatments can be done at the same time when the zones fit ─────────
alter table treatments add column if not exists zone text check (zone in ('head', 'face', 'hands', 'feet', 'body'));
update treatments set zone = case
    when name ilike '%pedi%' then 'feet'
    when category_id = 'hair' then 'head'
    when category_id in ('brows', 'skin') then 'face'
    when category_id = 'nails' then 'hands'
    when category_id = 'smooth' then 'body'
  end
 where zone is null and room = 'solo';

-- Several specialists at the same time (Instellingen → Routine); off = always one after the other
alter table settings add column if not exists parallel_enabled boolean not null default true;
grant update (parallel_enabled) on settings to authenticated;

-- ───────── A visit: the treatments of one routine booking. Each treatment stays its own appointment ─────────
create table if not exists visits (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members on delete cascade,
  created_at timestamptz not null default now(),
  booked_mail_at timestamptz,
  cancelled_mail_at timestamptz,
  reminder_at timestamptz
);
alter table visits enable row level security;
revoke all on visits from anon, authenticated;

alter table appointments add column if not exists visit_id uuid references visits on delete set null;
create index if not exists appointments_visit on appointments (visit_id) where visit_id is not null;

-- Treatments of the same visit may share the member and the (duo/six hands) room at the same moment
alter table appointments drop constraint if exists room_free;
alter table appointments add constraint room_free exclude using gist
  (room_id with =, tstzrange(starts_at, ends_at) with &&, (coalesce(visit_id, id)) with <>)
  where (status <> 'geannuleerd' and is_primary);
alter table appointments drop constraint if exists member_free;
alter table appointments add constraint member_free exclude using gist
  (member_id with =, tstzrange(starts_at, ends_at) with &&, (coalesce(visit_id, id)) with <>)
  where (status <> 'geannuleerd' and is_primary);

-- ───────── Planning helpers ─────────
create or replace function zones_ok(a text, b text) returns boolean
language sql immutable as $$
  select a is not null and b is not null and a <> b and a <> 'body' and b <> 'body'
     and not (least(a, b) = 'face' and greatest(a, b) = 'head')
$$;

create or replace function room_busy(p_room text, p_from timestamptz, p_to timestamptz, p_skip uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from appointments a where a.room_id = p_room and a.is_primary and a.status <> 'geannuleerd'
    and (a.confirmed or a.hold_until > now()) and (p_skip is null or a.visit_id is distinct from p_skip)
    and tstzrange(a.starts_at, a.ends_at) && tstzrange(p_from, p_to))
$$;

create or replace function staff_busy(p_staff uuid, p_from timestamptz, p_to timestamptz, p_skip uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from appointments a where a.staff_id = p_staff and a.status <> 'geannuleerd'
    and (a.confirmed or a.hold_until > now()) and (p_skip is null or a.visit_id is distinct from p_skip)
    and tstzrange(a.starts_at, a.ends_at) && tstzrange(p_from, p_to))
$$;

-- One concrete plan for the given waves (treatments in one wave start together, waves follow each other)
create or replace function visit_try(p_member uuid, p_waves jsonb, p_date date, p_start timestamptz, p_close timestamptz,
  p_skip uuid, p_parallel boolean) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_total int; v_end timestamptz; v_max int; v_room text; v_prev_room text; v_pref uuid; v_prefs jsonb;
  w jsonb; seg jsonb; wi int := 0; v_ws timestamptz; v_we timestamptz; v_staff uuid; v_used uuid[]; v_segs jsonb := '[]';
begin
  select sum((select max((x->>'dur')::int) from jsonb_array_elements(wv) x)), max(jsonb_array_length(wv))
    into v_total, v_max from jsonb_array_elements(p_waves) wv;
  v_end := p_start + make_interval(mins => v_total);
  if v_end > p_close then return null; end if;
  if p_member is not null and exists (select 1 from appointments a where a.member_id = p_member and a.is_primary
      and a.status <> 'geannuleerd' and (a.confirmed or a.hold_until > now())
      and (p_skip is null or a.visit_id is distinct from p_skip) and tstzrange(a.starts_at, a.ends_at) && tstzrange(p_start, v_end)) then
    return null;
  end if;
  select prefs into v_prefs from members where id = p_member;
  v_pref := case when v_prefs->>'specialist' ~ '^[0-9a-f-]{36}$' then (v_prefs->>'specialist')::uuid end;
  -- At the same time: the whole visit in one duo or six hands room
  if p_parallel then
    select r.id into v_room from rooms r
     where r.active and r.type::text = any(case when v_max >= 3 then array['six'] else array['duo', 'six'] end)
       and not room_busy(r.id, p_start, v_end, p_skip) order by r.sort limit 1;
    if v_room is null then return null; end if;
  end if;
  v_ws := p_start;
  for w in select value from jsonb_array_elements(p_waves) with ordinality order by ordinality loop
    v_used := '{}';
    for seg in select value from jsonb_array_elements(w) with ordinality order by ordinality loop
      v_we := v_ws + make_interval(mins => (seg->>'dur')::int);
      select st.id into v_staff from staff st
       where st.active and st.workdays[weekday_idx(p_date) + 1]
         and exists (select 1 from staff_skills k where k.staff_id = st.id and k.category_id = seg->>'cat')
         and not exists (select 1 from staff_absence ab where ab.staff_id = st.id and p_date between ab.starts and ab.ends)
         and not st.id = any(v_used)
         and not staff_busy(st.id, v_ws, v_we, p_skip)
       order by (st.id = v_pref) desc,
         (select count(*) from appointments x where x.staff_id = st.id and x.status <> 'geannuleerd'
            and (x.starts_at at time zone 'Europe/Amsterdam')::date = p_date), st.created_at
       limit 1;
      if v_staff is null then return null; end if;
      if not p_parallel then
        -- one after the other: stay in the same room when it is free
        select r.id into v_room from rooms r where r.active and r.type = 'solo' and not room_busy(r.id, v_ws, v_we, p_skip)
         order by (r.id = v_prev_room) desc, r.sort limit 1;
        if v_room is null then return null; end if;
        v_prev_room := v_room;
      end if;
      v_used := v_used || v_staff;
      v_segs := v_segs || jsonb_build_array(jsonb_build_object('treatment', seg->>'id', 'staff', v_staff, 'room', v_room,
        'wave', wi, 'starts', v_ws, 'ends', v_we, 'time', to_char(v_ws at time zone 'Europe/Amsterdam', 'HH24:MI'),
        'until', to_char(v_we at time zone 'Europe/Amsterdam', 'HH24:MI')));
    end loop;
    v_ws := v_ws + make_interval(mins => (select max((x->>'dur')::int) from jsonb_array_elements(w) x));
    wi := wi + 1;
  end loop;
  return jsonb_build_object('start', to_char(p_start at time zone 'Europe/Amsterdam', 'HH24:MI'),
    'end', to_char(v_end at time zone 'Europe/Amsterdam', 'HH24:MI'), 'minutes', v_total, 'parallel', p_parallel, 'segments', v_segs);
end $$;

-- The plan for a routine at one start time: at the same time where possible, otherwise one after the other
create or replace function plan_visit(p_member uuid, p_treatments text[], p_date date, p_time text, p_skip uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s settings; v_day jsonb; v_start timestamptz; v_close timestamptz; v_items jsonb; v_waves jsonb; it jsonb;
  w int; placed boolean; v_try int; v_plan jsonb;
begin
  select * into s from settings where id = 1;
  if p_time is null or not p_time = any(s.slot_times) or p_date = any(s.closed_dates) then return null; end if;
  v_day := s.hours -> weekday_idx(p_date);
  if v_day is null or v_day->>1 is null or v_day->>2 is null then return null; end if;
  v_start := local_ts(p_date, p_time);
  if v_start < now() + interval '1 hour' or p_time::time < (v_day->>1)::time then return null; end if;
  v_close := local_ts(p_date, v_day->>2);
  select jsonb_agg(jsonb_build_object('id', t.id, 'dur', t.duration_min, 'cat', t.category_id, 'zone', t.zone)
           order by t.duration_min desc, t.sort)
    into v_items from treatments t where t.id = any(p_treatments) and t.active and t.room = 'solo';
  if v_items is null or jsonb_array_length(v_items) <> (select count(distinct x) from unnest(p_treatments) x) then return null; end if;
  for v_try in 1 .. 2 loop
    v_waves := '[]';
    for it in select value from jsonb_array_elements(v_items) with ordinality order by ordinality loop
      placed := false;
      if v_try = 1 and s.parallel_enabled then
        for w in 0 .. jsonb_array_length(v_waves) - 1 loop
          if jsonb_array_length(v_waves->w) < 3
             and not exists (select 1 from jsonb_array_elements(v_waves->w) o where not zones_ok(o->>'zone', it->>'zone')) then
            v_waves := jsonb_set(v_waves, array[w::text], (v_waves->w) || jsonb_build_array(it));
            placed := true; exit;
          end if;
        end loop;
      end if;
      if not placed then v_waves := v_waves || jsonb_build_array(jsonb_build_array(it)); end if;
    end loop;
    -- nothing could be combined: the parallel try is the same as one after the other
    if v_try = 1 and jsonb_array_length(v_waves) = jsonb_array_length(v_items) then continue; end if;
    v_plan := visit_try(p_member, v_waves, p_date, v_start, v_close, p_skip, v_try = 1);
    if v_plan is not null then return v_plan; end if;
  end loop;
  return null;
end $$;

-- Start times on a day for this routine (members: their own; the team may pass a member)
create or replace function visit_slots(p_treatments text[], p_date date, p_skip uuid default null, p_member uuid default null)
returns table (slot text, plan jsonb)
language plpgsql security definer set search_path = public as $$
declare s settings; v_slot text; v_plan jsonb; v_member uuid;
begin
  perform release_expired_holds();
  v_member := case when is_team() then p_member else my_member_id() end;
  select * into s from settings where id = 1;
  if p_date < (now() at time zone 'Europe/Amsterdam')::date or cardinality(p_treatments) = 0 then return; end if;
  foreach v_slot in array s.slot_times loop
    v_plan := plan_visit(v_member, p_treatments, p_date, v_slot, p_skip);
    if v_plan is not null then slot := v_slot; plan := v_plan; return next; end if;
  end loop;
end $$;

-- Book the routine: one appointment per treatment, all in one visit. Within the monthly number they are
-- included; beyond it (or not in the membership) the price is settled in the salon.
create or replace function book_visit(p_treatments text[], p_date date, p_time text, p_kids int default 0, p_replace uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m members; s settings; t treatments; v_plan jsonb; seg jsonb; v_visit uuid := gen_random_uuid(); v_group uuid;
  v_used int; v_limit int; v_paid numeric; v_extra numeric := 0; v_free int := 0; v_long jsonb := '{}'; k text;
begin
  perform release_expired_holds();
  select * into m from members where user_id = auth.uid();
  if m.id is null then raise exception 'Je hebt nog geen membership'; end if;
  if m.status <> 'actief' then raise exception 'Je membership is niet actief (%).', m.status; end if;
  select * into s from settings where id = 1;
  if cardinality(p_treatments) = 0 then raise exception 'Kies minstens één behandeling'; end if;
  if cardinality(p_treatments) > 6 then raise exception 'Plan maximaal 6 behandelingen in één bezoek'; end if;
  if p_date > (now() at time zone 'Europe/Amsterdam')::date + s.booking_days then
    raise exception 'Je kunt maximaal % dagen vooruit boeken', s.booking_days;
  end if;
  if m.cancel_at is not null and p_date >= m.cancel_at then raise exception 'Je membership loopt af vóór deze datum'; end if;
  if p_replace is not null then
    if not exists (select 1 from appointments where visit_id = p_replace and member_id = m.id and status = 'gepland') then
      raise exception 'Dit bezoek kun je niet verzetten';
    end if;
    if (select min(starts_at) from appointments where visit_id = p_replace and status = 'gepland') - now() < make_interval(hours => s.cancel_hours) then
      raise exception 'Verzetten kan tot % uur van tevoren', s.cancel_hours;
    end if;
    update appointments set status = 'geannuleerd', cancel_reason = 'verzet', updated_at = now() where visit_id = p_replace and status = 'gepland';
  end if;
  v_plan := plan_visit(m.id, p_treatments, p_date, p_time, p_replace);
  if v_plan is null then raise exception 'Dit tijdstip is niet meer beschikbaar. Kies een ander moment.'; end if;
  insert into visits (id, member_id) values (v_visit, m.id);
  v_used := used_in_month(m.id, p_date); v_limit := limit_in_month(m.id, p_date);
  -- the monthly number goes to the most expensive treatments first
  for seg in select value from jsonb_array_elements(v_plan->'segments')
             order by (select price from treatments where id = value->>'treatment') desc, value->>'starts' loop
    select * into t from treatments where id = seg->>'treatment';
    if exists (select 1 from plan_treatments where plan_id = m.plan_id and treatment_id = t.id) and v_used < v_limit then
      v_paid := 0; v_used := v_used + 1; v_free := v_free + 1;
    else
      v_paid := t.price; v_extra := v_extra + t.price;
    end if;
    v_group := gen_random_uuid();
    insert into appointments (member_id, treatment_id, staff_id, room_id, starts_at, ends_at, group_id, is_primary,
                              paid_amount, confirmed, hold_until, note, created_by, visit_id)
    values (m.id, t.id, (seg->>'staff')::uuid, seg->>'room', (seg->>'starts')::timestamptz, (seg->>'ends')::timestamptz,
            v_group, true, v_paid, true, null, '', auth.uid(), v_visit);
    -- the kids corner is reserved once per moment: on the longest treatment of each wave
    k := seg->>'wave';
    if v_long->k is null or (v_long->k->>'dur')::int < t.duration_min then
      v_long := jsonb_set(v_long, array[k], jsonb_build_object('group', v_group, 'dur', t.duration_min));
    end if;
  end loop;
  if coalesce(p_kids, 0) > 0 then
    for k in select jsonb_object_keys(v_long) loop perform apply_kids((v_long->k->>'group')::uuid, p_kids); end loop;
  end if;
  return jsonb_build_object('visit_id', v_visit, 'included', v_free, 'extra', v_extra, 'start', v_plan->>'start', 'end', v_plan->>'end');
end $$;

-- Cancel the whole visit (one treatment alone: cancel_appointment, as before)
create or replace function cancel_visit(p_visit uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s settings; v_first timestamptz; v_late boolean;
begin
  select min(starts_at) into v_first from appointments where visit_id = p_visit and member_id = my_member_id() and status = 'gepland';
  if v_first is null then raise exception 'Dit bezoek is niet gevonden of al geannuleerd'; end if;
  if v_first <= now() then raise exception 'Dit bezoek is al begonnen'; end if;
  select * into s from settings where id = 1;
  v_late := v_first - now() < make_interval(hours => s.cancel_hours);
  update appointments set status = 'geannuleerd', late_cancel = v_late and confirmed, cancel_reason = 'lid', updated_at = now()
   where visit_id = p_visit and member_id = my_member_id() and status = 'gepland';
  return jsonb_build_object('late', v_late);
end $$;

-- Check in once for the whole visit
create or replace function team_checkin_arrive(p_appointment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a appointments;
begin
  select * into a from appointments where id = p_appointment for update;
  if a.id is null or not can_see_appointment(a.staff_id) then raise exception 'Afspraak niet gevonden'; end if;
  if a.status <> 'gepland' then raise exception 'Deze afspraak is al %', a.status; end if;
  if (a.starts_at at time zone 'Europe/Amsterdam')::date <> (now() at time zone 'Europe/Amsterdam')::date then
    raise exception 'Inchecken kan alleen op de dag van de afspraak';
  end if;
  update appointments set checked_in_at = coalesce(checked_in_at, now()), updated_at = now()
   where group_id = a.group_id or (a.visit_id is not null and visit_id = a.visit_id and status = 'gepland');
  perform log_action('checkin_arrive', 'appointment', a.group_id::text, '{}');
end $$;

revoke execute on function zones_ok(text, text), room_busy(text, timestamptz, timestamptz, uuid), staff_busy(uuid, timestamptz, timestamptz, uuid),
  visit_try(uuid, jsonb, date, timestamptz, timestamptz, uuid, boolean), plan_visit(uuid, text[], date, text, uuid) from public, anon, authenticated;
revoke execute on function visit_slots(text[], date, uuid, uuid), book_visit(text[], date, text, int, uuid), cancel_visit(uuid) from public, anon;
grant execute on function visit_slots(text[], date, uuid, uuid), book_visit(text[], date, text, int, uuid), cancel_visit(uuid) to authenticated;
