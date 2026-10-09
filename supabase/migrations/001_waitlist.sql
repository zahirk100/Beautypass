-- Waitlist for the BeautyPass landing page.
-- Visitors (anon role) may only INSERT; nobody can read the list via the public API.

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 100),
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  phone       text check (phone is null or char_length(phone) <= 30),
  consent     boolean not null default false check (consent),
  source      text check (source is null or char_length(source) <= 500),
  campaign    text check (campaign is null or char_length(campaign) <= 200),
  status      text not null default 'waiting' check (status in ('waiting', 'invited', 'member', 'unsubscribed')),
  launch_round integer,
  created_at  timestamptz not null default now()
);

-- One sign-up per e-mail address (case-insensitive)
create unique index if not exists waitlist_email_unique on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

-- Public visitors may add themselves, but only with default status fields
drop policy if exists "anon can join waitlist" on public.waitlist;
create policy "anon can join waitlist"
  on public.waitlist for insert
  to anon
  with check (status = 'waiting' and launch_round is null);

-- No select/update/delete policies: the list is only visible in the Supabase dashboard
-- (and later in the admin environment via a server-side key).
revoke all on public.waitlist from anon, authenticated;
grant insert (name, email, phone, consent, source, campaign) on public.waitlist to anon;
