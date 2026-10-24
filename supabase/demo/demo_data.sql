-- BeautyPass demo data for testing (Supabase → SQL Editor → Run). Safe to run more than once.
-- Adds: 4 specialists with skills, 8 demo members (all statuses), past and upcoming appointments
-- (also today), team notes and a First access list.
-- Demo members use @example.com addresses: they get no mails and nobody can log in as them.
-- Remove everything again with supabase/demo/demo_cleanup.sql.
set search_path = public, extensions;

-- ───────── Specialists (fixed ids, so the cleanup finds them) ─────────
insert into staff (id, name, role_title, color, workdays) values
  ('d3e00000-0000-4000-8000-000000000001', 'Sanne',  'Nail artist',        '#b7a48f', '{t,t,t,t,t,t,f}'),
  ('d3e00000-0000-4000-8000-000000000002', 'Noor',   'Brow & lash expert', '#8f9e8b', '{t,t,t,t,t,f,t}'),
  ('d3e00000-0000-4000-8000-000000000003', 'Lotte',  'Hair stylist',       '#a68a7b', '{f,t,t,t,t,t,t}'),
  ('d3e00000-0000-4000-8000-000000000004', 'Yasmin', 'Skin therapist',     '#7d8a9e', '{t,t,t,t,t,t,t}')
on conflict (id) do nothing;

insert into staff_skills (staff_id, category_id) values
  ('d3e00000-0000-4000-8000-000000000001', 'nails'), ('d3e00000-0000-4000-8000-000000000001', 'six'),
  ('d3e00000-0000-4000-8000-000000000002', 'brows'), ('d3e00000-0000-4000-8000-000000000002', 'smooth'),
  ('d3e00000-0000-4000-8000-000000000003', 'hair'),  ('d3e00000-0000-4000-8000-000000000003', 'six'),
  ('d3e00000-0000-4000-8000-000000000004', 'skin'),  ('d3e00000-0000-4000-8000-000000000004', 'smooth'),
  ('d3e00000-0000-4000-8000-000000000004', 'nails')
on conflict do nothing;

-- ───────── Members ─────────
insert into members (name, email, phone, plan_id, status, since, paused_until, cancel_at, next_payment_date,
                     mandate_method, mandate_label, routine, prefs, notes)
select v.name, v.email, v.phone, v.plan, v.status::member_status, current_date - v.since_days,
       case when v.status = 'gepauzeerd' then current_date + 20 end,
       case when v.cancel then current_date + 12 end,
       current_date + (v.since_days % 28) + 1,
       'SEPA-incasso', 'Demo · NL•• •••• •••• 01', v.routine, v.prefs::jsonb, v.notes
from (values
  ('Emma de Vries',   'demo.emma@example.com',   '0612345601', 'signature', 'actief',           95, false, '{gel,browlam,blow}'::text[],  '{"reminders":true,"drink":"Cappuccino"}',      'Liever geen parfum in de ruimte'),
  ('Sophie Bakker',   'demo.sophie@example.com', '0612345602', 'essential', 'actief',           40, false, '{mani,fexp}'::text[],         '{"reminders":true,"drink":"Matcha latte"}',    ''),
  ('Julia Janssen',   'demo.julia@example.com',  '0612345603', 'edit',      'actief',          160, false, '{gel,pedi,fsig,blow}'::text[], '{"reminders":true,"drink":"Verse muntthee"}',  'Gevoelige huid'),
  ('Mila Visser',     'demo.mila@example.com',   '0612345604', 'signature', 'actief',           12, false, '{lash,blow}'::text[],         '{"reminders":true}',                          ''),
  ('Zoë Smit',        'demo.zoe@example.com',    '0612345605', 'essential', 'actief',           70, true,  '{mani}'::text[],              '{"reminders":false}',                         ''),
  ('Lisa Meijer',     'demo.lisa@example.com',   '0612345606', 'signature', 'betaling mislukt', 55, false, '{gel,browtint}'::text[],      '{"reminders":true}',                          ''),
  ('Anna Mulder',     'demo.anna@example.com',   '0612345607', 'essential', 'gepauzeerd',      120, false, '{blow}'::text[],              '{"reminders":true,"drink":"Water met citroen"}', ''),
  ('Fleur de Boer',   'demo.fleur@example.com',  '0612345608', 'edit',      'opgezegd',        200, false, '{fsig,waxl}'::text[],         '{"reminders":true}',                          '')
) as v(name, email, phone, plan, status, since_days, cancel, routine, prefs, notes)
on conflict do nothing;

insert into member_team_notes (member_id, body)
select id, n.body from members m join (values
  ('demo.emma@example.com',  'Vaste klant, komt graag op donderdagavond. Allergisch voor latex.'),
  ('demo.julia@example.com', 'Wil bij de signature facial altijd Yasmin.'),
  ('demo.lisa@example.com',  'Incasso mislukt; even bellen als ze binnenkomt.')
) as n(email, body) on n.email = m.email
on conflict (member_id) do nothing;

-- ───────── Past appointments (completed and one no-show) ─────────
do $$
declare
  r record; d date; t text; st uuid; rm text; i int := 0;
  plan_t text[];
begin
  if exists (select 1 from appointments a join members m on m.id = a.member_id
             where m.email like 'demo.%@example.com' and a.starts_at < now()) then return; end if;
  for r in select id, email, routine from members where email like 'demo.%@example.com' and status in ('actief', 'betaling mislukt', 'gepauzeerd') loop
    for k in 1..3 loop
      i := i + 1;
      d := current_date - (k * 9 + i % 5);
      t := r.routine[1 + (k % array_length(r.routine, 1))];
      select s.staff_id into st from staff_skills s join treatments tr on tr.category_id = s.category_id
        where tr.id = t and s.staff_id::text like 'd3e00000-%' order by s.staff_id limit 1;
      select id into rm from rooms where type = (select room from treatments where id = t) and active order by sort offset (i % 4) limit 1;
      if rm is null then select id into rm from rooms where type = (select room from treatments where id = t) and active order by sort limit 1; end if;
      begin
        insert into appointments (member_id, treatment_id, staff_id, room_id, starts_at, ends_at, status)
        values (r.id, t, st, rm, local_ts(d, lpad((9 + i % 8)::text, 2, '0') || ':00'),
                local_ts(d, lpad((9 + i % 8)::text, 2, '0') || ':00') + make_interval(mins => (select duration_min from treatments where id = t)),
                case when i = 4 then 'no-show' else 'afgerond' end::appt_status);
      exception when exclusion_violation then null;
      end;
    end loop;
  end loop;
end $$;

-- ───────── Upcoming appointments (today and the next 10 days), with the salon's own booking rules ─────────
do $$
declare
  r record; d date; booked int; s settings; len int;
begin
  if exists (select 1 from appointments a join members m on m.id = a.member_id
             where m.email like 'demo.%@example.com' and a.starts_at > now() and a.status = 'gepland') then return; end if;
  select * into s from settings where id = 1;
  len := array_length(s.slot_times, 1);
  for r in select id, routine, row_number() over (order by email)::int as n from members
           where email like 'demo.%@example.com' and status = 'actief' loop
    booked := 0;
    for day in 0..10 loop
      exit when booked >= 2;
      continue when (day + r.n) % 3 <> 0;            -- spread the members over the days
      d := current_date + day;
      for i in 0..len - 1 loop                        -- each member starts at another time of day
        begin
          perform place_appointment(r.id, r.routine[1 + booked % array_length(r.routine, 1)], d, s.slot_times[1 + (i + r.n * 3) % len],
                                    null, null, case when booked = 0 and r.n = 1 then 'Graag de stoel bij het raam' else '' end, 0, true, null, null);
          booked := booked + 1;
          exit;
        exception when others then null;             -- closed, in the past, or taken: try the next time
        end;
      end loop;
    end loop;
  end loop;
end $$;

-- ───────── First access list ─────────
insert into waitlist (email, source, status, round, invited_at, created_at)
select v.email, 'website', v.status::waitlist_status, v.round, case when v.round is not null then now() - interval '6 days' end, now() - make_interval(days => v.ago)
from (values
  ('demo.wl.amira@example.com', 'wachtend', null, 2), ('demo.wl.bo@example.com', 'wachtend', null, 3),
  ('demo.wl.chloe@example.com', 'wachtend', null, 5), ('demo.wl.daan@example.com', 'wachtend', null, 8),
  ('demo.wl.eva@example.com', 'wachtend', null, 9), ('demo.wl.femke@example.com', 'uitgenodigd', 1, 20),
  ('demo.wl.gwen@example.com', 'uitgenodigd', 1, 21), ('demo.wl.hanna@example.com', 'member', 1, 25)
) as v(email, status, round, ago)
on conflict do nothing;

-- What was added
select (select count(*) from staff where id::text like 'd3e00000-%') as specialisten,
       (select count(*) from members where email like 'demo.%@example.com') as members,
       (select count(*) from appointments a join members m on m.id = a.member_id where m.email like 'demo.%@example.com' and a.is_primary) as afspraken,
       (select count(*) from waitlist where email like 'demo.%@example.com') as first_access;
