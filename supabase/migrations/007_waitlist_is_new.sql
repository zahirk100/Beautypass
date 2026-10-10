-- join_waitlist() also reports whether this was a new sign-up, so the landing page can say
-- "je staat al op de lijst" instead of welcoming the same e-mail address again. Safe to run again.

drop function if exists public.join_waitlist(text, text, text, text, text, text);

create function public.join_waitlist(
  p_name text, p_email text, p_phone text, p_source text, p_campaign text, p_ref text)
returns table (referral_code text, waitlist_position bigint, referrals bigint, total bigint, is_new boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_ref text := nullif(lower(trim(coalesce(p_ref, ''))), '');
  v_new int;
begin
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then raise exception 'Ongeldig e-mailadres'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Vul je voornaam in'; end if;
  if v_ref is not null and not exists (select 1 from public.waitlist w where w.referral_code = v_ref) then v_ref := null; end if;

  insert into public.waitlist (name, email, phone, consent, source, campaign, referred_by)
  values (left(trim(p_name), 100), v_email, nullif(left(trim(coalesce(p_phone, '')), 30), ''), true,
          left(coalesce(p_source, 'direct'), 500), nullif(left(coalesce(p_campaign, ''), 200), ''), v_ref)
  on conflict ((lower(email))) do nothing;
  get diagnostics v_new = row_count;

  return query
    select r.referral_code, r.position, r.referrals,
           (select count(*) from public.waitlist where status in ('waiting', 'invited')), v_new > 0
    from public.waitlist_ranking r where lower(r.email) = v_email;
end $$;

revoke execute on function public.join_waitlist(text, text, text, text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text, text, text, text) to anon, authenticated;
