// Local stand-in for Mollie and Brevo, for end-to-end tests without real keys or network.
//   node scripts/mock-providers.mjs            → http://127.0.0.1:4010
//   MOLLIE_API_URL=http://127.0.0.1:4010/mollie/v2   BREVO_API_URL=http://127.0.0.1:4010/brevo/v3
// Hosted checkout: /mollie/checkout/<id> lets the tester choose paid / failed / canceled.
// Test helpers:  POST /mock/charge/<subscriptionId>?status=paid|failed  (a monthly direct debit)
//                GET  /mock/state   (everything)     GET /mock/mails     POST /mock/reset
import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT || 4010);
const BASE = `http://127.0.0.1:${PORT}`;
let db, seq;
const reset = () => { db = { customers: {}, payments: {}, mandates: {}, subscriptions: {}, refunds: {}, mails: [] }; seq = 1; };
reset();
const id = (prefix) => `${prefix}_mock${String(seq++).padStart(5, '0')}`;
const now = () => new Date().toISOString();

async function callWebhook(p) {
  if (!p.webhookUrl) return;
  try {
    const r = await fetch(p.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'id=' + p.id });
    console.log('[mock] webhook', p.id, p.status, '→', r.status);
  } catch (e) { console.log('[mock] webhook failed', p.id, e.message); }
}

function setStatus(p, status) {
  p.status = status;
  if (status === 'paid') {
    p.paidAt = now();
    if (p.sequenceType === 'first' && p.customerId) {
      const md = { resource: 'mandate', id: id('mdt'), status: 'valid', method: p.method === 'creditcard' ? 'creditcard' : 'directdebit', customerId: p.customerId,
        details: p.method === 'creditcard' ? { cardNumber: '4242', cardHolder: 'Test' } : { consumerName: 'T. Tester', consumerAccount: 'NL55INGB0000000000', consumerBic: 'INGBNL2A' } };
      db.mandates[md.id] = md;
      p.mandateId = md.id;
    }
  }
  p.details = p.method === 'ideal' ? { consumerName: 'T. Tester', consumerAccount: 'NL55INGB0000000000' } : p.details;
}

function newPayment(body, extra = {}) {
  const p = {
    resource: 'payment', id: id('tr'), mode: 'test', createdAt: now(), status: 'open',
    amount: body.amount, description: body.description, method: body.method || null, metadata: body.metadata || null,
    sequenceType: body.sequenceType || 'oneoff', redirectUrl: body.redirectUrl, webhookUrl: body.webhookUrl,
    customerId: body.customerId || null, mandateId: body.mandateId || null, subscriptionId: null, ...extra,
  };
  if (!p.amount || !/^\d+\.\d{2}$/.test(p.amount.value)) return [422, { status: 422, title: 'Unprocessable Entity', detail: 'The amount is invalid' }];
  if (p.sequenceType === 'recurring') {
    const md = db.mandates[p.mandateId] || Object.values(db.mandates).find((m) => m.customerId === p.customerId && m.status === 'valid');
    if (!md) return [422, { status: 422, title: 'Unprocessable Entity', detail: 'The customer has no valid mandate' }];
    p.mandateId = md.id; p.method = md.method;
    p.status = 'pending';
    // A direct debit settles a moment later; the test can force a failure with metadata.mock = 'failed'
    setTimeout(() => { setStatus(p, (p.metadata && p.metadata.mock) || process.env.MOCK_RECURRING || 'paid'); callWebhook(p); }, 400);
  } else {
    p._links = { checkout: { href: `${BASE}/mollie/checkout/${p.id}`, type: 'text/html' } };
  }
  db.payments[p.id] = p;
  return [201, p];
}

function mollie(method, parts, body) {
  const [a, b, c, d] = parts;
  if (a === 'methods' && method === 'GET') return [200, { count: 2, _embedded: { methods: [{ id: 'ideal' }, { id: 'creditcard' }] } }];
  if (a === 'customers' && !b && method === 'POST') { const cst = { resource: 'customer', id: id('cst'), name: body.name, email: body.email, metadata: body.metadata }; db.customers[cst.id] = cst; return [201, cst]; }
  if (a === 'customers' && b) {
    if (!db.customers[b]) return [404, { status: 404, title: 'Not Found', detail: 'No customer exists with token ' + b }];
    if (c === 'mandates' && d) return db.mandates[d] && db.mandates[d].customerId === b ? [200, db.mandates[d]] : [404, { status: 404, title: 'Not Found' }];
    if (c === 'subscriptions' && !d && method === 'POST') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.startDate || '')) return [422, { status: 422, title: 'Unprocessable Entity', detail: 'startDate is required' }];
      if (body.mandateId && !db.mandates[body.mandateId]) return [422, { status: 422, title: 'Unprocessable Entity', detail: 'Unknown mandate' }];
      const sub = { resource: 'subscription', id: id('sub'), customerId: b, status: 'active', amount: body.amount, interval: body.interval, startDate: body.startDate,
        nextPaymentDate: body.startDate, description: body.description, mandateId: body.mandateId || null, webhookUrl: body.webhookUrl, metadata: body.metadata, createdAt: now() };
      db.subscriptions[sub.id] = sub; return [201, sub];
    }
    if (c === 'subscriptions' && d) {
      const sub = db.subscriptions[d];
      if (!sub || sub.customerId !== b) return [404, { status: 404, title: 'Not Found' }];
      if (method === 'GET') return [200, sub];
      if (sub.status === 'canceled') return [422, { status: 422, title: 'Unprocessable Entity', detail: 'The subscription has been canceled' }];
      if (method === 'PATCH') { Object.assign(sub, Object.fromEntries(Object.entries(body).filter(([k]) => ['amount', 'description', 'mandateId', 'startDate', 'interval', 'webhookUrl', 'metadata'].includes(k)))); return [200, sub]; }
      if (method === 'DELETE') { sub.status = 'canceled'; sub.canceledAt = now(); return [200, sub]; }
    }
  }
  if (a === 'payments' && !b && method === 'POST') return newPayment(body);
  if (a === 'payments' && b) {
    const p = db.payments[b];
    if (!p) return [404, { status: 404, title: 'Not Found', detail: 'No payment exists with token ' + b }];
    if (!c && method === 'GET') return [200, p];
    if (!c && method === 'DELETE') { if (p.status !== 'open') return [422, { status: 422, title: 'Unprocessable Entity', detail: 'The payment cannot be canceled' }]; p.status = 'canceled'; return [200, p]; }
    if (c === 'refunds' && method === 'POST') {
      if (p.status !== 'paid') return [422, { status: 422, title: 'Unprocessable Entity', detail: 'The payment is not refundable' }];
      const r = { resource: 'refund', id: id('re'), paymentId: p.id, amount: body.amount, status: 'pending', createdAt: now() };
      db.refunds[r.id] = r; p.amountRefunded = body.amount; return [201, r];
    }
  }
  return [404, { status: 404, title: 'Not Found', detail: `mock: ${method} /${parts.join('/')}` }];
}

const page = (p) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mollie (test)</title>
<style>body{font-family:system-ui;max-width:420px;margin:60px auto;padding:0 20px}button{display:block;width:100%;height:48px;margin:10px 0;border-radius:10px;border:1px solid #ccc;font-size:16px;cursor:pointer}</style></head>
<body><h2>Mollie testbetaling</h2><p>${p.description}<br><b>€ ${p.amount.value}</b></p><form method="post">
<button name="status" value="paid" id="paid">Betaald</button><button name="status" value="failed" id="failed">Mislukt</button><button name="status" value="canceled" id="canceled">Geannuleerd</button></form></body></html>`;

async function readBody(req) {
  const chunks = []; for await (const ch of req) chunks.push(ch);
  const raw = Buffer.concat(chunks).toString();
  if (!raw) return {};
  if ((req.headers['content-type'] || '').includes('json')) return JSON.parse(raw);
  return Object.fromEntries(new URLSearchParams(raw));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE);
  const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  try {
    const body = ['POST', 'PATCH', 'DELETE'].includes(req.method) ? await readBody(req) : {};
    const parts = url.pathname.split('/').filter(Boolean);

    if (parts[0] === 'mollie' && parts[1] === 'checkout') {
      const p = db.payments[parts[2]];
      if (!p) { res.writeHead(404); return res.end('Onbekende betaling'); }
      if (req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(page(p)); }
      if (p.status === 'open') {
        if (!p.method) p.method = 'ideal';
        setStatus(p, ['paid', 'failed', 'canceled'].includes(body.status) ? body.status : 'paid');
        await callWebhook(p);
      }
      res.writeHead(303, { Location: p.redirectUrl }); return res.end();
    }
    if (parts[0] === 'mollie' && parts[1] === 'v2') {
      if (!/^Bearer test_\w+/.test(req.headers.authorization || '')) return json(401, { status: 401, title: 'Unauthorized Request', detail: 'Missing authentication, or failed to authenticate' });
      const [status, data] = mollie(req.method, parts.slice(2), body);
      console.log('[mock] mollie', req.method, url.pathname, status);
      return json(status, data);
    }
    if (parts[0] === 'brevo' && parts[2] === 'contacts' && parts[3] && req.method === 'GET') {
      const c = (db.contacts || {})[decodeURIComponent(parts[3]).toLowerCase()];
      return c ? json(200, { email: decodeURIComponent(parts[3]), listIds: c.listIds, emailBlacklisted: false }) : json(404, { code: 'document_not_found', message: 'Contact does not exist' });
    }
    if (parts[0] === 'brevo' && url.pathname.endsWith('/smtp/email') && req.method === 'POST') {
      if (!req.headers['api-key']) return json(401, { code: 'unauthorized', message: 'Key not found' });
      db.mails.push({ at: now(), to: body.to, subject: body.subject, html: body.htmlContent, sender: body.sender });
      console.log('[mock] mail →', body.to && body.to[0].email, '·', body.subject);
      return json(201, { messageId: '<' + id('msg') + '@mock>' });
    }
    if (parts[0] === 'mock') {
      if (parts[1] === 'reset' && req.method === 'POST') { reset(); return json(200, { ok: true }); }
      if (parts[1] === 'mails') return json(200, db.mails);
      if (parts[1] === 'contact' && req.method === 'POST') { db.contacts = db.contacts || {}; db.contacts[body.email.toLowerCase()] = { listIds: body.listIds || [] }; return json(200, { ok: true }); }
      if (parts[1] === 'state') return json(200, db);
      if (parts[1] === 'charge' && req.method === 'POST') {
        const sub = db.subscriptions[parts[2]];
        if (!sub || sub.status !== 'active') return json(404, { error: 'no active subscription' });
        const [, p] = newPayment({ amount: sub.amount, description: sub.description, customerId: sub.customerId, mandateId: sub.mandateId, sequenceType: 'recurring',
          webhookUrl: sub.webhookUrl, metadata: { mock: url.searchParams.get('status') || 'paid' } }, { subscriptionId: sub.id });
        const n = new Date(sub.nextPaymentDate + 'T12:00:00Z'); n.setUTCMonth(n.getUTCMonth() + 1); sub.nextPaymentDate = n.toISOString().slice(0, 10);
        return json(201, p);
      }
    }
    json(404, { error: 'not found' });
  } catch (e) { console.error(e); json(500, { error: e.message }); }
}).listen(PORT, '127.0.0.1', () => console.log('[mock] Mollie + Brevo on ' + BASE));
