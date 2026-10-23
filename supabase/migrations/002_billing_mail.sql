-- BeautyPass 002: billing dates, pause history, cancel reasons and booking e-mails. Run after 001.
set search_path = public, extensions;

alter table members add column if not exists next_payment_date date;

-- Pauses (max. settings.pause_months_per_year months per 12 months)
create table if not exists membership_pauses (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members on delete cascade,
  starts date not null, ends date not null check (ends > starts),
  months int not null default 1 check (months between 1 and 12),
  paid_through date,                                 -- end of the already paid period when the pause started
  created_at timestamptz not null default now()
);
alter table membership_pauses enable row level security;
drop policy if exists "own or team" on membership_pauses;
create policy "own or team" on membership_pauses for select using (member_id = my_member_id() or has_perm('members'));
revoke all on membership_pauses from anon, authenticated;
grant select on membership_pauses to authenticated;

-- Payments and invoices are financial data: the member's own, or the "finance" right (not "members")
drop policy if exists "own or team" on payments;
create policy "own or finance" on payments for select using (member_id = my_member_id() or has_perm('finance'));

-- Why an appointment was cancelled: by the member, by the team, rescheduled, or an unpaid hold that expired
alter table appointments add column if not exists cancel_reason text
  check (cancel_reason in ('lid', 'team', 'verzet', 'vervallen'));

create or replace function release_expired_holds() returns void language sql security definer set search_path = public as $$
  update appointments set status = 'geannuleerd', cancel_reason = 'vervallen', updated_at = now()
  where not confirmed and status = 'gepland' and hold_until <= now()
$$;
revoke execute on function release_expired_holds() from public, anon, authenticated;

create or replace function book_appointment(p_treatment text, p_date date, p_time text, p_staff uuid default null,
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
    update appointments set status = 'geannuleerd', cancel_reason = 'verzet', updated_at = now() where group_id = v_old.group_id;
    update appointments set rescheduled_from = v_old.id where group_id = v_group and is_primary;
    update payments set appointment_group = v_group where appointment_group = v_old.group_id;
  end if;
  return jsonb_build_object('group_id', v_group, 'needs_payment', v_paid > 0 and p_reschedule is null, 'amount', v_paid);
end $$;

create or replace function cancel_appointment(p_appointment uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a appointments; s settings; v_late boolean;
begin
  select * into a from appointments where id = p_appointment and is_primary for update;
  if a.id is null or a.member_id is distinct from my_member_id() then raise exception 'Afspraak niet gevonden'; end if;
  if a.status <> 'gepland' then raise exception 'Deze afspraak kan niet meer geannuleerd worden'; end if;
  if a.starts_at <= now() then raise exception 'Deze afspraak is al begonnen'; end if;
  select * into s from settings where id = 1;
  v_late := a.confirmed and a.starts_at - now() < make_interval(hours => s.cancel_hours);
  update appointments set status = 'geannuleerd', late_cancel = v_late, cancel_reason = 'lid', updated_at = now() where group_id = a.group_id;
  return jsonb_build_object('late', v_late, 'refund', not v_late and a.paid_amount > 0 and a.confirmed, 'amount', a.paid_amount);
end $$;

create or replace function team_set_appointment_status(p_appointment uuid, p_status appt_status) returns void
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
  update appointments set status = p_status, late_cancel = false,
    cancel_reason = case when p_status = 'geannuleerd' then 'team' else null end, updated_at = now() where group_id = a.group_id;
  perform log_action('appointment_status', 'appointment', a.group_id::text, jsonb_build_object('status', p_status));
end $$;

-- Booking e-mails: the database tells the website (/api/notify) about new and cancelled appointments.
-- The URL and a shared secret live in private.settings; without them nothing is sent.
create extension if not exists pg_net with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.settings (key text primary key, value text not null);
revoke all on private.settings from public, anon, authenticated;

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
  elsif tg_op = 'UPDATE' and new.status = 'geannuleerd' and old.status <> 'geannuleerd' and new.cancel_reason in ('lid', 'team') then v_event := 'cancelled';
  end if;
  if v_event is not null then
    perform net.http_post(url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
      body := jsonb_build_object('event', v_event, 'appointment_id', new.id));
  end if;
  return new;
exception when others then
  raise warning 'notify_appointment: %', sqlerrm;   -- a mail problem never blocks a booking
  return new;
end $$;
drop trigger if exists appointments_notify on appointments;
create trigger appointments_notify after insert or update of status, confirmed on appointments
  for each row execute function private.notify_appointment();

-- After running: fill in the website URL and a long random secret (the same as NOTIFY_SECRET in Vercel)
--   insert into private.settings values ('notify_url', 'https://www.beautypass.nl/api/notify'), ('notify_secret', '…')
--   on conflict (key) do update set value = excluded.value;
