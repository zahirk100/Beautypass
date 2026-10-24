-- BeautyPass 004: two onboarding fixes. Run after 003.
--  1. Signing up again with an e-mail address whose login was deleted: the existing member record
--     (kept for its history) is linked to the new login instead of failing on "members_email".
--  2. Choosing another membership on a second payment attempt was blocked by members_guard.
set search_path = public, extensions;

-- Trusted functions mark their own updates; a client cannot set this (only inside a function)
create or replace function members_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or has_perm('members') or current_setting('bp.trusted', true) = 'on' then return new; end if;
  if (new.id, new.user_id, new.email, new.plan_id, new.next_plan_id, new.status, new.since, new.paused_until, new.cancel_at,
      new.mollie_customer_id, new.mollie_subscription_id, new.mandate_id, new.mandate_method, new.mandate_label, new.created_at)
     is distinct from
     (old.id, old.user_id, old.email, old.plan_id, old.next_plan_id, old.status, old.since, old.paused_until, old.cancel_at,
      old.mollie_customer_id, old.mollie_subscription_id, old.mandate_id, old.mandate_method, old.mandate_label, old.created_at) then
    raise exception 'Dit kun je niet zelf wijzigen';
  end if;
  if new.routine <> '{}' and exists (select 1 from unnest(new.routine) t where t not in (select id from treatments)) then
    raise exception 'Onbekende behandeling in je routine';
  end if;
  return new;
end $$;

create or replace function member_onboard(p_name text, p_phone text, p_routine text[], p_plan text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_email text; v_confirmed timestamptz; v_status member_status;
  v_routine text[] := coalesce((select array_agg(x) from unnest(p_routine) x where x in (select id from treatments)), '{}');
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Vul je naam in'; end if;
  if not exists (select 1 from plans where id = p_plan and active) then raise exception 'Kies een membership'; end if;
  select email, email_confirmed_at into v_email, v_confirmed from auth.users where id = auth.uid();
  perform set_config('bp.trusted', 'on', true);
  select id into v_id from members where user_id = auth.uid();
  if v_id is null then
    -- A member record without login and with this (confirmed) address belongs to this person
    select id into v_id from members where lower(email) = lower(v_email) and user_id is null for update;
    if v_id is not null then
      if v_confirmed is null then raise exception 'Bevestig eerst je e-mailadres'; end if;
      update members set user_id = auth.uid() where id = v_id;
      perform log_action('member_relinked', 'member', v_id::text, '{}');
    end if;
  end if;
  if v_id is null then
    insert into members (user_id, name, email, phone, plan_id, routine)
    values (auth.uid(), left(trim(p_name), 120), v_email, nullif(left(trim(coalesce(p_phone, '')), 30), ''), p_plan, v_routine)
    returning id into v_id;
  else
    select status into v_status from members where id = v_id;
    if v_status not in ('nieuw', 'opgezegd') then
      perform set_config('bp.trusted', 'off', true);
      -- A running membership that was just linked to the new login stays linked (no error, no changes)
      if exists (select 1 from audit_log where action = 'member_relinked' and entity_id = v_id::text and actor = auth.uid()
                 and at > now() - interval '1 minute') then return v_id; end if;
      raise exception 'Je bent al member. Wijzig je membership in de app.';
    end if;
    update members set name = left(trim(p_name), 120), phone = nullif(left(trim(coalesce(p_phone, '')), 30), ''),
      plan_id = p_plan, next_plan_id = null, routine = v_routine
    where id = v_id;
  end if;
  perform set_config('bp.trusted', 'off', true);
  update profiles set name = left(trim(p_name), 120) where id = auth.uid();
  update waitlist set status = 'member' where lower(email) = lower(v_email);
  return v_id;
end $$;
revoke execute on function member_onboard(text, text, text[], text) from public, anon;
grant execute on function member_onboard(text, text, text[], text) to authenticated;
