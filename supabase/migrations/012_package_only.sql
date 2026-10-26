-- BeautyPass 012: for now members book only what is in their membership (no paying separately).
-- Instellingen → "Losse behandelingen" switches paying separately back on later. Run after 011.
set search_path = public, extensions;

alter table settings add column if not exists allow_extras boolean not null default false;
grant update (allow_extras) on settings to authenticated;

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
    if not v_included or v_used >= v_limit then
      -- for now only what is in the membership can be booked (Instellingen → Losse behandelingen)
      if not s.allow_extras then
        raise exception '%', case when not v_included then t.name || ' zit niet in je ' || (select name from plans where id = m.plan_id) || '-membership'
                                  else 'Je tegoed voor deze maand is op' end;
      end if;
      v_paid := t.price;
    end if;
  end if;

  -- rescheduling frees the old time first, so a slightly later time with the same specialist also works
  if p_reschedule is not null then
    update appointments set status = 'geannuleerd', cancel_reason = 'verzet', updated_at = now() where group_id = v_old.group_id;
  end if;
  v_group := place_appointment(m.id, t.id, p_date, p_time, p_staff, null, p_note, v_paid,
                               v_paid = 0 or p_reschedule is not null, v_old.group_id, auth.uid());
  if p_reschedule is not null then
    update appointments set rescheduled_from = v_old.id where group_id = v_group and is_primary;
    update payments set appointment_group = v_group where appointment_group = v_old.group_id;
  end if;
  perform apply_kids(v_group, p_kids);
  return jsonb_build_object('group_id', v_group, 'needs_payment', v_paid > 0 and p_reschedule is null, 'amount', v_paid);
end $$;

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
      if not s.allow_extras then
        raise exception '%', case when not exists (select 1 from plan_treatments where plan_id = m.plan_id and treatment_id = t.id)
          then t.name || ' zit niet in je membership' else 'Je hebt deze maand nog ' || greatest(0, v_limit - used_in_month(m.id, p_date)) || ' behandeling(en) over. Laat er een weg.' end;
      end if;
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
