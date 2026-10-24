// Team rescheduling, member rescheduling to an overlapping time, member details by the team, start times,
// terms consent, waiting list mail, feedback (in the app, in Beheer and the daily mail)
const L = require('./lib.cjs');
async function login(p, path, email, pw) {
  await p.goto(L.APP + path, { waitUntil: 'networkidle' });
  await p.getByLabel('E-mailadres').fill(email); await p.getByLabel('Wachtwoord').fill(pw);
  await p.getByRole('button', { name: 'Inloggen', exact: true }).click(); await p.waitForTimeout(1500);
}
const mails = async () => (await fetch(L.MOCK + '/mock/mails')).json();
const nav = (p, label) => p.getByText(label, { exact: true }).locator('visible=true').first().click();
(async () => {
  const b = await L.chromium.launch();
  const [e1, e2] = L.sql("select string_agg(email, ' ') from (select m.email from members m join auth.users u on u.id=m.user_id where m.status='actief' order by m.created_at desc limit 2) x").split(' ');
  const id1 = L.sql(`select id from members where email='${e1}'`), id2 = L.sql(`select id from members where email='${e2}'`);
  const D = L.sql("select ((now() at time zone 'Europe/Amsterdam')::date + 5)::text");
  L.sql(`update appointments set status='geannuleerd', cancel_reason='team' where status='gepland' and (member_id in ('${id1}','${id2}') or (starts_at at time zone 'Europe/Amsterdam')::date = '${D}'::date)`);
  L.sql("update settings set terms_url=null, privacy_url=null, kids_capacity=3, slot_times='{09:30,10:00,10:30,11:00,11:30,12:00,13:00,13:30,14:00,14:30,15:00,15:30,16:00,16:30,17:00,17:30}'; delete from slot_watches; update appointments set kids=0 where kids>0");
  const o = await L.page(b, L.D); await login(o, '/beheer/', 'owner@beautypass-test.nl', 'Team-12345');
  const m1 = await L.page(b, L.D); await login(m1, '/member/', e1, 'Geheim-1234');

  console.log('1. team verzet een afspraak (kinderhoek blijft)');
  const g = await m1.evaluate((d) => BP.act.book({ tid: 'blow', date: d, time: '13:00', staff: 'any', kids: 1 }), D);
  const ap = L.sql(`select id from appointments where group_id='${g.group_id}' and is_primary`);
  await o.reload({ waitUntil: 'networkidle' }); await o.waitForTimeout(800);
  await o.evaluate((id) => document.dispatchEvent(new CustomEvent('noop')), ap);
  const t0 = Date.now();
  const r1 = await o.evaluate(([id, d]) => BP.act.teamReschedule({ id, date: d, time: '13:30' }).then(() => 'ok', (e) => e.message), [ap, D]);
  L.check(r1 === 'ok', 'verzet 30 min later (overlapt met het oude tijdstip): ' + r1);
  const nw = L.sql(`select status||' '||kids||' '||to_char(starts_at at time zone 'Europe/Amsterdam','HH24:MI') from appointments where rescheduled_from='${ap}'`);
  L.check(nw === 'gepland 1 13:30', 'nieuwe afspraak: ' + nw);
  L.check(L.sql(`select status||' '||cancel_reason from appointments where id='${ap}'`) === 'geannuleerd verzet', 'oude afspraak vrijgegeven (verzet)');
  await L.sleep(1500);
  L.check((await mails()).some((x) => x.to[0].email === e1 && /^Bevestigd: Blowout/.test(x.subject) && new Date(x.at).getTime() > t0), 'member krijgt bevestiging van het nieuwe tijdstip');
  // the same in the UI drawer
  await nav(o, 'Agenda'); await o.waitForTimeout(500);
  const ap2 = L.sql(`select id from appointments where rescheduled_from='${ap}'`);
  await o.evaluate((id) => window.__open && window.__open(id), ap2);

  console.log('2. member verzet zelf naar een overlappend tijdstip');
  const r2 = await m1.evaluate(([id, d]) => BP.act.book({ tid: 'blow', date: d, time: '14:00', staff: 'any', reschedule: id }).then(() => 'ok', (e) => e.message), [ap2, D]);
  L.check(r2 === 'ok', 'verzetten naar 14:00 (overlapt met 13:30): ' + r2);

  console.log('3. team past naam en telefoon aan');
  const oldName = L.sql(`select name from members where id='${id2}'`);
  const r3 = await o.evaluate((id) => BP.act.teamUpdateMember(id, 'Gewijzigde Naam', '0687654321').then(() => 'ok', (e) => e.message), id2);
  L.check(r3 === 'ok' && L.sql(`select name||' '||phone from members where id='${id2}'`) === 'Gewijzigde Naam 0687654321', 'gegevens gewijzigd');
  await o.evaluate(([id, n]) => BP.act.teamUpdateMember(id, n, ''), [id2, oldName]);
  const desk = await L.page(b, L.D); await login(desk, '/beheer/', 'desk@beautypass-test.nl', 'Team-12345');
  const r3b = await desk.evaluate((id) => BP.act.teamUpdateMember(id, 'X Y', '').then(() => 'ok', (e) => e.message), id2);
  L.check(r3b === 'ok', 'receptie (recht members) mag het ook');

  console.log('4. starttijden');
  await nav(o, 'Instellingen'); await o.waitForTimeout(600);
  await o.locator('text=Starttijden').locator('xpath=ancestor::div[1]/..').getByRole('button', { name: '12:00', exact: true }).click(); await o.waitForTimeout(1200);
  L.check(!L.sql('select slot_times::text from settings').includes('12:00'), '12:00 uitgezet');
  const s4 = await m1.evaluate((d) => BP.act.slotsFor('mani', d).then((x) => x.map((y) => y.slot)), D);
  L.check(!s4.includes('12:00') && s4.length > 0, 'member ziet 12:00 niet meer');
  L.sql("update settings set slot_times = array_append(slot_times, '12:00') where not '12:00' = any(slot_times)");
  L.sql("update settings set slot_times = (select array_agg(t order by t) from unnest(slot_times) t)");

  console.log('5. voorwaarden');
  await o.reload({ waitUntil: 'networkidle' }); await nav(o, 'Instellingen'); await o.waitForTimeout(600);
  await o.getByPlaceholder('https://www.beautypass.nl/voorwaarden').fill('https://www.beautypass.nl/voorwaarden');
  await o.getByPlaceholder('https://www.beautypass.nl/privacy').fill('https://www.beautypass.nl/privacy');
  await o.locator('text=Voorwaarden').locator('xpath=ancestor::div[1]/..').getByRole('button', { name: 'Opslaan' }).click(); await o.waitForTimeout(1200);
  L.check(L.sql('select terms_url is not null and privacy_url is not null from settings') === 't', 'links opgeslagen');
  const n = await L.page(b, L.M);
  const email = `e2e.t.${Date.now()}@beautypass-test.nl`;
  await n.goto(L.APP + '/onboarding', { waitUntil: 'networkidle' });
  await n.getByText('Word member', { exact: true }).first().click();
  await n.getByLabel('Volledige naam').fill('Terms Test'); await n.getByLabel('E-mailadres').fill(email); await n.getByLabel('Wachtwoord').fill('Geheim-1234');
  const tt = Date.now() - 2000; await n.getByRole('button', { name: 'Volgende' }).click();
  await n.getByLabel('Code').fill(await L.otp(email, tt)); await n.getByRole('button', { name: 'Bevestigen' }).click();
  await n.getByText('Stel je').waitFor(); await n.getByText('Blowout', { exact: true }).click();
  await n.getByRole('button', { name: /Verder met/ }).click(); await n.getByRole('button', { name: /^Kies / }).click();
  await n.getByRole('button', { name: /Betaal & machtig/ }).click(); await n.waitForTimeout(600);
  L.check(await n.getByText('Ga eerst akkoord met de voorwaarden en het privacybeleid').count() === 1, 'zonder vinkje: melding, geen betaling');
  await n.screenshot({ path: 'tests/e2e/shots/terms.png' });
  await n.locator('input[type=checkbox]').check();
  await n.getByRole('button', { name: /Betaal & machtig/ }).click(); await n.waitForURL(/checkout/);
  L.check(L.sql(`select terms_accepted_at is not null from members where email='${email}'`) === 't', 'akkoord vastgelegd bij de member');
  await n.click('#paid'); await n.waitForURL(/betaald=1/);
  L.sql('update settings set terms_url=null, privacy_url=null');

  console.log('6. wachtlijst: mail als er plek vrijkomt');
  await m1.reload({ waitUntil: 'networkidle' });
  const m2 = await L.page(b, L.D); await login(m2, '/member/', e2, 'Geheim-1234');
  await m2.evaluate((d) => BP.act.watchSlot('mani', d), D);
  L.check(L.sql(`select count(*) from slot_watches where member_id='${id2}' and date='${D}'`) === '1', 'op de wachtlijst voor ' + D);
  const t6 = Date.now();
  const ap6 = L.sql(`select id from appointments where member_id='${id1}' and status='gepland' and is_primary order by created_at desc limit 1`);
  await m1.evaluate((id) => BP.act.cancel(id), ap6); await L.sleep(2500);
  L.check((await mails()).some((x) => x.to[0].email === e2 && /^Er is plek: Manicure/.test(x.subject) && new Date(x.at).getTime() > t6), 'mail "Er is plek" verstuurd');
  L.check(L.sql(`select notified_at is not null from slot_watches where member_id='${id2}' and date='${D}'`) === 't', 'maar één keer');

  console.log('7. feedback');
  const done = L.sql(`select id from appointments where member_id='${id2}' and is_primary order by starts_at limit 1`);
  L.sql(`update appointments set status='afgerond', starts_at = now() - interval '1 day', ends_at = now() - interval '1 day' + interval '45 minutes', review_asked_at=null where id='${done}'`);
  L.sql(`delete from reviews where appointment_id='${done}'`);
  await m2.reload({ waitUntil: 'networkidle' }); await m2.waitForTimeout(800);
  L.check(await m2.getByText(/^Hoe was je /).count() > 0, 'member ziet "Hoe was je …?" op home');
  await m2.getByRole('button', { name: 'Beoordelen' }).first().click(); await m2.waitForTimeout(500);
  await m2.getByLabel('4 sterren').click(); await m2.getByPlaceholder('Wil je nog iets kwijt? (optioneel)').fill('Heel fijn, dank!');
  await m2.getByRole('button', { name: 'Versturen' }).click(); await m2.waitForTimeout(1200);
  L.check(L.sql(`select rating||' '||comment from reviews where appointment_id='${done}'`) === '4 Heel fijn, dank!', 'beoordeling opgeslagen');
  await o.reload({ waitUntil: 'networkidle' }); await nav(o, 'Dashboard'); await o.waitForTimeout(800);
  L.check(await o.getByText('Heel fijn, dank!').count() > 0, 'Beheer toont de feedback op het dashboard');
  await o.screenshot({ path: 'tests/e2e/shots/feedback_dash.png', fullPage: true });
  const r7 = await m2.evaluate(async () => { const x = BP.get().appointments.find((a) => a.status === 'gepland'); return x ? BP.act.review(x.id, 5).then(() => 'ok', (e) => e.message) : 'geen geplande'; });
  L.check(r7 !== 'ok', 'geplande afspraak beoordelen kan niet: ' + r7);
  L.sql(`delete from reviews where appointment_id='${done}'; update appointments set review_asked_at=null where id='${done}'`);
  const t7 = Date.now();
  const cr = await (await fetch(L.APP + '/api/cron-daily', { headers: { authorization: 'Bearer local-cron-secret' } })).json();
  L.check(cr.ok && cr.reviews >= 1, 'dagelijkse taak vraagt om feedback: ' + JSON.stringify(cr));
  L.check((await mails()).some((x) => x.to[0].email === e2 && /^Hoe was je/.test(x.subject) && /review=/.test(x.html) && new Date(x.at).getTime() > t7), 'mail "Hoe was je …?" met link');
  for (const x of [o, m1, m2, n, desk]) { const e = x.errs.filter((y) => !/400|401/.test(y)); if (e.length) console.log('  errs', e.slice(0, 3)); }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
