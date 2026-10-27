const L = require('./lib.cjs');
async function login(p, path, email, pw) {
  await p.goto(L.APP + path, { waitUntil: 'networkidle' });
  await L.pwMode(p); await p.getByLabel('E-mailadres').fill(email); await p.getByLabel('Wachtwoord').fill(pw);
  await p.getByRole('button', { name: 'Inloggen', exact: true }).click();
  await p.waitForTimeout(1500);
}
const mails = async () => (await fetch(L.MOCK + '/mock/mails')).json();
(async () => {
  const b = await L.chromium.launch();
  L.sql('update settings set allow_extras=true');   // this test covers paying for treatments outside the membership
  const email = `e2e.f.${Date.now()}@beautypass-test.nl`;
  const p = await require('./onboard.cjs').onboard(b, { email, name: 'Flow Tester', opts: L.M });
  await p.getByText('Later plannen', { exact: true }).click();   // to the member app home
  await p.waitForTimeout(1500);
  console.log('0. boeken (inbegrepen)');
  await p.getByText('Plannen', { exact: true }).last().click(); await p.waitForTimeout(600);   // no routine yet: book from the list
  await p.getByText('Gellak manicure', { exact: true }).locator('visible=true').first().click();
  await p.waitForTimeout(1200);
  { const free = p.locator('div[style*="cursor: pointer"]', { hasText: /^\d\d:\d\d$/ }); const t = await free.first().innerText(); await free.first().click();
    await p.getByRole('button', { name: new RegExp(t) }).click(); await p.getByRole('button', { name: 'Bevestig afspraak' }).click(); await p.getByText('see you soon.').waitFor();
    await p.getByRole('button', { name: 'Naar mijn afspraken' }).click(); }

  console.log('1. annuleren door member');
  await p.locator('text=Gellak manicure').first().click();
  await p.getByRole('button', { name: 'Annuleren' }).click();
  await p.getByRole('button', { name: 'Ja, annuleren' }).click();
  await p.waitForTimeout(2000);
  L.check(L.sql(`select count(*) from appointments a join members m on m.id=a.member_id where m.email='${email}' and a.status='geannuleerd' and a.cancel_reason='lid'`) >= '1', 'afspraak geannuleerd (reden lid)');
  L.check((await mails()).some((x) => x.to[0].email === email && /^Geannuleerd/.test(x.subject)), 'annuleringsmail');

  console.log('2. losse behandeling (niet in Essential) met betaling');
  await p.getByText('Plannen', { exact: true }).last().click();
  await p.getByText('Pedicure', { exact: true }).locator('visible=true').first().click();
  await p.waitForTimeout(800);
  await p.locator('div[style*="width: 54px"]').nth(3).click();   // a few days ahead, so cancelling is on time
  await p.waitForTimeout(1200);
  const free = p.locator('div[style*="cursor: pointer"]', { hasText: /^\d\d:\d\d$/ });
  const time = await free.nth(2).innerText(); await free.nth(2).click();
  await p.getByRole('button', { name: new RegExp(time) }).click();
  await p.getByRole('button', { name: /Betaal .* via Mollie/ }).click();
  await p.waitForURL(/checkout/);
  L.check(L.sql(`select confirmed::text||(hold_until is not null)::text from appointments a join members m on m.id=a.member_id where m.email='${email}' and a.status='gepland' and a.paid_amount>0`) === 'falsetrue', 'tijdslot vastgehouden, nog niet bevestigd');
  await p.click('#paid'); await p.waitForURL(/betaald=1/); await p.waitForTimeout(2500);
  L.check(L.sql(`select confirmed from appointments a join members m on m.id=a.member_id where m.email='${email}' and a.status='gepland' and a.paid_amount>0`) === 't', 'na betaling bevestigd');
  L.check((await mails()).some((x) => x.to[0].email === email && /^Bevestigd: Pedicure/.test(x.subject)), 'bevestigingsmail pas na betaling');
  await p.screenshot({ path: 'tests/e2e/shots/flow_paid_return.png' });

  console.log('3. betaalde afspraak op tijd annuleren → terugbetaling');
  await p.locator('text=Pedicure').first().click();
  await p.getByRole('button', { name: 'Annuleren' }).click();
  await p.getByRole('button', { name: 'Ja, annuleren' }).click();
  await p.waitForTimeout(2500);
  L.check(L.sql(`select p.status from payments p join members m on m.id=p.member_id where m.email='${email}' and kind='los'`) === 'terugbetaald', 'betaling terugbetaald');
  const refunds = L.demo ? Number(L.sql("select count(*) from demo_mollie where data->>'resource'='refund'")) : Object.keys((await (await fetch(L.MOCK + '/mock/state')).json()).refunds).length;
  L.check(refunds >= 1, 'refund bij Mollie aangemaakt');

  console.log('4. factuur openen');
  await p.getByText('Membership', { exact: true }).last().click();
  await p.waitForTimeout(800);
  await p.getByText('Betalingen & facturen').click();
  await p.waitForTimeout(800);
  await p.screenshot({ path: 'tests/e2e/shots/flow_payments.png' });
  const [inv] = await Promise.all([p.context().waitForEvent('page'), p.locator('text=/eerste maand/i').last().click()]);
  await inv.waitForTimeout(1500);
  L.check(/Factuur/.test(await inv.content()) && /BP-\d{6}-\d{4}/.test(await inv.content()), 'factuur toont nummer');

  console.log('5. mislukte maandincasso → "betaling mislukt" in Beheer');
  const sub = L.sql(`select mollie_subscription_id from members where email='${email}'`);
  const mid = L.sql(`select id from members where email='${email}'`);
  const adm = await L.page(b, L.D);
  await login(adm, '/beheer/', 'owner@beautypass-test.nl', 'Team-12345');
  const charge = (status) => L.demo ? adm.evaluate(([id, st]) => BP.act.demoCharge(id, st), [mid, status]) : fetch(`${L.MOCK}/mock/charge/${sub}?status=${status}`, { method: 'POST' });
  await charge('failed');
  await L.sleep(2500);
  L.check(L.sql(`select status from members where email='${email}'`) === 'betaling mislukt', 'member status betaling mislukt');
  L.check((await mails()).some((x) => x.to[0].email === email && /niet gelukt/.test(x.subject)), 'mail betaling mislukt');
  await adm.reload({ waitUntil: 'networkidle' });
  await adm.getByText('Members', { exact: true }).locator('visible=true').first().click();
  await adm.waitForTimeout(800);
  L.check(await adm.getByText('betaling mislukt').count() > 0, 'Beheer toont "betaling mislukt"');
  await adm.screenshot({ path: 'tests/e2e/shots/flow_beheer_failed.png' });
  // geslaagde nieuwe incasso herstelt
  await charge('paid');
  await L.sleep(2500);
  L.check(L.sql(`select status from members where email='${email}'`) === 'actief', 'na geslaagde incasso weer actief');

  console.log('6. rollen');
  const desk = await L.page(b, L.D);
  await login(desk, '/beheer/', 'desk@beautypass-test.nl', 'Team-12345');
  const nav = await desk.locator('nav, aside').first().innerText().catch(() => desk.locator('body').innerText());
  L.check(!/Instellingen/.test(nav) && !/Memberships/.test(nav) && /Agenda/.test(nav), 'Receptie ziet geen Instellingen/Financiën: ' + nav.replace(/\s+/g, ' ').slice(0, 120));
  const r = await desk.evaluate(async () => { const { data, error } = await BP.supabase.from('payments').select('id'); return [data && data.length, error && error.message]; });
  L.check(r[0] === 0 || r[1], 'Receptie kan geen betalingen lezen via de API: ' + JSON.stringify(r));
  const r2 = await desk.evaluate(async () => { const { error } = await BP.supabase.from('settings').update({ cancel_hours: 1 }).eq('id', 1); return error && error.message; });
  L.check(L.sql('select cancel_hours from settings') !== '1', 'Receptie kan instellingen niet wijzigen (' + r2 + ')');
  const mem = await L.page(b, L.D);
  await login(mem, '/beheer/', email, 'Geheim-1234');
  L.check(await mem.getByText('toegang.').count() > 0, 'member op /beheer → geen toegang');
  const spec = await L.page(b, L.D);
  await login(spec, '/beheer/', 'specialist@beautypass-test.nl', 'Team-12345');
  const sn = await spec.locator('body').innerText();
  L.check(!/Members\n|Instellingen/.test(sn), 'specialist ziet alleen agenda');
  const leak = await spec.evaluate(async () => (await BP.supabase.from('members').select('email')).data?.length ?? 0);
  L.check(leak === 0, 'specialist kan geen member-e-mails lezen');
  for (const x of [p, adm, desk, mem, spec]) if (x.errs.length) console.log('  errs:', x.errs.slice(0, 3));
  L.sql('update settings set allow_extras=false');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
