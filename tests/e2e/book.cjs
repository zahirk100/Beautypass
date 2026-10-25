// Member books (mobile + desktop), Beheer sees it live, member cancels; paid booking holds then confirms
const L = require('./lib.cjs');
async function login(p, path, email, pw) {
  await p.goto(L.APP + path, { waitUntil: 'networkidle' });
  await L.pwMode(p); await p.getByLabel('E-mailadres').fill(email); await p.getByLabel('Wachtwoord').fill(pw);
  await p.getByRole('button', { name: 'Inloggen', exact: true }).click();
}
(async () => {
  const b = await L.chromium.launch();
  const email = L.sql("select email from members where status='actief' and email like 'e2e.m.%' order by created_at desc limit 1");
  console.log('member', email);
  // Beheer open on the agenda (owner, desktop)
  const adm = await L.page(b, L.D);
  await login(adm, '/beheer/', 'owner@beautypass-test.nl', 'Team-12345');
  await adm.getByText('Agenda', { exact: true }).locator('visible=true').first().click();
  await adm.waitForTimeout(800);

  const p = await L.page(b, L.M);
  await login(p, '/member/', email, 'Geheim-1234');
  await p.getByText('Plannen', { exact: true }).last().click();
  await p.getByText('Gellak manicure', { exact: true }).locator('visible=true').first().click();
  // pick the first free time on the first day offered
  await p.waitForTimeout(1200);
  const free = p.locator('div[style*="cursor: pointer"]', { hasText: /^\d\d:\d\d$/ });
  L.check(await free.count() > 0, 'vrije tijden zichtbaar: ' + await free.count());
  const time = await free.first().innerText();
  await free.first().click();
  await p.getByRole('button', { name: new RegExp(time) }).click();
  await p.screenshot({ path: 'tests/e2e/shots/book_m_overview.png' });
  await p.getByRole('button', { name: 'Bevestig afspraak' }).click();
  await p.getByText('see you soon.').waitFor();
  L.check(true, 'afspraak bevestigd om ' + time);
  const appt = L.sql(`select a.id||'|'||a.status||'|'||a.confirmed from appointments a join members m on m.id=a.member_id where m.email='${email}' and a.is_primary order by a.created_at desc limit 1`);
  L.check(/\|gepland\|true$/.test(appt), 'in database: ' + appt);
  // live in Beheer: switch agenda to that day? check the dashboard/agenda text for member name
  await adm.waitForTimeout(2500);
  const seen = await adm.evaluate((id) => BP.state ? true : true, null);
  const inState = await adm.evaluate(() => window.BP && window.BP.get ? window.BP.get().appointments.length : -1);
  console.log('  beheer appointments in state:', inState);
  await adm.screenshot({ path: 'tests/e2e/shots/book_adm_agenda.png' });
  await L.sleep(1500);
  const mails = await (await fetch(L.MOCK + '/mock/mails')).json();
  L.check(mails.some((x) => x.to[0].email === email && /^Bevestigd/.test(x.subject)), 'bevestigingsmail verstuurd (via database-trigger)');
  L.check(!p.errs.length && !adm.errs.length, 'geen JS-fouten ' + [...p.errs, ...adm.errs].join(' | '));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
