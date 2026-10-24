// Check-in: hand scanner / typed code, camera scan (fake camera showing the member's QR), arrive, complete,
// usage count, unknown code, specialist sees only own; the member sees the completed treatment
const L = require('./lib.cjs');
const { execFileSync } = require('child_process');
const OUT = 'tests/e2e/shots/';
async function login(p, path, email, pw) {
  await p.goto(L.APP + path, { waitUntil: 'networkidle' });
  await p.getByLabel('E-mailadres').fill(email); await p.getByLabel('Wachtwoord').fill(pw);
  await p.getByRole('button', { name: 'Inloggen', exact: true }).click(); await p.waitForTimeout(1500);
}
const nav = (p, label) => p.getByText(label, { exact: true }).locator('visible=true').first().click();
(async () => {
  const email = L.sql("select m.email from members m join auth.users u on u.id=m.user_id where m.status='actief' order by m.created_at desc limit 1");
  const mid = L.sql(`select id from members where email='${email}'`);
  const code = L.sql(`select checkin_code from members where id='${mid}'`);
  // An appointment today (at least an hour from now, salon rule) with Sanne, who has the specialist login
  L.sql(`update appointments set status='geannuleerd', cancel_reason='team' where member_id='${mid}' and status='gepland'`);
  const slots = L.sql(`select string_agg(t, ' ' order by t) from settings, unnest(slot_times) t where local_ts((now() at time zone 'Europe/Amsterdam')::date, t) > now() + interval '70 minutes'`).split(' ').filter(Boolean);
  const staff = L.sql("select s.id from staff s join auth.users u on u.id=s.user_id where u.email='specialist@beautypass-test.nl'");
  let placed = false;
  for (const slot of slots) { try { L.sql(`select place_appointment('${mid}', 'blow', (now() at time zone 'Europe/Amsterdam')::date, '${slot}', '${staff}', null, '', 0, true, null, null)`); placed = true; break; } catch (e) { /* taken: next */ } }
  if (!placed) { console.log('  (geen vrij moment meer vandaag: test overgeslagen)'); return; }
  const used0 = Number(L.sql(`select used_in_month('${mid}', (now() at time zone 'Europe/Amsterdam')::date)`));

  // 1. The member's QR from the app becomes the picture of a fake camera
  const b0 = await L.chromium.launch();
  const mp = await L.page(b0, L.M); await login(mp, '/member/', email, 'Geheim-1234');
  await mp.getByText('Mijn pas').first().click(); await mp.waitForTimeout(400);
  await mp.locator('svg[aria-label^="QR"]').screenshot({ path: OUT + 'cam_qr.png' });
  await b0.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-i', OUT + 'cam_qr.png', '-vf',
    'scale=300:300,pad=640:480:(ow-iw)/2:(oh-ih)/2:color=gray,format=yuv420p', '-t', '3', '-r', '10', OUT + 'cam.y4m']);

  const b = await L.chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${OUT}cam.y4m`] });
  const ctx = await b.newContext({ ...L.D, permissions: ['camera'] }); const d = await ctx.newPage(); d.errs = [];
  d.on('pageerror', (e) => d.errs.push(e.message));
  await login(d, '/beheer/', 'desk@beautypass-test.nl', 'Team-12345');
  await nav(d, 'Check-in');
  console.log('camera-scan');
  await d.getByRole('button', { name: 'Scan met camera' }).click();
  await d.getByText(/Vandaag/).nth(1).waitFor({ timeout: 15000 }).catch(() => {});
  await d.waitForTimeout(1500);
  L.check(await d.getByRole('button', { name: 'Aanwezig melden' }).count() === 1, 'camera las de QR, member en afspraak van vandaag zichtbaar');
  await d.screenshot({ path: OUT + 'checkin_found.png', fullPage: true });
  await d.getByRole('button', { name: 'Aanwezig melden' }).click(); await d.waitForTimeout(1200);
  L.check(L.sql(`select checked_in_at is not null from appointments where member_id='${mid}' and status='gepland' and is_primary`) === 't', 'aanwezig gemeld in de database');
  await d.getByRole('button', { name: 'Behandeling afronden' }).click(); await d.waitForTimeout(1200);
  L.check(L.sql(`select count(*) from appointments where member_id='${mid}' and status='afgerond' and treatment_id='blow' and (starts_at at time zone 'Europe/Amsterdam')::date=(now() at time zone 'Europe/Amsterdam')::date`) === '1', 'afgerond (ook vóór de starttijd, na inchecken)');
  const used1 = Number(L.sql(`select used_in_month('${mid}', (now() at time zone 'Europe/Amsterdam')::date)`));
  L.check(used1 === used0, `telt als gebruikt: ${used0} → ${used1} (gepland telde al mee)`);
  await d.screenshot({ path: OUT + 'checkin_done.png', fullPage: true });

  console.log('handscanner en foute code');
  await d.getByRole('button', { name: 'Volgende scannen' }).click();
  await d.getByPlaceholder('Scan de pas of typ de code').fill(code.toLowerCase().replace(/(.{4})/g, '$1 ')); await d.keyboard.press('Enter'); await d.waitForTimeout(1000);
  L.check(await d.getByText('afgerond').count() > 0, 'code getypt (met spaties, kleine letters) werkt');
  await d.getByPlaceholder('Scan de pas of typ de code').fill('BPXXXXXXXXXX'); await d.keyboard.press('Enter'); await d.waitForTimeout(800);
  L.check(await d.getByText('Deze pas is niet (meer) geldig').count() === 1, 'onbekende pas geeft melding');
  await d.getByPlaceholder('Scan de pas of typ de code').fill('hallo'); await d.keyboard.press('Enter'); await d.waitForTimeout(800);
  L.check(await d.getByText('Dit is geen BeautyPass-pas').count() === 1, 'willekeurige tekst geeft melding');

  console.log('rechten');
  const sp = await L.page(b, L.D); await login(sp, '/beheer/', 'specialist@beautypass-test.nl', 'Team-12345');
  const r = await sp.evaluate((c) => BP.act.checkin(c).then((x) => x.today.length + ' ' + (x.member.team_note === null ? 'geen-notitie' : 'notitie')), code);
  L.check(/^\d+ geen-notitie$/.test(r), 'specialist kan scannen, ziet geen interne notitie: ' + r);
  const mem = await L.page(b, L.M); await login(mem, '/member/', email, 'Geheim-1234');
  const r2 = await mem.evaluate((c) => BP.act.checkin(c).then(() => 'gelukt', (e) => e.message), code);
  L.check(/rechten/.test(r2), 'member kan zelf niet inchecken: ' + r2);
  const before = L.sql(`select checkin_code from members where id='${mid}'`);
  await mem.evaluate(() => BP.act.newCheckinCode());
  const after = L.sql(`select checkin_code from members where id='${mid}'`);
  L.check(before !== after && /^BP[A-Z2-9]{10}$/.test(after), 'nieuwe pas: oude code vervalt');
  const r3 = await d.evaluate((c) => BP.act.checkin(c).then(() => 'gelukt', (e) => e.message), before);
  L.check(/niet \(meer\) geldig/.test(r3), 'oude pas werkt niet meer');
  L.check(!d.errs.length, 'geen JS-fouten ' + d.errs.join(' | '));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
