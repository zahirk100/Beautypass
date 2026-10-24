-- BeautyPass 005: a member cannot change the e-mail address of the account the membership was taken
-- out with. The app has no option for it; this also blocks it when someone calls the auth API directly.
-- The salon can still change it in Supabase (SQL Editor):
--   select set_config('bp.allow_email_change', 'on', false);
--   update auth.users set email = 'nieuw@adres.nl' where email = 'oud@adres.nl';
set search_path = public, extensions;

create or replace function handle_user_email_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    if exists (select 1 from members where user_id = new.id)
       and coalesce(current_setting('bp.allow_email_change', true), '') <> 'on' then
      raise exception 'Het e-mailadres van een membership kan alleen de salon wijzigen';
    end if;
    update profiles set email = new.email where id = new.id;
    update members set email = new.email where user_id = new.id;
  end if;
  return new;
end $$;

-- Also refuse the request itself (GoTrue first stores the new address in email_change)
create or replace function block_member_email_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.email_change, '') <> '' and new.email_change is distinct from old.email_change
     and exists (select 1 from members where user_id = new.id)
     and coalesce(current_setting('bp.allow_email_change', true), '') <> 'on' then
    raise exception 'Het e-mailadres van een membership kan alleen de salon wijzigen';
  end if;
  return new;
end $$;
drop trigger if exists on_auth_member_email_request on auth.users;
create trigger on_auth_member_email_request before update of email_change on auth.users
  for each row execute function block_member_email_change();
