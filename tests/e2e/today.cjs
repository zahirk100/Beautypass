// Same-day booking in the member app (phone + desktop), while the salon is open for at least another hour
const L = require('./lib.cjs');
async function login(p, email) {
  await p.goto(L.APP + '/member/', { waitUntil: 'networkidle' });
  await p.getByLabel('E-mailadres').fill(email); await p.getByLabel('Wachtwoord').fill('Geheim-1234');
  await p.getByRole('button', { name: 'Inloggen', exact: true }).click(); await p.waitForTimeout(1500);
}
(async () => {
  const b = await L.chromium.launch();
  const email = L.sql("select m.email from members m join auth.users u on u.id=m.user_id where m.status='actief' order by m.created_at desc limit 1");
  const mid = L.sql(`select id from members where email='${email}'`);
  L.sql(`update appointments set status='geannuleerd', cancel_reason='team' where member_id='${mid}' and status='gepland'`);
  const open = L.sql(`select count(*) from settings, unnest(slot_times) t where local_ts((now() at time zone 'Europe/Amsterdam')::date, t) > now() + interval '1 hour'
    and t::time + interval '45 minutes' <= ((hours -> weekday_idx((now() at time zone 'Europe/Amsterdam')::date))->>2)::time`);
  if (open === '0') { console.log('  (salon vandaag bijna dicht: test overgeslagen)'); await b.close(); return; }
  for (const [tag, o] of [['m', L.M], ['d', L.D]]) {
    const p = await L.page(b, o); await login(p, email);
    if (tag === 'm') { await p.getByText('Plannen', { exact: true }).last().click(); await p.getByText('Blowout', { exact: true }).first().click(); }
    else { await p.locator('header').getByText('Plannen', { exact: true }).click(); await p.waitForTimeout(500); await p.getByText('Blowout', { exact: true }).first().click(); }
    await p.waitForTimeout(1500);
    L.check(await p.getByText('vandaag', { exact: true }).count() > 0, tag + ': vandaag staat in de datumkeuze');
    const free = p.locator('div[style*="cursor: pointer"]', { hasText: /^\d\d:\d\d$/ });
    L.check(await free.count() > 0, tag + ': vrije tijden vandaag: ' + await free.count());
    await p.screenshot({ path: `tests/e2e/shots/today_${tag}.png` });
    L.sql(`update appointments set status='geannuleerd', cancel_reason='team' where member_id='${mid}' and status='gepland'`);
  }
  // and the booking itself
  const p = await L.page(b, L.M); await login(p, email);
  await p.getByText('Plannen', { exact: true }).last().click(); await p.getByText('Blowout', { exact: true }).first().click(); await p.waitForTimeout(1500);
  const free = p.locator('div[style*="cursor: pointer"]', { hasText: /^\d\d:\d\d$/ });
  const t = await free.first().innerText(); await free.first().click();
  await p.getByRole('button', { name: new RegExp(t) }).click(); await p.getByRole('button', { name: 'Bevestig afspraak' }).click();
  await p.getByText('see you soon.').waitFor();
  L.check(L.sql(`select count(*) from appointments where member_id='${mid}' and status='gepland' and (starts_at at time zone 'Europe/Amsterdam')::date=(now() at time zone 'Europe/Amsterdam')::date`) === '1', 'afspraak vandaag om ' + t + ' geboekt');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
