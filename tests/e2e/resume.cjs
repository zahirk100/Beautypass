// An account whose payment failed, signing in later (code via /member): back at checkout with the choices kept
const L = require('./lib.cjs');
const O = require('./onboard.cjs');
(async () => {
  const b = await L.chromium.launch();
  for (const [tag, opts] of [['d', L.D], ['m', L.M]]) {
    const email = `e2e.r${tag}.${Date.now()}@beautypass-test.nl`;
    const p = await L.page(b, opts);
    await O.toCheckout(p, { email, name: 'Resume Test' });
    await O.payAndSignIn(p, email, 'failed');
    // another day, another browser: sign in with a code at /member
    const q = await L.page(b, opts);
    await q.goto(L.APP + '/member/', { waitUntil: 'networkidle' });
    const t0 = Date.now() - 2000;
    await q.getByLabel('E-mailadres').fill(email); await q.getByRole('button', { name: 'Stuur code' }).click();
    await q.getByLabel('Code uit je mail').fill(await L.otp(email, t0)); await q.getByRole('button', { name: 'Inloggen', exact: true }).click();
    await q.waitForURL(/onboarding/); await q.waitForTimeout(1500);
    L.check(await q.getByRole('button', { name: /^Betaal / }).count() === 1, tag + ': /member stuurt naar de betaalstap');
    L.check(/Signature|Essential|The Edit/.test(await q.locator('body').innerText()) && await q.getByText(/in je routine/).count() === 1, tag + ': membership en routine behouden');
    if (tag === 'd') L.check(await q.getByText('Uitloggen').count() === 1, 'd: uitloggen zichtbaar i.p.v. inloggen');
    await q.getByRole('button', { name: /^Betaal / }).click();
    await q.waitForURL(/checkout/); await q.click('#paid'); await q.waitForURL(/betaald=1/);
    await q.getByText(/you're in/i).first().waitFor({ timeout: 30000 });
    L.check(L.sql(`select status from members where email='${email}'`) === 'actief', tag + ': na tweede poging actief');
    await q.screenshot({ path: `tests/e2e/shots/res_${tag}_5.png` });
    L.check(!q.errs.filter((e) => !/400|401/.test(e)).length, tag + ': geen JS-fouten ' + q.errs.join(' | '));
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
