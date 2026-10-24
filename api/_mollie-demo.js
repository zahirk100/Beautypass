// Demo payments: a stand-in for the Mollie API while there is no Mollie account yet. Only active with
// PAYMENTS_DEMO=1 and never together with a live key. Nothing is really paid: the tester chooses
// "betaald" or "mislukt" on /api/demo-checkout. Objects live in the table demo_mollie (migration 003),
// which only the server can read. Same request/response shapes as Mollie, so switching to a real
// test key later needs no code changes.
import { randomBytes } from 'node:crypto';

let dbRef;
export const bindDemo = (db) => { dbRef = db; };
const store = {
  async get(id) { const { data, error } = await dbRef().from('demo_mollie').select('data').eq('id', id).maybeSingle(); if (error) throw new Error(error.message); return data && data.data; },
  async put(obj) { const { error } = await dbRef().from('demo_mollie').upsert({ id: obj.id, data: obj }); if (error) throw new Error(error.message); return obj; },
  async find(field, value) { const { data, error } = await dbRef().from('demo_mollie').select('data').eq(`data->>${field}`, value); if (error) throw new Error(error.message); return data.map((r) => r.data); },
};
const newId = (prefix) => `${prefix}_demo${randomBytes(6).toString('hex')}`;
const now = () => new Date().toISOString();
const fail = (status, detail) => { const e = new Error(detail); e.mollieStatus = status; throw e; };

// Recurring payments (upgrade, retry, monthly debit) settle right after the request that created them
const pending = new Set();
export async function flushDemo() {
  if (!pending.size) return;
  const ids = [...pending]; pending.clear();
  const { applyPayment } = await import('./_routes/mollie-webhook.js');
  for (const id of ids) {
    const p = await store.get(id);
    if (!p || p.status !== 'pending') continue;
    await settle(p, (p.metadata && p.metadata.demo) || 'paid');
    await applyPayment(id).catch((e) => console.error('demo_settle_failed', id, e.message));
  }
}

export async function settle(p, status) {
  p.status = ['paid', 'failed', 'canceled', 'expired'].includes(status) ? status : 'paid';
  if (p.status === 'paid') {
    p.paidAt = now();
    if (!p.method) p.method = 'ideal';
    if (p.sequenceType === 'first' && p.customerId) {
      const card = p.method === 'creditcard';
      const md = { resource: 'mandate', id: newId('mdt'), status: 'valid', method: card ? 'creditcard' : 'directdebit', customerId: p.customerId, createdAt: now(),
        details: card ? { cardNumber: '4242', cardHolder: 'Testkaart' } : { consumerName: 'Testrekening', consumerAccount: 'NL55TEST0000000000' } };
      await store.put(md);
      p.mandateId = md.id;
    }
  }
  return store.put(p);
}

export async function createPayment(body, checkoutBase, extra = {}) {
  if (!body.amount || !/^\d+\.\d{2}$/.test(body.amount.value)) fail(422, 'The amount is invalid');
  const p = { resource: 'payment', id: newId('tr'), mode: 'test', demo: true, createdAt: now(), status: 'open', amount: body.amount, description: body.description,
    method: body.method || null, metadata: body.metadata || null, sequenceType: body.sequenceType || 'oneoff', redirectUrl: body.redirectUrl, webhookUrl: body.webhookUrl,
    customerId: body.customerId || null, mandateId: body.mandateId || null, subscriptionId: null, ...extra };
  if (p.sequenceType === 'recurring') {
    const md = (p.mandateId && await store.get(p.mandateId)) || (await store.find('customerId', p.customerId)).find((x) => x.resource === 'mandate' && x.status === 'valid');
    if (!md) fail(422, 'The customer has no valid mandate');
    p.mandateId = md.id; p.method = md.method; p.status = 'pending';
    pending.add(p.id);
  } else {
    p._links = { checkout: { href: `${checkoutBase}/api/demo-checkout?id=${p.id}`, type: 'text/html' } };
  }
  return store.put(p);
}

export async function demoMollie(method, path, body = {}, checkoutBase) {
  try {
    const [a, b, c, d] = path.split('?')[0].split('/').filter(Boolean);
    if (a === 'methods' && method === 'GET') return { count: 2, _embedded: { methods: [{ id: 'ideal' }, { id: 'creditcard' }] } };
    if (a === 'customers' && !b && method === 'POST') return store.put({ resource: 'customer', id: newId('cst'), name: body.name, email: body.email, metadata: body.metadata, createdAt: now() });
    if (a === 'customers' && b) {
      const cst = await store.get(b);
      if (!cst) fail(404, 'No customer exists with token ' + b);
      if (c === 'mandates' && d) { const md = await store.get(d); if (!md || md.customerId !== b) fail(404, 'Mandate not found'); return md; }
      if (c === 'subscriptions' && !d && method === 'POST') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body.startDate || '')) fail(422, 'startDate is required');
        if (body.mandateId && !await store.get(body.mandateId)) fail(422, 'Unknown mandate');
        return store.put({ resource: 'subscription', id: newId('sub'), customerId: b, status: 'active', amount: body.amount, interval: body.interval, startDate: body.startDate,
          nextPaymentDate: body.startDate, description: body.description, mandateId: body.mandateId || null, webhookUrl: body.webhookUrl, metadata: body.metadata, createdAt: now() });
      }
      if (c === 'subscriptions' && d) {
        const sub = await store.get(d);
        if (!sub || sub.customerId !== b) fail(404, 'Subscription not found');
        if (method === 'GET') return sub;
        if (sub.status === 'canceled') fail(422, 'The subscription has been canceled');
        if (method === 'PATCH') { for (const k of ['amount', 'description', 'mandateId', 'startDate', 'interval', 'webhookUrl', 'metadata']) if (k in body) sub[k] = body[k]; return store.put(sub); }
        if (method === 'DELETE') { sub.status = 'canceled'; sub.canceledAt = now(); return store.put(sub); }
      }
    }
    if (a === 'payments' && !b && method === 'POST') return createPayment(body, checkoutBase);
    if (a === 'payments' && b) {
      const p = await store.get(b);
      if (!p) fail(404, 'No payment exists with token ' + b);
      if (!c && method === 'GET') return p;
      if (!c && method === 'DELETE') { if (p.status !== 'open') fail(422, 'The payment cannot be canceled'); p.status = 'canceled'; return store.put(p); }
      if (c === 'refunds' && method === 'POST') {
        if (p.status !== 'paid') fail(422, 'The payment is not refundable');
        p.amountRefunded = body.amount; await store.put(p);
        return store.put({ resource: 'refund', id: newId('re'), paymentId: p.id, amount: body.amount, status: 'refunded', createdAt: now() });
      }
    }
    fail(404, `Not supported in demo mode: ${method} ${path}`);
  } catch (e) {
    if (e.mollieStatus) throw e;
    throw new Error('Demo-betalingen: ' + e.message);
  }
}

// A monthly direct debit of a subscription, triggered from Beheer (in real Mollie this happens by itself)
export async function chargeSubscription(subId, outcome) {
  const sub = await store.get(subId);
  if (!sub || sub.status !== 'active') fail(404, 'Geen actieve subscription');
  const p = await createPayment({ amount: sub.amount, description: sub.description, customerId: sub.customerId, mandateId: sub.mandateId, sequenceType: 'recurring',
    webhookUrl: sub.webhookUrl, metadata: { demo: outcome === 'failed' ? 'failed' : 'paid' } }, '', { subscriptionId: sub.id });
  const n = new Date(sub.nextPaymentDate + 'T12:00:00Z'); n.setUTCMonth(n.getUTCMonth() + 1); sub.nextPaymentDate = n.toISOString().slice(0, 10);
  await store.put(sub);
  return p;
}

export const getDemo = (id) => store.get(id);
