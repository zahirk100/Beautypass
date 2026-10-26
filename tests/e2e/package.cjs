// For now members book only what is in their membership, up to the monthly number (Beheer → Losse behandelingen off)
const L = require('./lib.cjs');
async function login(p, path, email, pw) {
  await p.goto(L.APP + path, { waitUntil: 'networkidle' });
  await L.pwMode(p); await p.getByLabel('E-mailadres').fill(email); await p.getByLabel('Wachtwoord').fill(pw);
  await p.getByRole('button', { name: 'Inloggen', exact: true }).click(); await p.waitForTimeout(1500);
}
(async () => {
  const b = await L.chromium.launch();
  L.sql('update settings set allow_extras=false');
  const email = L.sql("select m.email from members m join auth.users u on u.id=m.user_id join plans p on p.id=m.plan_id where m.status='actief' and m.cancel_at is null and p.per_month=2 and u.encrypted_password <> '' order by m.created_at desc limit 1");
  const id = L.sql(`select id from members where email='${email}'`);
  L.sql(`update appointments set status='geannuleerd', cancel_reason='team' where member_id='${id}' and status='gepland'; delete from allowance_adjustments where member_id='${id}'`);
  const D = L.sql("select ((now() at time zone 'Europe/Amsterdam')::date + 6)::text");
  const p = await L.page(b, L.M); await login(p, '/member/', email, 'Geheim-1234');

  console.log('1. niet in het membership');
  const r1 = await p.evaluate((d) => BP.act.book({ tid: 'pedi', date: d, time: '11:00', staff: 'any' }).then(() => 'geboekt', (e) => e.message), D);
  L.check(/zit niet in je .*membership/.test(r1), 'server weigert: ' + r1);
  await p.getByText('Plannen', { exact: true }).last().click(); await p.waitForTimeout(600);
  L.check(await p.getByText('Zit in Signature').count() > 0, 'app toont "Zit in Signature" bij pedicure');
  await p.getByText('Pedicure', { exact: true }).first().click(); await p.waitForTimeout(400);
  L.check(await p.getByText(/zit niet in je .*membership, wel in Signature/).count() === 1, 'tikken legt uit waarom');
  await p.screenshot({ path: 'tests/e2e/shots/package_locked.png' });

  console.log('2. tegoed op');
  const used = Number(L.sql(`select used_in_month('${id}', '${D}')`)), lim = Number(L.sql(`select limit_in_month('${id}', '${D}')`));
  L.sql(`insert into allowance_adjustments (member_id, month, delta, reason) values ('${id}', date_trunc('month', '${D}'::date)::date, ${used - lim}, 'test')`);
  const r2 = await p.evaluate((d) => BP.act.book({ tid: 'mani', date: d, time: '11:00', staff: 'any' }).then(() => 'geboekt', (e) => e.message), D);
  L.check(/tegoed .* op/.test(r2), 'server weigert: ' + r2);
  const r3 = await p.evaluate((d) => BP.act.bookVisit({ tids: ['mani', 'blow'], date: d, time: '11:00' }).then(() => 'geboekt', (e) => e.message), D);
  L.check(/nog 0 behandeling/.test(r3), 'routine weigert ook: ' + r3);
  L.sql(`delete from allowance_adjustments where member_id='${id}'`);

  console.log('3. Beheer zet losse behandelingen aan');
  L.sql('update settings set allow_extras=true');
  const r4 = await p.evaluate((d) => BP.act.book({ tid: 'pedi', date: d, time: '11:00', staff: 'any' }).then((r) => r.needs_payment ? 'betalen' : 'geboekt', (e) => e.message), D);
  L.check(r4 === 'betalen', 'met de schakelaar aan kan het weer (los betalen): ' + r4);
  L.sql(`update appointments set status='geannuleerd', cancel_reason='team' where member_id='${id}' and status='gepland'`);
  L.sql('update settings set allow_extras=false');
  L.check(!p.errs.filter((e) => !/400|401/.test(e)).length, 'geen JS-fouten ' + p.errs.join(' | '));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
