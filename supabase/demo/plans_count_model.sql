-- Memberships op aantal (optioneel, voor de demo-memberships): elke behandeling op een solo-plek telt mee in
-- elk membership; laser groot gebied alleen in het membership met 6 of meer behandelingen per maand.
-- Daarna stel je het verder in via Beheer → Memberships.
insert into plan_treatments (plan_id, treatment_id)
select p.id, t.id from plans p cross join treatments t
 where t.active and t.room = 'solo' and (t.id <> 'laserl' or p.per_month >= 6)
on conflict do nothing;
delete from plan_treatments pt using plans p
 where pt.plan_id = p.id and pt.treatment_id = 'laserl' and p.per_month < 6;
