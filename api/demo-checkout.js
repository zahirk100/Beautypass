// Demo payments only: the "Mollie checkout" where the tester chooses the outcome. Nothing is paid.
import { demoPayments, readJson, eur } from './_lib.js';
import { getDemo, settle } from './_mollie-demo.js';
import { applyPayment } from './mollie-webhook.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const page = (p) => `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Testbetaling · BeautyPass</title>
<style>body{margin:0;background:#faf9f6;font-family:'Manrope','Helvetica Neue',Arial,sans-serif;color:#1d1a17}main{max-width:420px;margin:0 auto;padding:56px 24px}
.mark{letter-spacing:.32em;font-size:14px;margin-bottom:40px}.card{background:#fff;border:1px solid #e6e0d6;border-radius:24px;padding:28px}
.tag{display:inline-block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:#9a6b2f;background:#f3eadb;padding:6px 10px;border-radius:99px;margin-bottom:16px}
h1{font-family:'Cormorant Garamond',Georgia,serif;font-weight:500;font-size:34px;margin:0 0 6px}.amt{font-size:22px;font-weight:700;margin:14px 0 22px}p{color:#5f5850;font-size:14px;line-height:1.5}
button{display:block;width:100%;height:52px;margin:10px 0 0;border-radius:26px;font:600 15px 'Manrope',sans-serif;cursor:pointer;border:1px solid #d8d0c3;background:#fff;color:#1d1a17}
button.pay{background:#1d1a17;color:#fff;border:none}</style></head><body><main><div class="mark">BEAUTYPASS</div><div class="card">
<span class="tag">Testmodus</span><h1>Testbetaling</h1><p>${esc(p.description)}</p><div class="amt">${eur(p.amount.value)}</div>
<p>Er wordt niets afgeschreven. Kies wat er met deze betaling gebeurt.</p>
<form method="post"><input type="hidden" name="id" value="${esc(p.id)}">
<button class="pay" name="status" value="paid" id="paid">Betaling gelukt</button><button name="status" value="failed" id="failed">Betaling mislukt</button><button name="status" value="canceled" id="canceled">Geannuleerd</button></form></div></main></body></html>`;

export default async function demoCheckout(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!demoPayments()) return res.status(404).send('Niet gevonden');
  try {
    const url = new URL(req.url, 'http://x');
    const body = req.method === 'POST' ? await readJson(req) : {};
    const id = body.id || url.searchParams.get('id') || '';
    const p = /^tr_demo[0-9a-f]+$/.test(id) ? await getDemo(id) : null;
    if (!p || p.resource !== 'payment') return res.status(404).send('Onbekende betaling');
    if (req.method === 'GET') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.status(200).send(page(p)); }
    if (req.method !== 'POST') return res.status(405).end();
    if (p.status === 'open') { await settle(p, body.status); await applyPayment(p.id); }
    res.setHeader('Location', p.redirectUrl || '/member/');
    return res.status(303).end();
  } catch (e) {
    console.error('demo_checkout_error', e && e.message);
    return res.status(500).send('Er ging iets mis');
  }
}
