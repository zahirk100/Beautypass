// Kids corner (capacity, booking, change, Beheer, mail), favourite specialist, absence, closing days,
// carried-over treatments, Financiën page
const L = require('./lib.cjs');
async function login(p, path, email, pw) {
  await p.goto(L.APP + path, { waitUntil: 'networkidle' });
  await L.pwMode(p); await p.getByLabel('E-mailadres').fill(email); await p.getByLabel('Wachtwoord').fill(pw);
  await p.getByRole('button', { name: 'Inloggen', exact: true }).click(); await p.waitForTimeout(1500);
}
const nav = (p, label) => p.getByText(label, { exact: true }).locator('visible=true').first().click();
(async () => {
  const b = await L.chromium.launch();
  const [e1, e2] = L.sql("select string_agg(email, ' ') from (select m.email from members m join auth.users u on u.id=m.user_id where m.status='actief' order by m.created_at desc limit 2) x").split(' ');
  const id1 = L.sql(`select id from members where email='${e1}'`), id2 = L.sql(`select id from members where email='${e2}'`);
  L.sql(`update appointments set status='geannuleerd', cancel_reason='team' where member_id in ('${id1}','${id2}') and status='gepland'`);
  L.sql('update appointments set kids=0 where kids>0');
  // a clean test day (earlier runs leave bookings with other test members)
  L.sql("update appointments set status='geannuleerd', cancel_reason='team' where status='gepland' and (starts_at at time zone 'Europe/Amsterdam')::date = (now() at time zone 'Europe/Amsterdam')::date + 3");
  L.sql(`update settings set kids_enabled=true, kids_capacity=2, closed_dates='{}', rollover=false; delete from staff_absence; update members set prefs = prefs || '{"kids":true,"kidsCount":2}' where id='${id1}'`);
  const day = L.sql(`select ((now() at time zone 'Europe/Amsterdam')::date + 3)::text`);

  console.log('1. member A boekt met 2 kinderen (voorkeur uit profiel)');
  const a = await L.page(b, L.M); await login(a, '/member/', e1, 'Geheim-1234');
  await a.getByText('Plannen', { exact: true }).last().click(); await a.getByText('Blowout', { exact: true }).first().click(); await a.waitForTimeout(800);
  await a.locator('div[style*="width: 54px"]').nth(3).click(); await a.waitForTimeout(1200);
  const free = a.locator('div[style*="cursor: pointer"]', { hasText: /^\d\d:\d\d$/ });
  const t = await free.first().innerText(); await free.first().click();
  await a.getByRole('button', { name: new RegExp(t) }).click(); await a.waitForTimeout(800);
  L.check(await a.getByText('2 kinderen', { exact: true }).count() === 1, 'kinderhoek staat in het overzicht');
  L.check(await a.getByText(/nog 2 plekken vrij/).count() === 1, 'toont vrije plekken');
  await a.screenshot({ path: 'tests/e2e/shots/kids_book.png' });
  await a.getByRole('button', { name: 'Bevestig afspraak' }).click(); await a.getByText('see you soon.').waitFor();
  const dA = L.sql(`select (starts_at at time zone 'Europe/Amsterdam')::date::text from appointments where member_id='${id1}' and status='gepland' and is_primary order by created_at desc limit 1`);
  L.check(L.sql(`select kids from appointments where member_id='${id1}' and status='gepland' and is_primary order by created_at desc limit 1`) === '2', 'afspraak met 2 kinderen opgeslagen');
  await L.sleep(1500);
  const mails = await (await fetch(L.MOCK + '/mock/mails')).json();
  L.check(mails.some((x) => x.to[0].email === e1 && /Kinderhoek/.test(x.html) && /2 kinderen/.test(x.html)), 'bevestigingsmail noemt de kinderhoek');

  console.log('2. member B op hetzelfde moment: kinderhoek vol');
  const r = await a.evaluate(async ([d, tm]) => { await BP.auth.signOut(); return 0; }, [dA, t]);
  const bb = await L.page(b, L.M); await login(bb, '/member/', e2, 'Geheim-1234');
  const rr = await bb.evaluate(([d, tm]) => BP.act.book({ tid: 'mani', date: d, time: tm, staff: 'any', kids: 1 }).then(() => 'geboekt', (e) => e.message), [dA, t]);
  L.check(/kinderhoek is om .* vol|nog plek voor/i.test(rr), 'boeken met kind geweigerd: ' + rr);
  const rr2 = await bb.evaluate(([d, tm]) => BP.act.book({ tid: 'mani', date: d, time: tm, staff: 'any', kids: 0 }).then(() => 'geboekt', (e) => e.message), [dA, t]);
  L.check(rr2 === 'geboekt' || /niet meer beschikbaar|geen ruimte|specialist/.test(rr2), 'zonder kinderen kan wel (of tijd is bezet): ' + rr2);

  console.log('3. Beheer ziet en wijzigt de kinderhoek');
  const o = await L.page(b, L.D); await login(o, '/beheer/', 'owner@beautypass-test.nl', 'Team-12345');
  const ap = L.sql(`select id from appointments where member_id='${id1}' and status='gepland' and is_primary order by created_at desc limit 1`);
  await o.evaluate((x) => localStorage.setItem('bp-admin-page', 'dash'), null);
  const r3 = await o.evaluate((x) => BP.act.setKids(x, 1).then(() => 'ok', (e) => e.message), ap);
  L.check(r3 === 'ok' && L.sql(`select kids from appointments where id='${ap}'`) === '1', 'team zet kinderhoek op 1');

  console.log('4. favoriete specialist');
  const fav = L.sql("select s.id from staff s join staff_skills k on k.staff_id=s.id where k.category_id='hair' and s.active order by s.created_at limit 1");
  L.sql(`update members set prefs = prefs || '{"specialist":"${fav}"}' where id='${id2}'`);
  await bb.reload({ waitUntil: 'networkidle' }); await bb.waitForTimeout(1000);
  await bb.getByText('Plannen', { exact: true }).last().click(); await bb.getByText('Blowout', { exact: true }).first().click(); await bb.waitForTimeout(800);
  const favName = L.sql(`select name from staff where id='${fav}'`);
  L.check(await bb.locator('div[style*="1.5px solid rgb(29, 26, 23)"]', { hasText: favName }).count() > 0, 'favoriet ' + favName + ' staat geselecteerd');

  console.log('5. afwezigheid en gesloten dag');
  const all = L.sql("select string_agg(s.id::text, ',') from staff s join staff_skills k on k.staff_id=s.id where k.category_id='hair' and s.active");
  const before = Number(await o.evaluate((d) => BP.act.slotsFor('blow', d).then((x) => x.length), day));
  for (const sid of all.split(',')) await o.evaluate(([sid, d]) => BP.act.addAbsence(sid, d, d, 'vakantie'), [sid, day]);
  const after = Number(await o.evaluate((d) => BP.act.slotsFor('blow', d).then((x) => x.length), day));
  L.check(before > 0 && after === 0, `alle kappers afwezig → geen tijden (${before} → ${after})`);
  L.sql('delete from staff_absence');
  await nav(o, 'Team & roosters'); await o.waitForTimeout(500);
  await o.locator('tbody tr').first().locator('div[style*="cursor: pointer"]').first().click(); await o.waitForTimeout(500);
  await o.screenshot({ path: 'tests/e2e/shots/kids_absence.png' });
  await o.keyboard.press('Escape');
  L.sql(`update settings set closed_dates = array['${day}']::date[]`);
  const r5 = await bb.evaluate((d) => BP.act.book({ tid: 'blow', date: d, time: '14:00', staff: 'any' }).then(() => 'geboekt', (e) => e.message), day);
  L.check(/gesloten/.test(r5), 'gesloten dag: ' + r5);
  await bb.reload({ waitUntil: 'networkidle' }); await bb.waitForTimeout(800);
  L.check(!(await bb.evaluate((d) => BP.bookDays().includes(d), day)), 'gesloten dag niet in de datumkeuze');
  L.sql("update settings set closed_dates='{}'");

  console.log('6. tegoed meenemen');
  L.sql(`update members set since = current_date - 60 where id='${id2}'`);
  const l0 = Number(L.sql(`select limit_in_month('${id2}', current_date)`));
  L.sql('update settings set rollover=true');
  const l1 = Number(L.sql(`select limit_in_month('${id2}', current_date)`));
  L.check(l1 > l0, `ongebruikt tegoed vorige maand telt mee (${l0} → ${l1})`);
  L.sql('update settings set rollover=false');

  console.log('7. Financiën');
  await nav(o, 'Financiën'); await o.waitForTimeout(800);
  L.check(await o.getByText('Ontvangen').count() > 0 && await o.locator('tbody tr').count() > 0, 'Financiën toont betalingen');
  await o.screenshot({ path: 'tests/e2e/shots/finance.png', fullPage: true });
  const desk = await L.page(b, L.D); await login(desk, '/beheer/', 'desk@beautypass-test.nl', 'Team-12345');
  L.check(await desk.getByText('Financiën', { exact: true }).locator('visible=true').count() === 0, 'receptie ziet geen Financiën');
  for (const x of [a, bb, o, desk]) if (x.errs.filter((e) => !/400/.test(e)).length) console.log('  errs', x.errs.slice(0, 3));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
