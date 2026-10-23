\set QUIET on
\pset footer off
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1','hallo@beautypass.nl','{"name":"Eigenaar"}'),
 ('00000000-0000-0000-0000-0000000000a2','demi@beautypass.nl','{"name":"Demi"}'),
 ('00000000-0000-0000-0000-0000000000a3','noor@beautypass.nl','{"name":"Noor"}'),
 ('00000000-0000-0000-0000-0000000000b1','sophie@mail.nl','{"name":"Sophie"}'),
 ('00000000-0000-0000-0000-0000000000b2','emma@mail.nl','{"name":"Emma"}'),
 ('00000000-0000-0000-0000-0000000000b3','fleur@mail.nl','{"name":"Fleur"}');
update profiles set role='owner' where email='hallo@beautypass.nl';
update profiles set role='desk' where email='demi@beautypass.nl';
update profiles set role='specialist' where email='noor@beautypass.nl';
insert into staff (id,user_id,name,role_title,workdays) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a3','Noor Bakker','Nail artist','{t,t,t,t,t,t,t}'),
 ('10000000-0000-0000-0000-000000000003',null,'Mila Jansen','Hairstylist','{t,t,t,t,t,t,t}'),
 ('10000000-0000-0000-0000-000000000005',null,'Sara Öztürk','Nail artist','{t,t,t,t,t,t,t}');
insert into staff_skills values ('10000000-0000-0000-0000-000000000001','nails'),('10000000-0000-0000-0000-000000000001','six'),
 ('10000000-0000-0000-0000-000000000003','hair'),('10000000-0000-0000-0000-000000000003','six'),('10000000-0000-0000-0000-000000000005','nails'),('10000000-0000-0000-0000-000000000005','brows'),('10000000-0000-0000-0000-000000000005','skin');
select (current_date + (((10 - extract(isodow from current_date)::int) % 7) + 7))::date as wed \gset
select (current_date + (((14 - extract(isodow from current_date)::int) % 7) + 7))::date as sun \gset
\echo '== wednesday under test:' :wed

\echo '== T1 member onboards (nieuw) and cannot book yet [expect error]'
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000b1';
select member_onboard('Sophie de Vries','0612345678',array['gel','browlam','hack'],'signature') is not null as onboarded;
select routine from members;
select book_appointment('gel', :'wed', '10:00');
\echo '== T2 member cannot activate herself or change plan [expect 2 errors], may edit phone/prefs [ok]'
update members set status='actief';
update members set plan_id='edit';
update members set phone='0699999999', prefs='{"drink":"Matcha latte","reminders":true}' where user_id=auth.uid();
select phone, prefs->>'drink' as drink, status from members;
\echo '== T2b member cannot read team notes, audit, waitlist, other members [expect 0/0/0 or denied]'
select count(*) as team_notes from member_team_notes;
select count(*) as waitlist from waitlist;
insert into appointments (member_id,treatment_id,staff_id,room_id,starts_at,ends_at) select id,'gel','10000000-0000-0000-0000-000000000001','solo1',now()+'2 day',now()+'2 day 1 hour' from members;

reset role; select set_config('request.jwt.claim.sub','',false);
update members set status='actief';
insert into members (user_id,name,email,plan_id,status) values
 ('00000000-0000-0000-0000-0000000000b2','Emma Visser','emma@mail.nl','essential','actief'),
 ('00000000-0000-0000-0000-0000000000b3','Fleur van Dijk','fleur@mail.nl','edit','actief');

\echo '== T3 Sophie books gel Wed 10:00 [needs_payment false]'
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000b1';
select book_appointment('gel', :'wed', '10:00')->'needs_payment' as needs_payment;
\echo '== T4 Sophie again same time [expect error: overlap]'
select book_appointment('mani', :'wed', '10:30');
\echo '== T5 Emma: Noor is busy [expect error], any specialist gets Sara [ok]; Fleur same slot nails [expect error: no slot]'
set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000b2';
select book_appointment('gel', :'wed', '10:00', '10000000-0000-0000-0000-000000000001');
select book_appointment('gel', :'wed', '10:00')->'needs_payment' as emma_needs_payment;
set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000b3';
select book_appointment('mani', :'wed', '10:00');
\echo '== T6 Sophie quota: 3 more inside plan, 5th must be paid'
set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000b1';
select book_appointment('mani', :'wed', '12:00')->'needs_payment' a, book_appointment('pedi', :'wed', '13:30')->'needs_payment' b, book_appointment('blow', :'wed', '15:00')->'needs_payment' c;
select used_in_month(my_member_id(), :'wed') as used, limit_in_month(my_member_id(), :'wed') as lim;
select book_appointment('lash', :'wed', '16:30')->>'amount' as fifth_amount, (select count(*) from appointments where not confirmed) as holds;
select count(*) filter (where not confirmed) as holds_now, count(*) filter (where not confirmed and hold_until > now()) as active_holds from appointments;
select count(*) as sophie_slots_at_10 from available_slots('mani', :'wed') where slot='10:00';
\echo '== T7 not in plan (fsig for Signature) [needs payment]; outside hours Sunday 09:30 [error]; off-grid 10:15 [error]; past [error]; too far [error]'
select (book_appointment('fsig', :'sun', '13:00'))->>'amount' as fsig_amount;
select book_appointment('mani', :'sun', '09:30');
select book_appointment('mani', :'wed', '10:15');
select book_appointment('mani', current_date - 1, '10:00');
select book_appointment('mani', current_date + 40, '10:00');
\echo '== T8 cancel early: not late; used drops'
select cancel_appointment((select id from appointments where treatment_id='blow' and member_id=my_member_id())) as cancelled;
select used_in_month(my_member_id(), :'wed') as used_after_cancel;
\echo '== T9 Emma cannot cancel Sophie''s appointment [expect error]'
set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000b2';
select cancel_appointment((select id from appointments where treatment_id='mani' limit 1));
reset role; select set_config('request.jwt.claim.sub','',false);
select count(*) as emma_sees_from_member_role from appointments a join members m on m.id=a.member_id where m.email='sophie@mail.nl' and false;
\echo '== T10 late cancel counts: appointment in 3 hours'
insert into appointments (member_id,treatment_id,staff_id,room_id,starts_at,ends_at)
select id,'browtint','10000000-0000-0000-0000-000000000005','solo4',date_trunc('hour',now())+'3 hour',date_trunc('hour',now())+'3 hour 30 min' from members where email='sophie@mail.nl';
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000b1';
select cancel_appointment((select id from appointments where treatment_id='browtint'))->'late' as late;
select used_in_month(my_member_id(), (now() at time zone 'Europe/Amsterdam')::date) as used_this_month;
\echo '== T11 six hands (Fleur, The Edit): two rows, counts once; second booking same slot [expect error]'
set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000b3';
select book_appointment('six1', :'wed', '14:00')->'needs_payment' as six_paid;
select count(*) as rows, count(distinct staff_id) as staff, bool_or(is_primary) and not bool_and(is_primary) as one_primary from appointments where treatment_id='six1';
select used_in_month(my_member_id(), :'wed') as fleur_used;
reset role; select set_config('request.jwt.claim.sub','',false);
insert into members (name,email,plan_id,status) values ('Test','t@mail.nl','edit','actief');
select count(*) as second_six_slots from available_slots('six1', :'wed') where slot='14:00';
\echo '== T12 reschedule Sophie mani 12:00 -> 17:00: old cancelled, used unchanged'
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000b1';
select used_in_month(my_member_id(), :'wed') as used_before;
select book_appointment('mani', :'wed', '17:00', null, '', (select id from appointments where treatment_id='mani' and member_id=my_member_id() and status='gepland'))->'needs_payment' as resched_paid;
select used_in_month(my_member_id(), :'wed') as used_after, (select count(*) from appointments where treatment_id='mani' and member_id=my_member_id() and status='geannuleerd') as old_cancelled;
\echo '== T13 specialist Noor: only own appointments, only her members via agenda_members, no members table, cannot plan, cannot finish future'
set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000a3';
select count(*) as noor_sees, count(*) filter (where staff_id <> '10000000-0000-0000-0000-000000000001') as not_hers from appointments;
select count(*) as members_table from members;
select string_agg(name, ', ' order by name) as agenda_members from agenda_members();
select team_book_appointment((select id from agenda_members() limit 1), 'gel', :'wed', '11:00');
select team_set_appointment_status((select id from appointments where status='gepland' limit 1), 'afgerond');
select count(*) as noor_payments from payments;
\echo '== T14 desk Demi: sees all, plans an appointment outside plan (paid), cannot change settings/roles/perms, no audit'
set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000a2';
select count(*) as desk_sees from appointments;
select team_book_appointment((select id from members where email='emma@mail.nl'), 'pedi', :'wed', '11:00')->>'paid_amount' as emma_pedi_paid;
update settings set cancel_hours = 1;
select cancel_hours from settings;
select owner_set_role('00000000-0000-0000-0000-0000000000a2','owner');
update profiles set role='owner' where id=auth.uid();
update role_perms set perms = perms || '{settings}' where role='desk';
select count(*) as desk_audit from audit_log;
select next_invoice_no();
\echo '== T15 owner: gives desk the settings right, desk can then change settings; owner row locked; last owner kept'
set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000a1';
update role_perms set perms = perms || '{settings}' where role='desk';
update role_perms set perms = '{}' where role='owner';
select perms from role_perms where role in ('owner','desk') order by role;
select owner_set_role('00000000-0000-0000-0000-0000000000a1','manager');
select count(*) as owner_audit from audit_log;
set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000a2';
update settings set cancel_hours = 48;
select cancel_hours as desk_changed from settings;
\echo '== T16 anon: reads live plans only, cannot book or read members'
reset role; select set_config('request.jwt.claim.sub','',false); update plans set active=false where id='edit'; set role anon; select set_config('request.jwt.claim.sub','',false);
select string_agg(id, ',' order by sort) as anon_plans from plans;
select count(*) from members;
select book_appointment('gel', :'wed', '10:00');
reset role; select set_config('request.jwt.claim.sub','',false);
\echo '== T17 paused member cannot book [expect error]'
update members set status='gepauzeerd' where email='emma@mail.nl';
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000b2';
select book_appointment('mani', :'wed', '16:00');
reset role; select set_config('request.jwt.claim.sub','',false);
\echo '== T18 expired unpaid hold frees the slot'
update appointments set hold_until = now() - interval '1 minute' where not confirmed;
select release_expired_holds();
select count(*) as open_holds from appointments where not confirmed and status='gepland';
