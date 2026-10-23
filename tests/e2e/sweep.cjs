const L = require('./lib.cjs');
async function login(p, path, email, pw) {
  await p.goto(L.APP + path, { waitUntil: 'networkidle' });
  await p.getByLabel('E-mailadres').fill(email); await p.getByLabel('Wachtwoord').fill(pw);
  await p.getByRole('button', { name: 'Inloggen', exact: true }).click(); await p.waitForTimeout(1500);
}
(async () => {
  const b = await L.chromium.launch();
  const email = L.sql("select email from members where status='actief' order by created_at desc limit 1");
  console.log('member', email);
  // member desktop (web view)
  const w = await L.page(b, L.D); await login(w, '/member/', email, 'Geheim-1234');
  for (const pg of ['home', 'book', 'appts', 'membership', 'profile']) {
    await w.evaluate((x) => localStorage.setItem('bp-web-page', x), pg); await w.reload({ waitUntil: 'networkidle' }); await w.waitForTimeout(700);
    await w.screenshot({ path: `tests/e2e/shots/sw_w_${pg}.png`, fullPage: true });
  }
  // member mobile tabs
  const m = await L.page(b, L.M); await login(m, '/member/', email, 'Geheim-1234');
  for (const tab of ['Home', 'Afspraken', 'Membership', 'Profiel']) { await m.getByText(tab, { exact: true }).last().click(); await m.waitForTimeout(600); await m.screenshot({ path: `tests/e2e/shots/sw_m_${tab}.png` }); }
  // beheer owner desktop + mobile
  for (const [tag, opts] of [['d', L.D], ['m', L.M]]) {
    const a = await L.page(b, opts); await login(a, '/beheer/', 'owner@beautypass-test.nl', 'Team-12345');
    for (const pg of ['dash', 'agenda', 'members', 'plans', 'team', 'waitlist', 'settings']) {
      await a.evaluate((x) => localStorage.setItem('bp-admin-page', x), pg); await a.reload({ waitUntil: 'networkidle' }); await a.waitForTimeout(700);
      await a.screenshot({ path: `tests/e2e/shots/sw_a${tag}_${pg}.png`, fullPage: tag === 'd' });
    }
    console.log('beheer', tag, 'errs', a.errs);
  }
  console.log('member errs', w.errs, m.errs);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
