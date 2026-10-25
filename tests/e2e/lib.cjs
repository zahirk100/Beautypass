const { chromium, devices } = require('playwright');
const APP = 'http://localhost:5173', MAIL = 'http://127.0.0.1:54324', MOCK = 'http://127.0.0.1:4010';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function otp(email, after = 0) {
  for (let i = 0; i < 40; i++) {
    const r = await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent('to:' + email)}`)).json();
    const msg = (r.messages || []).find((m) => new Date(m.Created).getTime() > after);
    if (msg) { const full = await (await fetch(`${MAIL}/api/v1/message/${msg.ID}`)).json(); const m = (full.Text || full.HTML).match(/\b(\d{6})\b/); if (m) return m[1]; }
    await sleep(500);
  }
  throw new Error('no otp for ' + email);
}
const sql = (q) => require('child_process').execFileSync('docker', ['exec', 'supabase_db_Beautypass', 'psql', '-U', 'postgres', '-tAc', q], { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
const D = { viewport: { width: 1440, height: 900 } }, M = devices['iPhone 13'];
async function page(b, opts) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') p.errs.push(m.text().slice(0, 200)); });
  return p;
}
function check(cond, label) { console.log((cond ? '  ✓ ' : '  ✗ ') + label); if (!cond) process.exitCode = 1; }
const demo = require('child_process').execFileSync('curl', ['-s', APP + '/api/app-config']).toString().includes('"demo"');
// Member login opens on "code per e-mail"; the tests sign in with a password
async function pwMode(p) { const b = p.getByText('Inloggen met wachtwoord', { exact: true }); if (await b.count()) await b.click(); }
module.exports = { pwMode, demo, chromium, APP, MAIL, MOCK, sleep, otp, sql, D, M, page, check };
