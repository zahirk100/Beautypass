#!/bin/bash
# Local test seed after `supabase db reset`: team users, staff, notify settings
K=$(npx supabase status -o env 2>/dev/null | sed -n "s/^SECRET_KEY=\"\{0,1\}\([^\"]*\)\"\{0,1\}$/\1/p")
for u in owner desk specialist; do curl -s -o /dev/null -X POST http://127.0.0.1:54321/auth/v1/admin/users -H "apikey: $K" -H "Authorization: Bearer $K" -H 'content-type: application/json' -d "{\"email\":\"$u@beautypass-test.nl\",\"password\":\"Team-12345\",\"email_confirm\":true,\"user_metadata\":{\"name\":\"Team $u\"}}"; done
docker exec supabase_db_Beautypass psql -U postgres -q -c "
update profiles set role='owner' where email='owner@beautypass-test.nl';
update profiles set role='desk' where email='desk@beautypass-test.nl';
update profiles set role='specialist' where email='specialist@beautypass-test.nl';
insert into staff (name, role_title, color, workdays, user_id) values ('Sanne','Nail artist','#b7a48f','{t,t,t,t,t,t,t}', (select id from auth.users where email='specialist@beautypass-test.nl')), ('Noor','Brow & lash','#8f9e8b','{t,t,t,t,t,t,t}', null);
insert into staff_skills select s.id, c.id from staff s, categories c;
insert into private.settings values ('notify_url','http://host.docker.internal:5173/api/notify'),('notify_secret','local-notify-secret') on conflict (key) do update set value=excluded.value;"
curl -s -X POST http://127.0.0.1:4010/mock/reset >/dev/null
echo seeded
