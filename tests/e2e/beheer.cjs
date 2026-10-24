const L = require('./lib.cjs');
async function login(p, path, email, pw) {
  await p.goto(L.APP + path, { waitUntil: 'networkidle' });
  await p.getByLabel('E-mailadres').fill(email); await p.getByLabel('Wachtwoord').fill(pw);
  await p.getByRole('button', { name: 'Inloggen', exact: true }).click(); await p.waitForTimeout(1500);
}
const mails = async () => (await fetch(L.MOCK + '/mock/mails')).json();
(async () => {
  const b = await L.chromium.launch();
  const email = L.sql("select email from members where status='actief' and email like 'e2e.d.%' order by created_at desc limit 1");
  const mid = L.sql(`select id from members where email='${email}'`);
  const name = L.sql(`select name from members where id='${mid}'`);
  // member app open to see team changes live
  const mem = await L.page(b, L.D); await login(mem, '/member/', email, 'Geheim-1234');
  await mem.evaluate(() => localStorage.setItem('bp-web-page', 'appts')); await mem.reload({ waitUntil: 'networkidle' });
  const a = await L.page(b, L.D); await login(a, '/beheer/', 'desk@beautypass-test.nl', 'Team-12345');
  console.log('1. receptie plant afspraak in');
  await a.getByText('Agenda', { exact: true }).first().click();
  await a.getByRole('button', { name: 'Afspraak' }).last().click();
  const drawer = a.locator('div[style*="position: fixed"]');
  const sel = drawer.locator('select');
  await sel.nth(0).selectOption(mid);
  await sel.nth(1).selectOption({ label: 'Blowout' });
  const tomorrow = L.sql("select ((now() at time zone 'Europe/Amsterdam')::date + 2)::text");
  await drawer.locator('input[type=date]').fill(tomorrow);
  await sel.nth(2).selectOption('14:00');
  await a.waitForTimeout(300);
  await a.screenshot({ path: 'tests/e2e/shots/bh_new.png' });
  await drawer.getByRole('button', { name: 'Inplannen' }).click();
  await a.waitForTimeout(2000);
  const ap = L.sql(`select id from appointments where member_id='${mid}' and status='gepland' and is_primary and (starts_at at time zone 'Europe/Amsterdam')::date='${tomorrow}'`);
  L.check(!!ap, 'afspraak in database');
  await mem.waitForTimeout(1500);
  L.check(/Blowout/.test(await mem.locator('body').innerText()), 'member ziet de afspraak live');
  L.check((await mails()).some((x) => x.to[0].email === email && /^Bevestigd: Blowout/.test(x.subject)), 'bevestigingsmail naar member');

  console.log('2. notitie + extra tegoed in member-drawer');
  await a.getByText('Members', { exact: true }).first().click();
  await a.getByText(email, { exact: true }).first().click();
  await a.waitForTimeout(500);
  await a.screenshot({ path: 'tests/e2e/shots/bh_member.png' });
  const ta = a.locator('div[style*="position: fixed"] textarea').first();
  if (await ta.count()) { await ta.fill('Houdt van oat latte'); await a.waitForTimeout(1500); }
  L.check(L.sql(`select coalesce((select body from member_team_notes where member_id='${mid}'),'')`) === 'Houdt van oat latte', 'teamnotitie opgeslagen');
  L.check(!/oat latte/.test(await mem.evaluate(async () => JSON.stringify((await BP.supabase.from('member_team_notes').select('*')).data || []))), 'member ziet de teamnotitie niet');

  console.log('3. team annuleert');
  await a.keyboard.press('Escape');
  await a.evaluate(() => localStorage.setItem('bp-admin-page', 'dash')); await a.reload({ waitUntil: 'networkidle' });
  const r = await a.evaluate((id) => BP.act.setApptStatus(id, 'geannuleerd').then(() => 'ok', (e) => e.message), ap);
  L.check(r === 'ok', 'status geannuleerd via Beheer');
  await L.sleep(1500);
  L.check((await mails()).some((x) => x.to[0].email === email && /^Geannuleerd: Blowout/.test(x.subject) && /Helaas moeten we/.test(x.html)), 'mail met salon-tekst');

  console.log('4. specialist ziet alleen eigen afspraken');
  const sp = await L.page(b, L.D); await login(sp, '/beheer/', 'specialist@beautypass-test.nl', 'Team-12345');
  const n = await sp.evaluate(() => { const s = BP.get(); const mine = s.team.find((t) => t.userId === s.session.user.id); return [s.appointments.length, s.appointments.filter((x) => x.staffId !== (mine && mine.id)).length, !!mine]; });
  L.check(n[2] && n[1] === 0, 'alleen eigen afspraken (' + n[0] + ' zichtbaar)');
  const r2 = await sp.evaluate((id) => BP.supabase.rpc('team_book_appointment', { p_member: id, p_treatment: 'blowout', p_date: '2030-01-01', p_time: '10:00' }).then((x) => x.error && x.error.message), mid);
  L.check(/rechten/.test(r2 || ''), 'specialist kan niet inplannen: ' + r2);
  console.log('5. team-drawer: naam wijzigen + login koppelen (eigenaar)');
  const o = await L.page(b, L.D); await login(o, '/beheer/', 'owner@beautypass-test.nl', 'Team-12345');
  await o.getByText('Team & roosters', { exact: true }).first().click();
  await o.getByText('Noor', { exact: true }).first().click();
  const inp = o.locator('div[style*="position: fixed"] input').first();
  await inp.fill('Noor de Vries'); await o.waitForTimeout(1200);
  L.check(L.sql("select count(*) from staff where name='Noor de Vries'") === '1', 'naam opgeslagen, focus bleef in het veld');
  for (const [k, x] of Object.entries({ mem, a, sp, o })) if (x.errs.length) console.log('  errs', k, x.errs.slice(0, 3));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
