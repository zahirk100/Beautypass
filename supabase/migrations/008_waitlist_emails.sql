-- E-mails for the waitlist. After every sign-up the database calls the website
-- (/api/hooks/waitlist), which sends the mail through Brevo:
--   * "signup":   welcome mail with position + personal invite link
--   * "referral": the inviter moved up, with their new position
-- The website URL and a shared secret live in private.settings (not reachable through the API).
-- Without those settings nothing is sent and sign-ups keep working. Safe to run again.

create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.settings (key text primary key, value text not null);
revoke all on private.settings from public, anon, authenticated;

create or replace function private.notify_waitlist()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare
  v_url text := (select value from private.settings where key = 'waitlist_hook_url');
  v_secret text := (select value from private.settings where key = 'waitlist_hook_secret');
  v_total bigint;
  v_me record;
  v_inviter record;
begin
  if v_url is null or v_secret is null then return new; end if;

  select count(*) into v_total from public.waitlist where status in ('waiting', 'invited');
  select r.position, r.referrals into v_me from public.waitlist_ranking r where r.id = new.id;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
    body := jsonb_build_object('type', 'signup', 'name', new.name, 'email', new.email,
      'referral_code', new.referral_code, 'position', v_me.position, 'total', v_total));

  if new.referred_by is not null then
    select w.name, w.email, w.referral_code, r.position, r.referrals into v_inviter
    from public.waitlist w join public.waitlist_ranking r on r.id = w.id
    where w.referral_code = new.referred_by;
    if found then
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
        body := jsonb_build_object('type', 'referral', 'name', v_inviter.name, 'email', v_inviter.email,
          'referral_code', v_inviter.referral_code, 'position', v_inviter.position,
          'referrals', v_inviter.referrals, 'friend', new.name, 'total', v_total));
    end if;
  end if;
  return new;
exception when others then
  -- A mail problem must never block a sign-up
  raise warning 'notify_waitlist: %', sqlerrm;
  return new;
end $$;

drop trigger if exists waitlist_notify on public.waitlist;
create trigger waitlist_notify after insert on public.waitlist
  for each row execute function private.notify_waitlist();
