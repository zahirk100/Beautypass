-- BeautyPass 010: onboarding without an account first. Run after 009.
-- The login is made at checkout (e-mail only). As long as someone has never logged in, the salon may still
-- correct a mistyped address (Beheer → member); after the first login the address stays locked as before.
set search_path = public, extensions;

create or replace function handle_user_email_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    if exists (select 1 from members where user_id = new.id)
       and old.last_sign_in_at is not null
       and coalesce(current_setting('bp.allow_email_change', true), '') <> 'on' then
      raise exception 'Het e-mailadres van een membership kan alleen de salon wijzigen';
    end if;
    update profiles set email = new.email where id = new.id;
    update members set email = new.email where user_id = new.id;
  end if;
  return new;
end $$;
