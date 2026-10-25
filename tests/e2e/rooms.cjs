// Beheer → Instellingen → Ruimtes: rename, add, switch off; member profile edit on the phone
const L = require('./lib.cjs');
async function login(p, path, email, pw) {
  await p.goto(L.APP + path, { waitUntil: 'networkidle' });
  await L.pwMode(p); await p.getByLabel('E-mailadres').fill(email); await p.getByLabel('Wachtwoord').fill(pw);
  await p.getByRole('button', { name: 'Inloggen', exact: true }).click(); await p.waitForTimeout(1500);
}
(async () => {
  const b = await L.chromium.launch();
  const a = await L.page(b, L.D); await login(a, '/beheer/', 'owner@beautypass-test.nl', 'Team-12345');
  await a.getByText('Instellingen', { exact: true }).locator('visible=true').first().click(); await a.waitForTimeout(500);
  const first = a.locator('input[value="Solo 1"]');
  await first.fill('Behandelkamer 1'); await a.waitForTimeout(1500);
  L.check(L.sql("select count(*) from rooms where name='Behandelkamer 1'") === '1', 'ruimte hernoemd');
  await a.getByRole('button', { name: 'Ruimte' }).click(); await a.waitForTimeout(1200);
  L.check(L.sql("select count(*) from rooms where name like 'Nieuwe ruimte%'") === '1', 'ruimte toegevoegd');
  await a.getByText('Agenda', { exact: true }).locator('visible=true').first().click(); await a.waitForTimeout(600);
  L.check(await a.getByText('Behandelkamer 1').count() > 0, 'nieuwe naam in de agenda');
  L.sql("update rooms set name='Solo 1' where name='Behandelkamer 1'; delete from rooms where name like 'Nieuwe ruimte%'");
  const desk = await L.page(b, L.D); await login(desk, '/beheer/', 'desk@beautypass-test.nl', 'Team-12345');
  const r = await desk.evaluate(async () => (await BP.supabase.from('rooms').update({ name: 'x' }).eq('id', BP.get().rooms[0].id).select()).data.length);
  L.check(r === 0, 'receptie kan ruimtes niet wijzigen');
  const email = L.sql("select m.email from members m join auth.users u on u.id=m.user_id where m.status='actief' order by m.created_at desc limit 1");
  const m = await L.page(b, L.M); await login(m, '/member/', email, 'Geheim-1234');
  await m.getByText('Profiel', { exact: true }).last().click(); await m.waitForTimeout(500);
  await m.getByText(/Telefoonnummer toevoegen|^06/).first().click();
  await m.getByLabel('Telefoon').fill('0611122233'); await m.getByRole('button', { name: 'Opslaan' }).click(); await m.waitForTimeout(1500);
  L.check(L.sql(`select phone from members where email='${email}'`) === '0611122233', 'telefoon gewijzigd op mobiel');
  const mb = await L.page(b, { viewport: { width: 390, height: 844 } }); await login(mb, '/beheer/', 'owner@beautypass-test.nl', 'Team-12345');
  await mb.getByText('Meer', { exact: true }).click(); await mb.getByText('Instellingen', { exact: true }).locator('visible=true').first().click(); await mb.waitForTimeout(600);
  L.check(await mb.getByText('Openingstijden', { exact: true }).count() === 1, 'mobiel: Meer → Instellingen werkt');
  for (const x of [a, desk, m, mb]) if (x.errs.length) console.log('  errs', x.errs.slice(0, 2));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
