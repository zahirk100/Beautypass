-- BeautyPass 009: tightening after the full review. Run after 008.
set search_path = public, extensions;

-- ───────── Which login belongs to which specialist: only for the team (not for visitors or members) ─────────
revoke select on staff from anon, authenticated;
grant select (id, name, role_title, color, workdays, active, created_at) on staff to anon, authenticated;

create or replace function staff_links() returns table (staff_id uuid, user_id uuid)
language sql stable security definer set search_path = public as $$
  select s.id, s.user_id from staff s where is_team()
$$;

-- ───────── Usage per member is only readable through month_usage() / agenda_members() (with rights checks) ─────────
revoke execute on function used_in_month(uuid, date, uuid), limit_in_month(uuid, date) from public, anon, authenticated;

revoke execute on function staff_links() from public, anon;
grant execute on function staff_links() to authenticated;
