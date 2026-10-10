-- E-mails for memberships and bookings. Needs 008_waitlist_emails.sql (pg_net + private.settings).
-- The database sends each event to the website (/api/hooks/events, same secret as the waitlist hook),
-- which mails the member, the salon and/or the team. Overview: docs/emails.md. Safe to run again.

alter table public.bookings add column if not exists reminder_sent_at timestamptz;

-- Send one event to the website; never blocks the action that caused it
create or replace function private.post_event(p_body jsonb) returns void
language plpgsql security definer set search_path = public, private as $$
declare
  v_url text := (select value from private.settings where key = 'waitlist_hook_url');
  v_secret text := (select value from private.settings where key = 'waitlist_hook_secret');
begin
  if v_url is null or v_secret is null or p_body is null then return; end if;
  perform net.http_post(
    url := regexp_replace(v_url, '/waitlist$', '/events'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
    body := p_body);
exception when others then
  raise warning 'post_event: %', sqlerrm;
end $$;

-- Everything a booking mail needs: member, salon (owners + contact address), treatment, time
create or replace function private.booking_payload(p_booking uuid) returns jsonb
language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object(
    'booking_id', b.id, 'starts_at', b.starts_at, 'credits', b.credits, 'note', nullif(b.note, ''),
    'treatment', t.name,
    'member_name', trim(p.first_name || ' ' || p.last_name),
    'member_short', trim(p.first_name || ' ' || left(p.last_name, 1) || case when p.last_name <> '' then '.' else '' end),
    'member_email', u.email,
    'salon_name', s.name, 'salon_address', s.address, 'salon_district', s.district,
    'salon_emails', coalesce((
      select jsonb_agg(distinct x.e) from (
        select u2.email::text as e from public.salon_members sm join auth.users u2 on u2.id = sm.user_id
        where sm.salon_id = s.id and sm.role = 'owner'
        union all select nullif(trim(s.contact_email), '')
      ) x where x.e is not null), '[]'::jsonb))
  from public.bookings b
  join public.treatments t on t.id = b.treatment_id
  join public.profiles p on p.id = b.user_id
  join auth.users u on u.id = b.user_id
  join public.salons s on s.id = b.salon_id
  where b.id = p_booking
$$;

create or replace function private.membership_payload(p_membership uuid, p_extra_credits integer default 0) returns jsonb
language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object(
    'name', trim(p.first_name || ' ' || p.last_name), 'email', u.email,
    'plan', pl.name, 'monthly_credits', pl.monthly_credits,
    'founding_number', m.founding_number, 'period_end', m.current_period_end,
    'balance', public.credit_balance(m.user_id) + p_extra_credits)
  from public.memberships m
  join public.plans pl on pl.id = m.plan_id
  join public.profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  where m.id = p_membership
$$;

-- Bookings: created, cancelled (by member or salon), completed, no-show
create or replace function private.on_booking_change() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare v_type text;
begin
  if tg_op = 'INSERT' then
    if new.status = 'booked' then v_type := 'booking_created'; end if;
  elsif new.status is distinct from old.status and old.status = 'booked' then
    -- Only the first change after 'booked' mails; a salon correcting completed <-> no-show does not
    v_type := case new.status
      when 'cancelled' then 'booking_cancelled'
      when 'cancelled_late' then 'booking_cancelled'
      when 'cancelled_by_salon' then 'booking_cancelled_by_salon'
      when 'completed' then 'booking_completed'
      when 'no_show' then 'booking_no_show'
    end;
  end if;
  if v_type is not null then
    perform private.post_event(private.booking_payload(new.id)
      || jsonb_build_object('type', v_type, 'late', new.status = 'cancelled_late'));
  end if;
  return new;
exception when others then
  raise warning 'on_booking_change: %', sqlerrm;
  return new;
end $$;

drop trigger if exists bookings_notify on public.bookings;
create trigger bookings_notify after insert or update of status on public.bookings
  for each row execute function private.on_booking_change();

-- Memberships: requested, activated (or resumed), paused, cancelled
create or replace function private.on_membership_change() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare v_body jsonb;
begin
  if tg_op = 'INSERT' then
    v_body := private.membership_payload(new.id) || '{"type":"membership_requested"}';
  elsif new.status is distinct from old.status then
    v_body := case new.status
      -- The first month's credits are granted right after this update, so count them in already
      when 'active' then private.membership_payload(new.id, case when old.status = 'pending'
          then (select monthly_credits from public.plans where id = new.plan_id) else 0 end)
        || jsonb_build_object('type', 'membership_activated', 'resumed', old.status = 'paused')
      when 'paused' then private.membership_payload(new.id) || '{"type":"membership_paused"}'
      when 'cancelled' then private.membership_payload(new.id) || '{"type":"membership_cancelled"}'
    end;
  end if;
  perform private.post_event(v_body);
  return new;
exception when others then
  raise warning 'on_membership_change: %', sqlerrm;
  return new;
end $$;

drop trigger if exists memberships_notify on public.memberships;
create trigger memberships_notify after insert or update of status on public.memberships
  for each row execute function private.on_membership_change();

-- Monthly renewal: new credits are in (run_monthly_renewals moves the period end right after this)
create or replace function private.on_credit_grant() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare v_m uuid;
begin
  if new.reason = 'monthly_grant' and new.note like 'Nieuwe maand%' then
    select id into v_m from public.memberships where user_id = new.user_id and status = 'active' limit 1;
    if v_m is not null then
      perform private.post_event(private.membership_payload(v_m) || jsonb_build_object('type', 'credits_renewed',
        'period_end', (select current_period_end + interval '1 month' from public.memberships where id = v_m)));
    end if;
  end if;
  return new;
exception when others then
  raise warning 'on_credit_grant: %', sqlerrm;
  return new;
end $$;

drop trigger if exists credit_ledger_notify on public.credit_ledger;
create trigger credit_ledger_notify after insert on public.credit_ledger
  for each row execute function private.on_credit_grant();

-- Reminder about 24 hours before an appointment (only for bookings made more than a day ahead;
-- otherwise the confirmation was recent enough). Runs every hour via pg_cron.
create or replace function private.send_booking_reminders() returns integer
language plpgsql security definer set search_path = public, private as $$
declare r record; v_count integer := 0;
begin
  for r in
    select id from public.bookings
    where status = 'booked' and reminder_sent_at is null
      and starts_at > now() + interval '2 hours' and starts_at <= now() + interval '24 hours'
      and created_at <= starts_at - interval '24 hours'
    for update skip locked
  loop
    perform private.post_event(private.booking_payload(r.id) || '{"type":"booking_reminder"}');
    update public.bookings set reminder_sent_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

revoke all on all functions in schema private from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'beautypass-booking-reminders';
  perform cron.schedule('beautypass-booking-reminders', '7 * * * *', 'select private.send_booking_reminders()');
exception when others then
  raise notice 'Herinneringen niet ingepland, pg_cron is niet beschikbaar: %', sqlerrm;
end $$;
