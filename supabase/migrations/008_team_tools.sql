-- BeautyPass 008: rescheduling by the team, waiting list for full days, start times, feedback,
-- member details by the team, and consent with the terms. Run after 007.
set search_path = public, extensions;

-- ───────── Terms & privacy: active once both links are filled in (Instellingen → Voorwaarden) ─────────
alter table settings add column if not exists terms_url text;
alter table settings add column if not exists privacy_url text;
grant update (terms_url, privacy_url) on settings to authenticated;
alter table members add column if not exists terms_accepted_at timestamptz;

create or replace function member_accept_terms() returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_member_id() is null then raise exception 'Je hebt nog geen membership'; end if;
  perform set_config('bp.trusted', 'on', true);
  update members set terms_accepted_at = now() where id = my_member_id();
  perform set_config('bp.trusted', 'off', true);
end $$;

-- ───────── The team corrects a member's name and phone (the e-mail address stays locked) ─────────
create or replace function team_update_member(p_member uuid, p_name text, p_phone text) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not has_perm('members') then raise exception 'Hiervoor heb je geen rechten'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Vul een naam in'; end if;
  update members set name = left(trim(p_name), 120), phone = nullif(left(trim(coalesce(p_phone, '')), 30), '')
   where id = p_member returning user_id into v_user;
  if not found then raise exception 'Member niet gevonden'; end if;
  if v_user is not null then update profiles set name = left(trim(p_name), 120) where id = v_user; end if;
  perform log_action('member_details', 'member', p_member::text, '{}');
end $$;

-- ───────── Rescheduling by the team (keeps paid amount and kids corner; the member gets a new confirmation) ─────────
create or replace function team_reschedule_appointment(p_appointment uuid, p_date date, p_time text,
  p_staff uuid default null, p_room text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a appointments; v_group uuid;
begin
  if not has_perm('agenda') or my_role() = 'specialist' then raise exception 'Geen rechten om afspraken te verzetten'; end if;
  select * into a from appointments where id = p_appointment and is_primary for update;
  if a.id is null then raise exception 'Afspraak niet gevonden'; end if;
  if a.status <> 'gepland' then raise exception 'Alleen een geplande afspraak kun je verzetten'; end if;
  -- free the old time first (all in one transaction: if the new time fails, nothing changes)
  update appointments set status = 'geannuleerd', cancel_reason = 'verzet', updated_at = now() where group_id = a.group_id;
  v_group := place_appointment(a.member_id, a.treatment_id, p_date, p_time, p_staff, p_room, a.note, a.paid_amount,
                               a.confirmed, a.group_id, auth.uid());
  update appointments set rescheduled_from = a.id where group_id = v_group and is_primary;
  update payments set appointment_group = v_group where appointment_group = a.group_id;
  perform apply_kids(v_group, a.kids);
  perform log_action('team_reschedule', 'appointment', v_group::text, jsonb_build_object('from', a.id));
  return jsonb_build_object('group_id', v_group);
end $$;

-- ───────── Member rescheduling: same order fix ─────────
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


-- ───────── Waiting list for a full day: mail as soon as a time comes free ─────────
create table if not exists slot_watches (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members on delete cascade,
  treatment_id text not null references treatments on delete cascade,
  date date not null,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (member_id, treatment_id, date)
);
alter table slot_watches enable row level security;
drop policy if exists "own or team" on slot_watches;
create policy "own or team" on slot_watches for select using (member_id = my_member_id() or has_perm('agenda'));
revoke all on slot_watches from anon, authenticated;
grant select on slot_watches to authenticated;

create or replace function watch_slot(p_treatment text, p_date date) returns void
language plpgsql security definer set search_path = public as $$
declare m members;
begin
  select * into m from members where user_id = auth.uid();
  if m.id is null or m.status <> 'actief' then raise exception 'Je membership is niet actief'; end if;
  if p_date < (now() at time zone 'Europe/Amsterdam')::date then raise exception 'Deze dag is al voorbij'; end if;
  insert into slot_watches (member_id, treatment_id, date) values (m.id, p_treatment, p_date)
  on conflict (member_id, treatment_id, date) do update set notified_at = null, created_at = now();
end $$;

create or replace function unwatch_slot(p_treatment text, p_date date) returns void
language sql security definer set search_path = public as $$
  delete from slot_watches where member_id = my_member_id() and treatment_id = p_treatment and date = p_date
$$;

-- Every cancellation (also rescheduled or expired) tells the server, which mails the waiting list
create or replace function private.notify_appointment() returns trigger
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_url text := (select value from private.settings where key = 'notify_url');
  v_secret text := (select value from private.settings where key = 'notify_secret');
  v_event text;
begin
  if v_url is null or v_secret is null or not new.is_primary then return new; end if;
  if tg_op = 'INSERT' and new.status = 'gepland' and new.confirmed then v_event := 'booked';
  elsif tg_op = 'UPDATE' and new.confirmed and not old.confirmed and new.status = 'gepland' then v_event := 'booked';
  elsif tg_op = 'UPDATE' and new.status = 'geannuleerd' and old.status <> 'geannuleerd' then
    v_event := case when new.cancel_reason in ('lid', 'team') then 'cancelled' else 'freed' end;
  end if;
  if v_event is not null then
    perform net.http_post(url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
      body := jsonb_build_object('event', v_event, 'appointment_id', new.id));
  end if;
  return new;
exception when others then
  raise warning 'notify_appointment: %', sqlerrm;
  return new;
end $$;

-- ───────── Feedback after a treatment ─────────
create table if not exists reviews (
  appointment_id uuid primary key references appointments on delete cascade,
  member_id uuid not null references members on delete cascade,
  staff_id uuid references staff on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);
alter table reviews enable row level security;
drop policy if exists "own or team" on reviews;
create policy "own or team" on reviews for select using (member_id = my_member_id() or has_perm('members') or has_perm('team'));
revoke all on reviews from anon, authenticated;
grant select on reviews to authenticated;

create or replace function member_review(p_appointment uuid, p_rating int, p_comment text default '') returns void
language plpgsql security definer set search_path = public as $$
declare a appointments;
begin
  select * into a from appointments where id = p_appointment and is_primary;
  if a.id is null or a.member_id is distinct from my_member_id() then raise exception 'Afspraak niet gevonden'; end if;
  if a.status <> 'afgerond' then raise exception 'Je kunt een behandeling beoordelen nadat hij is afgerond'; end if;
  if p_rating not between 1 and 5 then raise exception 'Kies 1 tot 5 sterren'; end if;
  insert into reviews (appointment_id, member_id, staff_id, rating, comment)
  values (a.id, a.member_id, a.staff_id, p_rating, left(coalesce(p_comment, ''), 1000))
  on conflict (appointment_id) do update set rating = excluded.rating, comment = excluded.comment, created_at = now();
end $$;

-- Reminder mail "Hoe was je behandeling?" is sent once
alter table appointments add column if not exists review_asked_at timestamptz;

revoke execute on function member_accept_terms(), team_update_member(uuid, text, text),
  team_reschedule_appointment(uuid, date, text, uuid, text), watch_slot(text, date), unwatch_slot(text, date),
  member_review(uuid, int, text) from public, anon;
grant execute on function member_accept_terms(), team_update_member(uuid, text, text),
  team_reschedule_appointment(uuid, date, text, uuid, text), watch_slot(text, date), unwatch_slot(text, date),
  member_review(uuid, int, text) to authenticated;
