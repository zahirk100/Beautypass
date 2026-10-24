// Member pass: QR code and Code 128 barcode decode to the member's check-in code (checked with zxing)
const L = require('./lib.cjs');
const { execFileSync } = require('child_process');
(async () => {
  const b = await L.chromium.launch();
  const email = L.sql("select m.email from members m join auth.users u on u.id=m.user_id where m.status='actief' order by m.created_at desc limit 1");
  const code = L.sql(`select checkin_code from members where email='${email}'`);
  for (const [tag, o] of [['m', L.M], ['d', L.D]]) {
    const p = await L.page(b, o);
    await p.goto(L.APP + '/member/', { waitUntil: 'networkidle' });
    await p.getByLabel('E-mailadres').fill(email); await p.getByLabel('Wachtwoord').fill('Geheim-1234');
    await p.getByRole('button', { name: 'Inloggen', exact: true }).click(); await p.waitForTimeout(1500);
    await p.getByText('Mijn pas').first().click(); await p.waitForTimeout(500);
    await p.screenshot({ path: `tests/e2e/shots/pass_${tag}.png` });
    await p.locator('svg[aria-label^="QR"]').screenshot({ path: `tests/e2e/shots/pass_${tag}_qr.png` });
    await p.locator('svg[aria-label^="Streepjescode"]').screenshot({ path: `tests/e2e/shots/pass_${tag}_bar.png` });
    for (const k of ['qr', 'bar']) {
      const out = execFileSync('python3', ['-c', `import zxingcpp,sys;from PIL import Image;r=zxingcpp.read_barcodes(Image.open(sys.argv[1]));print(';'.join(x.format.name+'='+x.text for x in r))`, `tests/e2e/shots/pass_${tag}_${k}.png`]).toString().trim();
      L.check(out.endsWith('=' + code), `${tag}: ${k} leest ${out || 'niets'} (verwacht ${code})`);
    }
    L.check(!p.errs.length, tag + ': geen fouten ' + p.errs.join('|'));
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
