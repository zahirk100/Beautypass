// Screenshots of every screen: member (desktop + phone), Beheer (desktop + phone), onboarding (both)
const L = require('./lib.cjs');
const OUT = 'tests/e2e/shots/';
async function login(p, path, email, pw) {
  await p.goto(L.APP + path, { waitUntil: 'networkidle' });
  await p.getByLabel('E-mailadres').fill(email); await p.getByLabel('Wachtwoord').fill(pw);
  await p.getByRole('button', { name: 'Inloggen', exact: true }).click(); await p.waitForTimeout(1800);
}
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
(async () => {
  const b = await L.chromium.launch();
  const email = L.sql("select m.email from members m join auth.users u on u.id=m.user_id where m.status='actief' order by m.created_at desc limit 1");
  console.log('member', email);
  const w = await L.page(b, L.D); await login(w, '/member/', email, 'Geheim-1234');
  for (const pg of ['Home', 'Plannen', 'Afspraken', 'Membership', 'Profiel']) {
    await w.locator('header').getByText(pg, { exact: true }).first().click(); await w.waitForTimeout(700);
    await w.screenshot({ path: `${OUT}sw_w_${pg}.png`, fullPage: true });
    const o = await overflow(w); if (o > 0) console.log('  ✗ horizontale scroll member desktop', pg, o);
  }
  const m = await L.page(b, L.M); await login(m, '/member/', email, 'Geheim-1234');
  for (const tab of ['Home', 'Afspraken', 'Membership', 'Profiel', 'Plannen']) {
    await m.getByText(tab, { exact: true }).last().click(); await m.waitForTimeout(700);
    await m.screenshot({ path: `${OUT}sw_m_${tab}.png` });
    const o = await overflow(m); if (o > 0) console.log('  ✗ horizontale scroll member mobiel', tab, o);
  }
  for (const [tag, opts] of [['d', L.D], ['m', L.M]]) {
    const a = await L.page(b, opts); await login(a, '/beheer/', 'owner@beautypass-test.nl', 'Team-12345');
    for (const pg of ['dash', 'agenda', 'members', 'plans', 'team', 'waitlist', 'settings']) {
      await a.evaluate((x) => localStorage.setItem('bp-admin-page', x), pg); await a.reload({ waitUntil: 'networkidle' }); await a.waitForTimeout(800);
      await a.screenshot({ path: `${OUT}sw_a${tag}_${pg}.png`, fullPage: true });
      const o = await overflow(a); if (o > 0) console.log('  ✗ horizontale scroll beheer', tag, pg, o);
    }
    await a.evaluate(() => localStorage.setItem('bp-admin-page', 'members')); await a.reload({ waitUntil: 'networkidle' }); await a.waitForTimeout(600);
    await a.getByText(email).first().click(); await a.waitForTimeout(600);
    await a.screenshot({ path: `${OUT}sw_a${tag}_memberdrawer.png` });
    console.log('beheer', tag, 'errs', a.errs);
  }
  const o1 = await L.page(b, L.M); await o1.goto(L.APP + '/onboarding', { waitUntil: 'networkidle' }); await o1.screenshot({ path: `${OUT}sw_onb_m.png` });
  const o2 = await L.page(b, L.D); await o2.goto(L.APP + '/onboarding', { waitUntil: 'networkidle' }); await o2.screenshot({ path: `${OUT}sw_onb_d.png` });
  const t = await L.page(b, { viewport: { width: 820, height: 1180 } }); await login(t, '/member/', email, 'Geheim-1234'); await t.screenshot({ path: `${OUT}sw_tablet_member.png` });
  console.log('member errs', w.errs, m.errs, t.errs);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
