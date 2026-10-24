// Mollie calls this with only a payment id. We never trust the request: the payment is fetched from
// Mollie and applied idempotently (a webhook can arrive more than once, or out of order).
import { db, one, mollie, money, webhookUrl, readJson, markPaid, maskIban, todayAms, addMonths } from '../_lib.js';
import { mails, sendMail } from '../_mail.js';

const methodName = { ideal: 'iDEAL', creditcard: 'Creditcard', directdebit: 'SEPA-incasso', bancontact: 'Bancontact' };

async function applyMandate(m, customerId, mandateId) {
  if (!mandateId) return {};
  const md = await mollie('GET', `/customers/${customerId}/mandates/${mandateId}`).catch(() => null);
  if (!md) return { mandate_id: mandateId };
  const d = md.details || {};
  const label = d.consumerAccount ? `${d.consumerName ? d.consumerName + ' · ' : ''}${maskIban(d.consumerAccount)}` : d.cardNumber ? `•••• ${d.cardNumber}` : '';
  return { mandate_id: mandateId, mandate_method: methodName[md.method] || md.method, mandate_label: label };
}

// Applies the current state of a Mollie payment to our data (also used directly by the demo checkout)
export async function applyPayment(id) {
  const p = await mollie('GET', '/payments/' + id);
  const meta = p.metadata || {};
  let row = (await one(db().from('payments').select('*').eq('mollie_payment_id', p.id)))[0];

  // Monthly direct debits are created by the subscription: no row yet, find the member by customer
  if (!row && p.subscriptionId) {
    const m = (await one(db().from('members').select('id,plan_id').eq('mollie_customer_id', p.customerId)))[0];
    if (!m) return;
    row = await one(db().from('payments').insert({ member_id: m.id, kind: 'maand', description: p.description || 'Membership',
      mollie_payment_id: p.id, amount: Number(p.amount.value), status: 'open' }).select().single());
  }
  if (!row) return;
  const m = await one(db().from('members').select('*').eq('id', row.member_id).single());
  const plan = m.plan_id ? await one(db().from('plans').select('*').eq('id', m.plan_id).single()) : null;

  if (p.status === 'paid') {
    const done = await markPaid(row, p);
    row = done.row;
    if (!done.changed) return;

    if (row.kind === 'eerste' && ['nieuw', 'opgezegd'].includes(m.status)) {
      // First payment: start the monthly subscription one month from today on the new mandate
      const start = addMonths(todayAms(), 1);
      const sub = await mollie('POST', `/customers/${p.customerId}/subscriptions`, {
        amount: money(plan.price), interval: '1 month', startDate: start, description: `BeautyPass ${plan.name}`,
        mandateId: p.mandateId, webhookUrl: webhookUrl(), metadata: { member_id: m.id },
      });
      await one(db().from('members').update({ status: 'actief', since: m.status === 'nieuw' ? todayAms() : m.since, cancel_at: null, paused_until: null, mollie_subscription_id: sub.id, next_payment_date: start,
        ...(await applyMandate(m, p.customerId, p.mandateId)) }).eq('id', m.id));
      await one(db().from('waitlist').update({ status: 'member' }).ilike('email', m.email));
      await sendMail({ email: m.email, name: m.name }, mails.welcome(m, plan));
    } else if (row.kind === 'maand') {
      const next = p.subscriptionId ? (await mollie('GET', `/customers/${p.customerId}/subscriptions/${p.subscriptionId}`).catch(() => ({}))).nextPaymentDate : null;
      // A paid monthly debit starts the new period: a requested downgrade takes effect now
      await one(db().from('members').update({ ...(m.status === 'betaling mislukt' ? { status: 'actief' } : {}), ...(next ? { next_payment_date: next } : {}),
        ...(m.next_plan_id ? { plan_id: m.next_plan_id, next_plan_id: null } : {}) }).eq('id', m.id));
    } else if (row.kind === 'los' && row.appointment_group) {
      await one(db().from('appointments').update({ confirmed: true, hold_until: null, updated_at: new Date().toISOString() })
        .eq('group_id', row.appointment_group).eq('status', 'gepland'));
    } else if (row.kind === 'verificatie' && m.mollie_subscription_id) {
      // New payment method: move the subscription to the new mandate
      await mollie('PATCH', `/customers/${p.customerId}/subscriptions/${m.mollie_subscription_id}`, { mandateId: p.mandateId });
      await one(db().from('members').update(await applyMandate(m, p.customerId, p.mandateId)).eq('id', m.id));
      await mollie('POST', `/payments/${p.id}/refunds`, { amount: p.amount, description: 'Verificatie terug' }).catch(() => {});
    } else if (row.kind === 'upgrade') {
      const to = meta.plan;
      if (to) await one(db().from('members').update({ plan_id: to, next_plan_id: null }).eq('id', m.id));
    }
  } else if (['failed', 'expired', 'canceled'].includes(p.status)) {
    if (row.status !== 'mislukt') await one(db().from('payments').update({ status: 'mislukt' }).eq('id', row.id));
    if (row.kind === 'maand' && m.status === 'actief') {
      await one(db().from('members').update({ status: 'betaling mislukt' }).eq('id', m.id));
      if (plan) await sendMail({ email: m.email, name: m.name }, mails.paymentFailed(m, plan));
    } else if (row.kind === 'los' && row.appointment_group) {
      await one(db().from('appointments').update({ status: 'geannuleerd', cancel_reason: 'vervallen', updated_at: new Date().toISOString() })
        .eq('group_id', row.appointment_group).eq('confirmed', false));
    }
  }
}

export default async function webhook(req, res) {
  try {
    const { id } = await readJson(req);
    if (id && /^tr_\w+$/.test(id)) await applyPayment(id);
    return res.status(200).end();
  } catch (e) {
    console.error('mollie_webhook_error', e && e.message);
    return res.status(500).end();   // Mollie retries later
  }
}
