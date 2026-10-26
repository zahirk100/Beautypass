// Onboarding: routine → package → checkout without an account → Mollie → sign in with a code → welcome.
// Also: typo suggestion, already a member, failed payment and retry, team corrects the e-mail, cleanup.
const L = require('./lib.cjs');

// Routine + package + checkout form up to the Mollie page
async function toCheckout(p, { email, name, terms }) {
  await p.goto(L.APP + '/onboarding', { waitUntil: 'networkidle' });
  const start = p.getByText('Stel je routine samen', { exact: true }).locator('visible=true');
  if (await start.count()) await start.first().click();
  await p.getByText('Gellak manicure', { exact: true }).click();
  await p.getByText('Blowout', { exact: true }).click();
  await p.getByRole('button', { name: 'Bekijk je pakket' }).click();
  await p.getByText('Past het best bij jou').waitFor();
  await p.getByRole('button', { name: /^Verder met / }).click();
  await p.getByLabel('Volledige naam').fill(name);
  await p.getByLabel('E-mailadres').fill(email);
  await p.getByLabel('Telefoon (optioneel)').fill('0612345678');
  if (terms) await p.locator('input[type=checkbox]').check();
}
async function payAndSignIn(p, email, outcome = 'paid') {
  await p.getByRole('button', { name: /^Betaal / }).click();
  await p.waitForURL(/checkout/);
  const t0 = Date.now() - 2000;
  await p.click('#' + outcome);
  await p.waitForURL(/betaald=1/);
  if (outcome !== 'paid') { await p.getByText('gelukt.').waitFor({ timeout: 30000 }); return; }
  await p.getByLabel('Code uit je mail').waitFor({ timeout: 30000 });
  await p.getByLabel('Code uit je mail').fill(await L.otp(email, t0));
  await p.getByRole('button', { name: 'Account openen' }).click();
  await p.getByText(/you're in/i).first().waitFor({ timeout: 30000 });
}
async function onboard(b, { email, name, opts, shot }) {
  const p = await L.page(b, opts);
  await toCheckout(p, { email, name });
  if (shot) await p.screenshot({ path: `tests/e2e/shots/${shot}_pay.png` });
  await payAndSignIn(p, email);
  if (shot) await p.screenshot({ path: `tests/e2e/shots/${shot}_done.png` });
  // the other tests sign in with a password
  await p.evaluate(() => BP.auth.setPassword('Geheim-1234'));
  return p;
}
module.exports = { onboard, toCheckout, payAndSignIn };

if (require.main === module) (async () => {
  const b = await L.chromium.launch();
  const stamp = Date.now();
  for (const [tag, opts] of [['m', L.M], ['d', L.D]]) {
    const email = `e2e.${tag}.${stamp}@beautypass-test.nl`;
    console.log('onboarding', tag, email);
    const p = await L.page(b, opts);
    await toCheckout(p, { email, name: 'Test ' + tag.toUpperCase() });
    await p.screenshot({ path: `tests/e2e/shots/onb_${tag}_checkout.png` });
    if (L.demo) L.check(await p.getByText('Testmodus · er wordt niet echt betaald').count() === 1, 'betaalscherm meldt testmodus');
    L.check(L.sql(`select count(*) from members where email='${email}'`) === '0', 'nog geen account vóór het betalen');
    await payAndSignIn(p, email);
    await p.screenshot({ path: `tests/e2e/shots/onb_${tag}_done.png` });
    await p.evaluate(() => BP.auth.setPassword('Geheim-1234'));   // the other tests sign in with a password
    L.check(L.sql(`select status||' '||array_to_string(routine,',') from members where email='${email}'`) === 'actief gel,blow', 'member is actief met de routine');
    L.check(L.sql(`select count(*) from payments p join members m on m.id=p.member_id where m.email='${email}' and p.status='betaald' and p.invoice_no like 'BP-%'`) === '1', 'eerste betaling betaald met factuurnummer');
    L.check(L.sql(`select mollie_subscription_id is not null and mandate_id is not null from members where email='${email}'`) === 't', 'subscription + mandaat vastgelegd');
    const mails = await (await fetch(L.MOCK + '/mock/mails')).json();
    L.check(mails.some((x) => x.to[0].email === email && /Welkom/.test(x.subject)), 'welkomstmail verstuurd');
    await p.getByRole('button', { name: /Plan je eerste behandeling/ }).click(); await p.waitForURL(/member/); await p.waitForTimeout(1500);
    L.check(await p.getByText(/time for you/).count() > 0, 'direct in de member-app');
    L.check(!p.errs.filter((e) => !/400|401/.test(e)).length, 'geen JS-fouten ' + (p.errs.join(' | ')));
    if (tag === 'm') {
      console.log('al member met dit e-mailadres');
      const q = await L.page(b, opts); await toCheckout(q, { email, name: 'Nog Een' });
      await q.getByRole('button', { name: /^Betaal / }).click(); await q.waitForTimeout(1200);
      L.check(await q.getByText(/Je bent al member met dit e-mailadres/).count() === 1, 'melding "al member" met inloglink');
      L.check(L.sql(`select name from members where email='${email}'`) === 'Test M', 'bestaande member niet aangepast');
    }
  }

  console.log('typfout in het e-mailadres');
  const t = await L.page(b, L.M); await toCheckout(t, { email: 'iemand@gmial.com', name: 'Typ Fout' });
  L.check(await t.getByText('iemand@gmail.com').count() === 1, 'suggestie "Bedoel je iemand@gmail.com?"');
  await t.getByText('iemand@gmail.com').click();
  L.check(await t.getByLabel('E-mailadres').inputValue() === 'iemand@gmail.com', 'suggestie overgenomen');

  console.log('mislukte betaling → opnieuw');
  const e2 = `e2e.f.${stamp}@beautypass-test.nl`;
  const f = await L.page(b, L.D); await toCheckout(f, { email: e2, name: 'Faal Eerst' });
  await payAndSignIn(f, e2, 'failed');
  L.check(L.sql(`select status from members where email='${e2}'`) === 'nieuw', 'nog niet actief');
  await f.getByRole('button', { name: 'Opnieuw proberen' }).click(); await f.waitForTimeout(600);
  L.check(await f.getByLabel('E-mailadres').inputValue() === e2, 'gegevens staan nog klaar');
  await payAndSignIn(f, e2);
  L.check(L.sql(`select status from members where email='${e2}'`) === 'actief', 'tweede poging: actief');
  await f.evaluate(() => BP.auth.setPassword('Geheim-1234'));
  L.check(L.sql(`select count(*) from members where email='${e2}'`) === '1', 'geen dubbele member');

  console.log('team corrigeert een e-mailadres (nog nooit ingelogd)');
  const e3 = `e2e.typo.${stamp}@beautypass-test.nl`, e3b = `e2e.fixed.${stamp}@beautypass-test.nl`;
  const g = await L.page(b, L.M); await toCheckout(g, { email: e3, name: 'Typ Fout' });
  await g.getByRole('button', { name: /^Betaal / }).click(); await g.waitForURL(/checkout/); await g.click('#paid'); await g.waitForURL(/betaald=1/);
  await g.getByLabel('Code uit je mail').waitFor({ timeout: 30000 });
  const o = await L.page(b, L.D);
  await o.goto(L.APP + '/beheer/', { waitUntil: 'networkidle' });
  await o.getByLabel('E-mailadres').fill('owner@beautypass-test.nl'); await o.getByLabel('Wachtwoord').fill('Team-12345');
  await o.getByRole('button', { name: 'Inloggen', exact: true }).click(); await o.waitForTimeout(2000);
  const id3 = L.sql(`select id from members where email='${e3}'`);
  const r3 = await o.evaluate(([id, e]) => BP.act.memberEmail(id, e).then(() => 'ok', (x) => x.message), [id3, e3b]);
  L.check(r3 === 'ok' && L.sql(`select m.email = u.email and m.email='${e3b}' from members m join auth.users u on u.id=m.user_id where m.id='${id3}'`) === 't', 'e-mailadres gecorrigeerd (login en membership)');
  const t3 = Date.now() - 2000;
  await g.goto(L.APP + '/member/', { waitUntil: 'networkidle' });
  await g.getByLabel('E-mailadres').fill(e3b); await g.getByRole('button', { name: 'Stuur code' }).click();
  await g.getByLabel('Code uit je mail').fill(await L.otp(e3b, t3)); await g.getByRole('button', { name: 'Inloggen', exact: true }).click();
  await g.getByText(/time for you/).first().waitFor({ timeout: 20000 });
  L.check(true, 'member logt in met het gecorrigeerde adres');
  await g.evaluate(() => BP.auth.setPassword('Geheim-1234'));
  const r3b = await o.evaluate(([id]) => BP.act.memberEmail(id, 'nog.anders@beautypass-test.nl').then(() => 'ok', (x) => x.message), [id3]);
  L.check(/al eens ingelogd/.test(r3b), 'na de eerste login niet meer te wijzigen: ' + r3b);

  console.log('nooit betaald → na 3 dagen opgeruimd');
  const e4 = `e2e.stale.${stamp}@beautypass-test.nl`;
  const h = await L.page(b, L.M); await toCheckout(h, { email: e4, name: 'Nooit Betaald' });
  await h.getByRole('button', { name: /^Betaal / }).click(); await h.waitForURL(/checkout/);
  L.sql(`update members set created_at = now() - interval '4 days' where email='${e4}'`);
  await fetch(L.APP + '/api/cron-daily', { headers: { authorization: 'Bearer local-cron-secret' } });
  L.check(L.sql(`select count(*) from members where email='${e4}'`) === '0' && L.sql(`select count(*) from auth.users where email='${e4}'`) === '0', 'onbetaalde checkout en login verwijderd');

  console.log('alleen vanaf onze eigen site');
  const x = await (await fetch(L.APP + '/api/membership-checkout', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: '{}' })).json();
  L.check(x.ok === false, 'verzoek van een andere site geweigerd');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
