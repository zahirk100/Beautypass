-- BeautyPass 014: anonymous step counter for the onboarding (Beheer → dashboard shows where people drop off).
-- Only counts per day and step: no cookies, no personal data. Run after 013.
create table if not exists onboarding_stats (
  day date not null,
  step text not null check (step in ('welcome', 'plan', 'checkout', 'paid')),
  n int not null default 0,
  primary key (day, step)
);
alter table onboarding_stats enable row level security;
revoke all on onboarding_stats from anon, authenticated;

create or replace function track_step(p_step text) returns void
language sql security definer set search_path = public as $$
  insert into onboarding_stats (day, step, n)
  select (now() at time zone 'Europe/Amsterdam')::date, p_step, 1 where p_step in ('welcome', 'plan', 'checkout', 'paid')
  on conflict (day, step) do update set n = onboarding_stats.n + 1
$$;

create or replace function onboarding_funnel(p_days int default 30) returns table (step text, n bigint)
language sql stable security definer set search_path = public as $$
  select s.step, coalesce(sum(o.n), 0) from unnest(array['welcome', 'plan', 'checkout', 'paid']) s(step)
    left join onboarding_stats o on o.step = s.step and o.day > (now() at time zone 'Europe/Amsterdam')::date - p_days
   where is_team() group by s.step
$$;

revoke execute on function track_step(text), onboarding_funnel(int) from public;
grant execute on function track_step(text) to anon, authenticated;
grant execute on function onboarding_funnel(int) to authenticated;
