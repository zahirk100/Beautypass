// Full onboarding: account + code, routine, plan, Mollie checkout (paid or failed), welcome
const L = require('./lib.cjs');
async function onboard(b, { email, name, opts, outcome = 'paid', shot }) {
  const p = await L.page(b, opts);
  await p.goto(L.APP + '/onboarding', { waitUntil: 'networkidle' });
  if (await p.getByText('Word member', { exact: true }).count()) await p.getByText('Word member', { exact: true }).first().click();
  await p.getByLabel('Volledige naam').fill(name);
  await p.getByLabel('E-mailadres').fill(email);
  await p.getByLabel('Telefoon').fill('0612345678');
  await p.getByLabel('Wachtwoord').fill('Geheim-1234');
  const t0 = Date.now() - 2000;
  await p.getByRole('button', { name: 'Volgende' }).click();
  const code = await L.otp(email, t0);
  await p.getByLabel('Code').fill(code);
  await p.getByRole('button', { name: 'Bevestigen' }).click();
  await p.getByText('Stel je').waitFor();
  await p.getByText('Gellak handen', { exact: true }).click().catch(async () => { await p.locator('text=/gel/i').first().click(); });
  await p.getByRole('button', { name: /Verder met/ }).click();
  await p.getByRole('button', { name: /^Kies / }).click();
  if (shot) await p.screenshot({ path: `tests/e2e/shots/${shot}_pay.png` });
  if (L.demo) L.check(await p.getByText('Testmodus · er wordt niet echt betaald').count() === 1, 'betaalscherm meldt testmodus');
  await p.getByRole('button', { name: /Betaal & machtig/ }).click();
  await p.waitForURL(/checkout/);
  await p.click('#' + outcome);
  await p.waitForURL(/betaald=1/);
  if (outcome === 'paid') await p.getByText(/you're in|welkom/i).first().waitFor({ timeout: 30000 });
  else await p.waitForTimeout(2500);
  if (shot) await p.screenshot({ path: `tests/e2e/shots/${shot}_done.png` });
  return p;
}
module.exports = { onboard };
if (require.main === module) (async () => {
  const b = await L.chromium.launch();
  const stamp = Date.now();
  for (const [tag, opts] of [['m', L.M], ['d', L.D]]) {
    const email = `e2e.${tag}.${stamp}@beautypass-test.nl`;
    console.log('onboarding', tag, email);
    const p = await onboard(b, { email, name: 'Test ' + tag.toUpperCase(), opts, shot: 'onb_' + tag });
    L.check(L.sql(`select status from members where email='${email}'`) === 'actief', 'member is actief');
    L.check(L.sql(`select count(*) from payments p join members m on m.id=p.member_id where m.email='${email}' and p.status='betaald' and p.invoice_no like 'BP-%'`) === '1', 'eerste betaling betaald met factuurnummer');
    L.check(L.sql(`select mollie_subscription_id is not null and mandate_id is not null from members where email='${email}'`) === 't', 'subscription + mandaat vastgelegd');
    const mails = await (await fetch(L.MOCK + '/mock/mails')).json();
    L.check(mails.some((x) => x.to[0].email === email && /Welkom/.test(x.subject)), 'welkomstmail verstuurd');
    L.check(!p.errs.length, 'geen JS-fouten ' + (p.errs.join(' | ')));
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
