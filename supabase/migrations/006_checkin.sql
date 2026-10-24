-- BeautyPass 006: check-in with the member pass (QR code / barcode). Run after 005.
-- Every member gets a personal pass code. In the salon the team scans it: they see who is there and
-- which treatment is planned today, mark the member as arrived, and complete the treatment
-- (which then counts as used for the month).
set search_path = public, extensions;

-- Pass code: "BP" + 10 characters without look-alikes (0/O, 1/I), from a secure random source
create or replace function new_checkin_code() returns text language plpgsql volatile set search_path = public, extensions as $$
declare a constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; b bytea; c text;
begin
  loop
    b := gen_random_bytes(10); c := 'BP';
    for i in 0..9 loop c := c || substr(a, 1 + get_byte(b, i) % 32, 1); end loop;
    exit when not exists (select 1 from members where checkin_code = c);
  end loop;
  return c;
end $$;
revoke execute on function new_checkin_code() from public, anon, authenticated;

alter table members add column if not exists checkin_code text;
update members set checkin_code = new_checkin_code() where checkin_code is null;
alter table members alter column checkin_code set default new_checkin_code();
alter table members alter column checkin_code set not null;
create unique index if not exists members_checkin_code on members (checkin_code);

alter table appointments add column if not exists checked_in_at timestamptz;

-- Scan: who is this, and what is planned today? (team with the agenda right; specialists see their own)
create or replace function team_checkin(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_code text; m members; v_today date := (now() at time zone 'Europe/Amsterdam')::date; v_appts jsonb; v_next jsonb;
begin
  if not has_perm('agenda') then raise exception 'Hiervoor heb je geen rechten'; end if;
  -- Accept the bare code, the code with spaces/dashes, or a scanned link that ends with it
  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_code := substring(v_code from '(BP[A-Z0-9]{10})$');
  if v_code is null then raise exception 'Dit is geen BeautyPass-pas'; end if;
  select * into m from members where checkin_code = v_code;
  if m.id is null then raise exception 'Deze pas is niet (meer) geldig'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'treatment', a.treatment_id, 'staff', a.staff_id, 'room', a.room_id,
           'starts_at', a.starts_at, 'status', a.status, 'checked_in_at', a.checked_in_at, 'paid', a.paid_amount, 'confirmed', a.confirmed)
           order by a.starts_at), '[]')
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

-- Mark as arrived (the agenda shows it live)
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
  update appointments set checked_in_at = coalesce(checked_in_at, now()), updated_at = now() where group_id = a.group_id;
  perform log_action('checkin_arrive', 'appointment', a.group_id::text, '{}');
end $$;

-- Completing: also allowed right after check-in when the member is early
create or replace function team_set_appointment_status(p_appointment uuid, p_status appt_status) returns void
language plpgsql security definer set search_path = public as $$
declare a appointments;
begin
  select * into a from appointments where id = p_appointment for update;
  if a.id is null or not can_see_appointment(a.staff_id) then raise exception 'Afspraak niet gevonden'; end if;
  if p_status = 'gepland' and a.status = 'geannuleerd' then
    raise exception 'Een geannuleerde afspraak plan je opnieuw in via Afspraak';
  end if;
  if p_status = 'afgerond' and a.starts_at > now() + interval '30 minutes' and a.checked_in_at is null then
    raise exception 'Je kunt een afspraak pas afronden rond het starttijdstip of na het inchecken';
  end if;
  if p_status = 'no-show' and (a.starts_at > now() or a.checked_in_at is not null) then
    raise exception 'Een no-show kan pas na het starttijdstip, en niet als de member er is';
  end if;
  -- the team cancels without counting it, unless it is marked as a no-show
  update appointments set status = p_status, late_cancel = false,
    cancel_reason = case when p_status = 'geannuleerd' then 'team' else null end, updated_at = now() where group_id = a.group_id;
  perform log_action('appointment_status', 'appointment', a.group_id::text, jsonb_build_object('status', p_status));
end $$;

-- A member can replace a lost or shared pass; the old code stops working at once
create or replace function member_new_checkin_code() returns text
language plpgsql security definer set search_path = public as $$
declare v text := new_checkin_code();
begin
  if my_member_id() is null then raise exception 'Je hebt nog geen membership'; end if;
  perform set_config('bp.trusted', 'on', true);
  update members set checkin_code = v where id = my_member_id();
  perform set_config('bp.trusted', 'off', true);
  return v;
end $$;

revoke execute on function team_checkin(text), team_checkin_arrive(uuid), member_new_checkin_code() from public, anon;
grant execute on function team_checkin(text), team_checkin_arrive(uuid), member_new_checkin_code() to authenticated;
