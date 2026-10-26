// Routine in one visit: one button on Home, treatments ticked from the profile, at the same time where the
// zones allow it (six hands), within the monthly number or settled in the salon, one mail, cancel, reschedule
const L = require('./lib.cjs');
async function login(p, path, email, pw) {
  await p.goto(L.APP + path, { waitUntil: 'networkidle' });
  await L.pwMode(p); await p.getByLabel('E-mailadres').fill(email); await p.getByLabel('Wachtwoord').fill(pw);
  await p.getByRole('button', { name: 'Inloggen', exact: true }).click(); await p.waitForTimeout(1500);
}
const mails = async () => (await fetch(L.MOCK + '/mock/mails')).json();
(async () => {
  const b = await L.chromium.launch();
  const email = L.sql("select m.email from members m join auth.users u on u.id=m.user_id where m.status='actief' and m.cancel_at is null and u.encrypted_password <> '' order by m.created_at desc limit 1");
  const id = L.sql(`select id from members where email='${email}'`);
  const D = L.sql("select ((now() at time zone 'Europe/Amsterdam')::date + 5)::text");
  L.sql(`update appointments set status='geannuleerd', cancel_reason='team' where status='gepland' and (member_id='${id}' or (starts_at at time zone 'Europe/Amsterdam')::date='${D}')`);
  L.sql(`update members set routine='{gel,browlam,blow}', prefs = prefs - 'specialist' || '{"kids":false}' where id='${id}'; update settings set parallel_enabled=true, closed_dates='{}'; delete from staff_absence`);

  for (const [tag, opts] of [['m', L.M], ['d', L.D]]) {
    console.log(tag + ': routine plannen');
    const p = await L.page(b, opts); await login(p, '/member/', email, 'Geheim-1234');
    if (tag === 'd') { await p.getByText('Home', { exact: true }).first().click(); await p.waitForTimeout(500); }
    await p.getByText('Plan je routine', { exact: true }).first().click(); await p.waitForTimeout(800);
    L.check(await p.getByText('Gellak manicure', { exact: true }).count() > 0 && await p.getByText('Brow lamination', { exact: true }).count() > 0, 'routine uit het profiel staat klaar');
    await p.getByText(new Date(D + 'T12:00:00').getDate().toString(), { exact: true }).first().click(); await p.waitForTimeout(1500);
    await p.getByText('13:00', { exact: true }).first().click(); await p.waitForTimeout(500);
    L.check(await p.getByText(/Tegelijk · 2 specialisten/).count() === 1, 'gellak en brow lamination tegelijk');
    await p.screenshot({ path: `tests/e2e/shots/visit_${tag}_plan.png` });   // no fullPage here: it resizes the window
    const t0 = Date.now();
    await p.getByRole('button', { name: /^Bevestig/ }).click(); await p.getByText('see you soon.').waitFor();
    const rows = L.sql(`select string_agg(treatment_id||'@'||to_char(starts_at at time zone 'Europe/Amsterdam','HH24:MI')||'/'||room_id, ' ' order by starts_at, treatment_id) from appointments where member_id='${id}' and status='gepland' and visit_id is not null`);
    L.check(/browlam@13:00\/(duo|six) gel@13:00\/(duo|six) blow@14:00\/(duo|six)/.test(rows), 'drie afspraken in één bezoek, samen in één suite: ' + rows);
    await L.sleep(2000);
    const sent = (await mails()).filter((x) => x.to[0].email === email && new Date(x.at).getTime() > t0);
    L.check(sent.length === 1 && /routine \(3 behandelingen\)/.test(sent[0].subject) && /Gellak/.test(sent[0].html) && /Blowout/.test(sent[0].html), 'één bevestigingsmail met alle behandelingen: ' + sent.map((x) => x.subject).join(' | '));
    await p.getByText(/Naar mijn afspraken/).click(); await p.waitForTimeout(800);
    L.check(await p.getByText(/^Je routine/).count() >= 1, 'afspraken tonen het bezoek als één geheel');
    await p.screenshot({ path: `tests/e2e/shots/visit_${tag}_appts.png`, fullPage: true });
    const vid = L.sql(`select visit_id from appointments where member_id='${id}' and status='gepland' and visit_id is not null limit 1`);
    if (tag === 'm') {
      console.log('m: verzetten en één onderdeel annuleren');
      await p.getByText('Je routine', { exact: true }).first().click(); await p.waitForTimeout(500);
      await p.getByRole('button', { name: 'Verzetten' }).click(); await p.waitForTimeout(1500);
      await p.getByText('15:00', { exact: true }).first().click(); await p.waitForTimeout(400);
      await p.getByRole('button', { name: /^Bevestig/ }).click(); await p.getByText('see you soon.').waitFor();
      L.check(L.sql(`select count(*) from appointments where visit_id='${vid}' and status='geannuleerd' and cancel_reason='verzet'`) === '3', 'oud bezoek vrijgegeven');
      L.check(L.sql(`select string_agg(to_char(starts_at at time zone 'Europe/Amsterdam','HH24:MI'), ',' order by starts_at) from appointments where member_id='${id}' and status='gepland' and visit_id is not null`) === '15:00,15:00,16:00', 'nieuw bezoek om 15:00');
      const v2 = L.sql(`select visit_id from appointments where member_id='${id}' and status='gepland' and visit_id is not null limit 1`);
      await p.getByText(/Naar mijn afspraken/).click(); await p.waitForTimeout(600);
      await p.getByText('Je routine', { exact: true }).first().click(); await p.waitForTimeout(500);
      await p.getByText('Alleen deze annuleren').last().click(); await p.waitForTimeout(1200);
      L.check(L.sql(`select count(*) from appointments where visit_id='${v2}' and status='gepland'`) === '2', 'één behandeling uit het bezoek gehaald');
      await p.getByRole('button', { name: 'Hele bezoek annuleren' }).click(); await p.getByRole('button', { name: 'Ja, annuleren' }).click(); await p.waitForTimeout(1500);
      L.check(L.sql(`select count(*) from appointments where visit_id='${v2}' and status='gepland'`) === '0', 'hele bezoek geannuleerd');
    } else {
      console.log('d: Beheer ziet het bezoek, inchecken voor alles tegelijk');
      const o = await L.page(b, L.D); await login(o, '/beheer/', 'owner@beautypass-test.nl', 'Team-12345');
      const one = L.sql(`select id from appointments where visit_id='${vid}' order by starts_at desc limit 1`);
      await o.evaluate((x) => { localStorage.setItem('bp-admin-page', 'agenda'); }, null);
      L.check(await o.evaluate((x) => BP.get().appointments.filter((a) => a.visitId === x).length, vid) === 3, 'Beheer heeft alle drie de onderdelen');
      await p.getByRole('button', { name: 'Annuleren' }).first().click(); await p.getByRole('button', { name: 'Ja, annuleren' }).click(); await p.waitForTimeout(1500);
      L.check(L.sql(`select count(*) from appointments where visit_id='${vid}' and status='gepland'`) === '0', 'desktop: hele bezoek geannuleerd');
      await L.sleep(1500);
      const c = (await mails()).filter((x) => x.to[0].email === email && /^Geannuleerd: je routine/.test(x.subject) && new Date(x.at).getTime() > t0);
      L.check(c.length === 1, 'één annuleringsmail voor het hele bezoek');
      void one;
    }
    L.check(!p.errs.filter((e) => !/400|401/.test(e)).length, tag + ': geen JS-fouten ' + p.errs.join(' | '));
  }

  console.log('tegelijk uit: alles na elkaar');
  L.sql('update settings set parallel_enabled=false');
  const seq = L.sql(`select plan->>'parallel' || ' ' || (plan->>'minutes') from visit_slots(array['gel','browlam','blow'], '${D}') where slot='13:00'`.replace('visit_slots', 'public.visit_slots'));
  L.check(seq === '' || seq.startsWith('false'), 'na elkaar: ' + seq);
  L.sql('update settings set parallel_enabled=true');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
