// Desktop onboarding layout, and an unpaid sign-up that continues at the payment step (also via /member)
const L = require('./lib.cjs');
(async () => {
  const b = await L.chromium.launch();
  for (const [tag, opts] of [['d', L.D], ['m', L.M]]) {
    const email = `e2e.r${tag}.${Date.now()}@beautypass-test.nl`;
    const p = await L.page(b, opts);
    await p.goto(L.APP + '/onboarding', { waitUntil: 'networkidle' });
    await p.screenshot({ path: `tests/e2e/shots/res_${tag}_1.png` });
    if (tag === 'm') await p.getByText('Word member', { exact: true }).locator('visible=true').first().click();
    L.check(await p.getByLabel('Volledige naam').count() === 1, tag + ': formulier zichtbaar');
    await p.getByLabel('Volledige naam').fill('Resume Test'); await p.getByLabel('E-mailadres').fill(email); await p.getByLabel('Wachtwoord').fill('Geheim-1234');
    const t0 = Date.now() - 2000;
    await p.getByRole('button', { name: 'Volgende' }).click();
    await p.getByLabel('Code').fill(await L.otp(email, t0)); await p.getByRole('button', { name: 'Bevestigen' }).click();
    await p.getByText('Stel je').waitFor();
    await p.getByText('Blowout', { exact: true }).click();
    await p.screenshot({ path: `tests/e2e/shots/res_${tag}_2.png` });
    await p.getByRole('button', { name: /Verder met/ }).click(); await p.getByRole('button', { name: /^Kies / }).click();
    await p.screenshot({ path: `tests/e2e/shots/res_${tag}_4.png` });
    await p.getByRole('button', { name: /Betaal & machtig/ }).click();
    await p.waitForURL(/checkout/); await p.click('#failed'); await p.waitForURL(/betaald=1/);
    await p.getByRole('button', { name: 'Opnieuw betalen' }).waitFor({ timeout: 90000 });
    // later: go to /member → back to onboarding at the payment step, routine kept
    await p.goto(L.APP + '/member/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    L.check(/\/onboarding/.test(p.url()), tag + ': /member stuurt onbetaald account naar onboarding');
    L.check(await p.getByRole('button', { name: /Betaal & machtig/ }).count() === 1, tag + ': direct bij de betaalstap');
    L.check(/Essential/.test(await p.locator('body').innerText()), tag + ': gekozen membership behouden');
    if (tag === 'd') { L.check(await p.getByText('Uitloggen').count() === 1, 'd: uitloggen zichtbaar i.p.v. inloggen'); }
    await p.getByRole('button', { name: /Betaal & machtig/ }).click();
    await p.waitForURL(/checkout/); await p.click('#paid'); await p.waitForURL(/betaald=1/);
    await p.getByText(/you're in/i).first().waitFor({ timeout: 30000 });
    L.check(L.sql(`select status from members where email='${email}'`) === 'actief', tag + ': na tweede poging actief');
    await p.screenshot({ path: `tests/e2e/shots/res_${tag}_5.png` });
    L.check(!p.errs.filter((e) => !/400|401/.test(e)).length, tag + ': geen JS-fouten ' + p.errs.join(' | '));
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
