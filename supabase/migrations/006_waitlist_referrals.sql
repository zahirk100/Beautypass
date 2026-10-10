-- Waitlist positions and referrals: every sign-up gets a personal invite code;
-- each friend who joins with it moves the inviter 10 places up. Safe to run again.

alter table public.waitlist
  add column if not exists referral_code text,
  add column if not exists referred_by text;

-- Give existing rows a code
update public.waitlist set referral_code = lower(substr(md5(id::text || random()::text), 1, 8)) where referral_code is null;
alter table public.waitlist alter column referral_code set default lower(substr(md5(gen_random_uuid()::text), 1, 8));
create unique index if not exists waitlist_referral_code on public.waitlist (referral_code);

-- Position = order of sign-up, minus 10 places per successful referral (never above #1)
create or replace view public.waitlist_ranking as
with base as (
  select w.id, w.email, w.referral_code, w.created_at,
         row_number() over (order by w.created_at) as signup_rank,
         (select count(*) from public.waitlist r where r.referred_by = w.referral_code) as referrals
  from public.waitlist w
  where w.status in ('waiting', 'invited')
)
select id, email, referral_code, signup_rank, referrals,
       row_number() over (order by greatest(signup_rank - referrals * 10, 1), created_at) as position
from base;

revoke all on public.waitlist_ranking from anon, authenticated;
grant select on public.waitlist_ranking to authenticated;
alter view public.waitlist_ranking set (security_invoker = true);

-- Public sign-up: insert (or find the existing entry) and return position + invite code
create or replace function public.join_waitlist(
  p_name text, p_email text, p_phone text, p_source text, p_campaign text, p_ref text)
returns table (referral_code text, waitlist_position bigint, referrals bigint, total bigint)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_ref text := nullif(lower(trim(coalesce(p_ref, ''))), '');
begin
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then raise exception 'Ongeldig e-mailadres'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Vul je voornaam in'; end if;
  if v_ref is not null and not exists (select 1 from public.waitlist w where w.referral_code = v_ref) then v_ref := null; end if;

  insert into public.waitlist (name, email, phone, consent, source, campaign, referred_by)
  values (left(trim(p_name), 100), v_email, nullif(left(trim(coalesce(p_phone, '')), 30), ''), true,
          left(coalesce(p_source, 'direct'), 500), nullif(left(coalesce(p_campaign, ''), 200), ''), v_ref)
  on conflict ((lower(email))) do nothing;

  return query
    select r.referral_code, r.position, r.referrals, (select count(*) from public.waitlist where status in ('waiting', 'invited'))
    from public.waitlist_ranking r where lower(r.email) = v_email;
end $$;

-- The ranking view is security_invoker, but join_waitlist is security definer (owner), so it can read it.
revoke execute on function public.join_waitlist(text, text, text, text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text, text, text, text) to anon, authenticated;

-- Admins see positions and referrals
create or replace function public.admin_waitlist_ranking()
returns table (id uuid, waitlist_position bigint, referrals bigint)
language sql stable security definer set search_path = public as $$
  select r.id, r.position, r.referrals from public.waitlist_ranking r where public.is_admin()
$$;
revoke execute on function public.admin_waitlist_ranking() from public, anon;
grant execute on function public.admin_waitlist_ranking() to authenticated;
