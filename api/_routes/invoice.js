// Printable invoice (HTML) for a paid payment. Members get their own, the team with the "finance" right all.
import { handler, currentUser, db, one, HttpError, readJson, eur, fmtDate } from '../_lib.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export default handler(async (req, res) => {
  const user = await currentUser(req);
  const { id } = await readJson(req);
  const p = (await one(db().from('payments').select('*, members(name,email,user_id)').eq('id', id)))[0];
  if (!p || p.status !== 'betaald') throw new HttpError(404, 'Factuur niet gevonden');
  const own = p.members && p.members.user_id === user.id;
  if (!own && !user.perms.includes('finance')) throw new HttpError(403, 'Geen toegang');
  const total = Number(p.amount), vat = Math.round((total - total / (1 + Number(p.vat_rate) / 100)) * 100) / 100;
  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Factuur ${esc(p.invoice_no)}</title>
<style>body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1d1a17;max-width:720px;margin:48px auto;padding:0 24px}h1{font-family:Georgia,serif;font-weight:500;font-size:40px;margin:0 0 4px}
.muted{color:#958c80;font-size:13px}table{width:100%;border-collapse:collapse;margin:32px 0}td{padding:12px 0;border-bottom:1px solid #e6e0d6}td:last-child{text-align:right}
.tot td{font-weight:700;border-bottom:none}.top{display:flex;justify-content:space-between;gap:24px;margin-bottom:40px}@media print{button{display:none}}</style></head><body>
<div class="top"><div><div style="letter-spacing:.32em;font-size:15px;margin-bottom:24px">BEAUTYPASS</div><h1>Factuur</h1><div class="muted">${esc(p.invoice_no)} · ${esc(fmtDate(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date(p.paid_at))))}</div></div>
<div class="muted" style="text-align:right">BeautyPass Amsterdam<br>hallo@beautypass.nl<br>KvK: [in te vullen]<br>Btw: [in te vullen]</div></div>
<div><b>${esc(p.members.name)}</b><br><span class="muted">${esc(p.members.email)}</span></div>
<table><tr><td>${esc(p.description)}</td><td>${eur(total - vat)}</td></tr><tr><td>Btw ${Number(p.vat_rate)}%</td><td>${eur(vat)}</td></tr>
<tr class="tot"><td>Totaal (betaald${p.method ? ' via ' + esc(p.method) : ''})</td><td>${eur(total)}</td></tr></table>
<button onclick="print()" style="height:44px;padding:0 22px;border-radius:99px;border:none;background:#1d1a17;color:#fff;font-weight:600;cursor:pointer">Opslaan als PDF / printen</button></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
});
