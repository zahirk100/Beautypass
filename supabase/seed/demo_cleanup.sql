-- Removes ALL demo data created by demo.sql (demo salons, demo accounts and everything linked to them).
-- Run this before the real launch. Real salons, members and the waitlist are not touched.
delete from public.bookings
 where salon_id in (select id from public.salons where is_demo)
    or user_id in (select id from auth.users where email like 'demo.%@example.com');
delete from public.slots where salon_id in (select id from public.salons where is_demo);
delete from public.salons where is_demo;
delete from auth.users where email like 'demo.%@example.com';
