-- BeautyPass: remove the demo data from demo_data.sql again (Supabase → SQL Editor → Run).
-- Real members, appointments and settings stay untouched.
set search_path = public, extensions;

-- Demo members (their appointments, notes and payments go with them)
delete from members where email like 'demo.%@example.com';
delete from waitlist where email like 'demo.%@example.com';

-- Demo specialists: removed, or switched off when a real member has booked with them
do $$
declare v uuid;
begin
  for v in select id from staff where id::text like 'd3e00000-%' loop
    begin
      delete from staff where id = v;
    exception when foreign_key_violation then
      update staff set active = false where id = v;
      raise notice 'Specialist % heeft nog echte afspraken en is uitgezet in plaats van verwijderd', v;
    end;
  end loop;
end $$;

select (select count(*) from members where email like 'demo.%@example.com') as demo_members_over,
       (select count(*) from staff where id::text like 'd3e00000-%' and active) as demo_specialisten_actief;
