// Profile: initials for a lower-case name; a member cannot change the membership's e-mail address
const L = require('./lib.cjs');
(async () => {
  const b = await L.chromium.launch(); const m = await L.page(b, L.M);
  const email = L.sql("select m.email from members m join auth.users u on u.id=m.user_id where m.status='actief' order by m.created_at desc limit 1");
  await m.goto(L.APP + '/member/', { waitUntil: 'networkidle' });
  await L.pwMode(m); await m.getByLabel('E-mailadres').fill(email); await m.getByLabel('Wachtwoord').fill('Geheim-1234');
  await m.getByRole('button', { name: 'Inloggen', exact: true }).click(); await m.waitForTimeout(1500);
  await m.getByText('Profiel', { exact: true }).last().click(); await m.waitForTimeout(500);
  await m.screenshot({ path: 'tests/e2e/shots/profile_m.png' });
  L.check(await m.getByText(/^[A-Z]{1,2}$/).count() > 0, 'initialen zichtbaar');
  await m.getByText(/Telefoonnummer toevoegen|^06/).first().click();
  L.check(await m.getByLabel('E-mailadres').count() === 0, 'e-mailadres niet wijzigbaar in de app');
  await m.getByRole('button', { name: 'Opslaan' }).click(); await m.waitForTimeout(800);
  const r = await m.evaluate(async () => (await BP.supabase.auth.updateUser({ email: 'kaping@beautypass-test.nl' })).error?.message || 'gelukt');
  L.check(r !== 'gelukt', 'ook via de API geblokkeerd: ' + r);
  L.check(L.sql(`select count(*) from auth.users where email_change='kaping@beautypass-test.nl'`) === '0', 'geen wijzigingsverzoek opgeslagen');
  const d = await L.page(b, L.D);
  await d.goto(L.APP + '/member/', { waitUntil: 'networkidle' });
  await L.pwMode(d); await d.getByLabel('E-mailadres').fill(email); await d.getByLabel('Wachtwoord').fill('Geheim-1234');
  await d.getByRole('button', { name: 'Inloggen', exact: true }).click(); await d.waitForTimeout(1500);
  await d.locator('header').getByText('Profiel', { exact: true }).click(); await d.waitForTimeout(600);
  L.check(await d.locator(`input[value="${email}"]`).count() === 0, 'desktop: e-mailadres alleen-lezen');
  L.check(m.errs.filter((e) => !/500/.test(e)).length === 0, 'geen fouten (behalve de bewust geweigerde wijziging) ' + m.errs.join('|'));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
