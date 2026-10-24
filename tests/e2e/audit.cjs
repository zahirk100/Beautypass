// Review round: leaks (staff logins, usage of other members), paying an open month yourself, undoing a
// cancellation, unpaid reservations (pay again, lapse, paid too late → refund), unpaid upgrade, pause
const L = require('./lib.cjs');
async function login(p, path, email, pw) {
  await p.goto(L.APP + path, { waitUntil: 'networkidle' });
  await p.getByLabel('E-mailadres').fill(email); await p.getByLabel('Wachtwoord').fill(pw);
  await p.getByRole('button', { name: 'Inloggen', exact: true }).click(); await p.waitForTimeout(1500);
}
const mails = async () => (await fetch(L.MOCK + '/mock/mails')).json();
const webhook = (id) => fetch(L.APP + '/api/mollie-webhook', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
(async () => {
  const b = await L.chromium.launch();
  const email = L.sql("select m.email from members m join auth.users u on u.id=m.user_id where m.status='actief' and m.mandate_id is not null and m.mollie_subscription_id is not null and m.cancel_at is null order by m.created_at desc limit 1");
  const id = L.sql(`select id from members where email='${email}'`);
  const plan0 = L.sql(`select plan_id from members where id='${id}'`);
  L.sql(`update appointments set status='geannuleerd', cancel_reason='team' where member_id='${id}' and status='gepland'`);

  console.log('1. geen lekken');
  const anon = await L.page(b, L.D); await anon.goto(L.APP + '/onboarding', { waitUntil: 'networkidle' });
  const a1 = await anon.evaluate(() => BP.supabase.from('staff').select('user_id').then((r) => r.error ? 'geweigerd' : JSON.stringify(r.data)));
  L.check(a1 === 'geweigerd', 'bezoeker ziet geen inlogaccounts van specialisten: ' + a1);
  const a2 = await anon.evaluate(() => BP.supabase.from('staff').select('name').then((r) => r.error ? r.error.message : r.data.length));
  L.check(typeof a2 === 'number' && a2 > 0, 'namen van specialisten wel: ' + a2);
  const m = await L.page(b, L.D); await login(m, '/member/', email, 'Geheim-1234');
  const other = L.sql(`select id from members where id <> '${id}' limit 1`);
  const a3 = await m.evaluate((o) => BP.supabase.rpc('limit_in_month', { p_member: o, p_month: '2026-10-01' }).then((r) => r.error ? 'geweigerd' : r.data), other);
  L.check(a3 === 'geweigerd', 'member kan het tegoed van een ander niet opvragen: ' + a3);
  const a4 = await m.evaluate(() => BP.supabase.rpc('staff_links').then((r) => r.error ? r.error.message : r.data.length));
  L.check(a4 === 0, 'staff_links geeft een member niets: ' + a4);
  const o = await L.page(b, L.D); await login(o, '/beheer/', 'owner@beautypass-test.nl', 'Team-12345');
  const linked = L.sql('select count(*) from staff where user_id is not null and active');
  const a5 = await o.evaluate(() => BP.get().team.filter((t) => t.userId).length);
  L.check(String(a5) === linked, `Beheer ziet de gekoppelde accounts nog (${a5}/${linked})`);

  console.log('2. mislukte incasso zelf betalen');
  const r2 = await o.evaluate((x) => fetch('/api/demo-charge', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + BP.get().session.access_token }, body: JSON.stringify({ member_id: x, outcome: 'failed' }) }).then((r) => r.json()), id);
  L.check(r2.ok && L.sql(`select status from members where id='${id}'`) === 'betaling mislukt', 'incasso mislukt');
  await m.reload({ waitUntil: 'networkidle' }); await m.waitForTimeout(800);
  L.check(await m.getByText(/Je laatste betaling van .* is niet gelukt/).count() > 0, 'member ziet de melding');
  await m.screenshot({ path: 'tests/e2e/shots/audit_failed.png' });
  const mdt0 = L.sql(`select mandate_id from members where id='${id}'`);
  await m.getByRole('button', { name: 'Nu betalen' }).first().click(); await m.waitForURL(/checkout/);
  await m.click('#paid'); await m.waitForURL(/member/); await m.waitForTimeout(800);
  L.check(L.sql(`select status from members where id='${id}'`) === 'actief', 'na betalen weer actief');
  L.check(L.sql(`select mandate_id from members where id='${id}'`) !== mdt0, 'nieuwe machtiging vastgelegd');
  const sub = L.sql(`select mollie_subscription_id from members where id='${id}'`);
  L.check(L.sql(`select data->>'mandateId' from demo_mollie where id='${sub}'`) === L.sql(`select mandate_id from members where id='${id}'`), 'incasso loopt via de nieuwe machtiging');
  L.check(L.sql(`select count(*) from payments where member_id='${id}' and kind='maand' and status='betaald' and description like '%openstaand%'`) === '1', 'betaling staat bij de facturen');

  console.log('3. opzeggen en weer intrekken');
  await m.evaluate(() => BP.act.membership('cancel'));
  await m.evaluate(() => localStorage.setItem('bp-web-page', 'membership'));
  await m.reload({ waitUntil: 'networkidle' }); await m.waitForTimeout(800);
  L.check(await m.getByText(/Je hebt opgezegd/).count() > 0, 'member ziet tot wanneer het loopt');
  await m.getByRole('button', { name: 'Opzegging intrekken' }).first().click(); await m.waitForTimeout(1500);
  L.check(L.sql(`select (cancel_at is null and mollie_subscription_id is not null)::text from members where id='${id}'`) === 'true', 'opzegging ingetrokken, incasso loopt weer');
  const sub2 = L.sql(`select mollie_subscription_id from members where id='${id}'`);
  L.check(L.sql(`select data->>'status' from demo_mollie where id='${sub2}'`) === 'active', 'nieuwe subscription actief');

  console.log('4. losse behandeling: geannuleerd bij Mollie, opnieuw betalen');
  const D = L.sql("select ((now() at time zone 'Europe/Amsterdam')::date + 6)::text");
  const notIn = L.sql(`select t.id from treatments t where t.active and not exists (select 1 from plan_treatments pt join members m on m.plan_id=pt.plan_id where m.id='${id}' and pt.treatment_id=t.id) limit 1`);
  L.sql(`update appointments set status='geannuleerd', cancel_reason='team' where status='gepland' and (starts_at at time zone 'Europe/Amsterdam')::date='${D}'`);
  const g = await m.evaluate(([t, d]) => BP.act.book({ tid: t, date: d, time: '11:00', staff: 'any' }), [notIn, D]);
  L.check(g.needs_payment, 'boeking moet betaald worden');
  let pay = await m.evaluate((x) => BP.act.payAppointment(x), g.group_id);
  await m.goto(pay.checkoutUrl); await m.click('#canceled'); await m.waitForURL(/member/); await m.waitForTimeout(1000);
  const ap = L.sql(`select id from appointments where group_id='${g.group_id}' and is_primary`);
  L.check(L.sql(`select status||' '||confirmed from appointments where id='${ap}'`) === 'gepland false', 'tijd blijft vastgehouden na annuleren bij Mollie');
  L.check(await m.getByText('nog betalen').count() > 0, 'member ziet "nog betalen"');
  await m.screenshot({ path: 'tests/e2e/shots/audit_unpaid.png' });
  pay = await m.evaluate((x) => BP.act.payAppointment(x), g.group_id);
  await m.goto(pay.checkoutUrl); await m.click('#paid'); await m.waitForURL(/member/);
  L.check(L.sql(`select status||' '||confirmed from appointments where id='${ap}'`) === 'gepland true', 'tweede poging betaald → bevestigd');

  console.log('5. betaald na het verlopen van de reservering → terugbetaald');
  const g5 = await m.evaluate(([t, d]) => BP.act.book({ tid: t, date: d, time: '14:00', staff: 'any' }), [notIn, D]);
  const pay5 = await m.evaluate((x) => BP.act.payAppointment(x), g5.group_id);
  L.sql(`update appointments set hold_until = now() - interval '1 minute' where group_id='${g5.group_id}'`);
  await m.reload({ waitUntil: 'networkidle' }); await m.waitForTimeout(600);
  L.check(await m.evaluate((x) => BP.get().appointments.find((a) => a.groupId === x && a.primary).status, g5.group_id) === 'geannuleerd', 'verlopen reservering toont niet meer als gepland');
  L.sql('select release_expired_holds()');
  const t5 = Date.now();
  await m.goto(pay5.checkoutUrl); await m.click('#paid'); await m.waitForURL(/member/); await L.sleep(800);
  L.check(L.sql(`select status from payments where appointment_group='${g5.group_id}'`) === 'terugbetaald', 'betaling automatisch teruggestort');
  L.check((await mails()).some((x) => x.to[0].email === email && x.subject === 'Je betaling komt terug' && new Date(x.at).getTime() > t5), 'member krijgt daar een mail over');

  console.log('6. upgrade niet betaald → terug naar het oude membership');
  const up = L.sql(`select p.id from plans p, members m join plans c on c.id=m.plan_id where m.id='${id}' and p.active and p.price > c.price order by p.price limit 1`);
  if (up) {
    L.sql(`update members set next_payment_date = current_date + 20 where id='${id}'`);
    await m.evaluate((x) => BP.act.membership('plan', { plan: x }), up);
    const pid = L.sql(`select mollie_payment_id from payments where member_id='${id}' and kind='upgrade' order by created_at desc limit 1`);
    L.check(L.sql(`select plan_id from members where id='${id}'`) === up, 'upgrade direct actief');
    L.sql(`update demo_mollie set data = data || '{"status":"failed"}' where id='${pid}'; update payments set status='open' where mollie_payment_id='${pid}'`);
    await webhook(pid);
    L.check(L.sql(`select plan_id from members where id='${id}'`) === plan0, 'mislukte upgrade teruggedraaid');
    L.check(L.sql(`select data->'amount'->>'value' from demo_mollie where id=(select mollie_subscription_id from members where id='${id}')`) === L.sql(`select to_char(price,'FM9999990.00') from plans where id='${plan0}'`), 'maandbedrag weer het oude');
  } else console.log('  (geen duurder membership om te testen)');

  console.log('7. pauze: afspraken in de onbetaalde periode vervallen');
  L.sql(`update appointments set status='geannuleerd', cancel_reason='team' where member_id='${id}' and status='gepland'`);
  L.sql(`update members set next_payment_date = current_date + 3 where id='${id}'; delete from membership_pauses where member_id='${id}'`);
  const inc = L.sql(`select pt.treatment_id from plan_treatments pt join members m on m.plan_id=pt.plan_id where m.id='${id}' limit 1`);
  const near = L.sql("select ((now() at time zone 'Europe/Amsterdam')::date + 1)::text"), far = L.sql("select ((now() at time zone 'Europe/Amsterdam')::date + 10)::text");
  L.sql(`update appointments set status='geannuleerd', cancel_reason='team' where status='gepland' and (starts_at at time zone 'Europe/Amsterdam')::date in ('${near}','${far}')`);
  L.sql(`update settings set closed_dates='{}'`);
  const k1 = await m.evaluate(([t, d]) => BP.act.book({ tid: t, date: d, time: '15:00', staff: 'any' }).then((r) => r.group_id, (e) => e.message), [inc, near]);
  const k2 = await m.evaluate(([t, d]) => BP.act.book({ tid: t, date: d, time: '15:00', staff: 'any' }).then((r) => r.group_id, (e) => e.message), [inc, far]);
  await m.evaluate(() => BP.act.membership('pause', { months: 1 }));
  L.check(L.sql(`select status from appointments where group_id='${k1}' and is_primary`) === 'gepland', 'afspraak binnen de betaalde periode blijft');
  L.check(L.sql(`select status from appointments where group_id='${k2}' and is_primary`) === 'geannuleerd', 'afspraak tijdens de pauze vervalt');
  await m.evaluate(() => BP.act.membership('resume'));
  L.check(L.sql(`select status from members where id='${id}'`) === 'actief', 'weer hervat');

  for (const x of [anon, m, o]) { const e = x.errs.filter((y) => !/400|401|403|404/.test(y)); if (e.length) console.log('  errs', e.slice(0, 3)); }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
