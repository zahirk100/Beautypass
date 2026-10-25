// Starting a membership: Mollie customer + first payment (iDEAL/card). The webhook turns a paid first payment
// into the monthly subscription and activates the membership. Used by onboarding (signed in) and checkout (not yet).
import { db, one, mollie, money, webhookUrl } from './_lib.js';

export const methods = { iDEAL: 'ideal', Creditcard: 'creditcard' };

export async function startFirstPayment(m, plan, method, redirectUrl) {
  const mollieMethod = methods[method];
  if (plan.id !== m.plan_id) await one(db().from('members').update({ plan_id: plan.id }).eq('id', m.id));
  let customerId = m.mollie_customer_id;
  if (!customerId) {
    const c = await mollie('POST', '/customers', { name: m.name, email: m.email, metadata: { member_id: m.id } });
    customerId = c.id;
    await one(db().from('members').update({ mollie_customer_id: customerId }).eq('id', m.id));
  }
  // A first payment that is still open (back button, double click) is reused, so nobody pays twice
  const open = (await one(db().from('payments').select('*').eq('member_id', m.id).eq('kind', 'eerste').eq('status', 'open')))[0];
  if (open) {
    const p = await mollie('GET', '/payments/' + open.mollie_payment_id).catch(() => null);
    if (p && p.status === 'open' && p._links.checkout && p.amount.value === money(plan.price).value && (!mollieMethod || p.method === mollieMethod)) return { checkoutUrl: p._links.checkout.href, ref: open.id };
    if (p && p.status === 'open') await mollie('DELETE', '/payments/' + open.mollie_payment_id).catch(() => {});
    if (p && ['open', 'canceled', 'expired', 'failed'].includes(p.status)) await one(db().from('payments').update({ status: 'mislukt' }).eq('id', open.id));
  }
  const row = await one(db().from('payments').insert({ member_id: m.id, kind: 'eerste', description: `Membership ${plan.name} · eerste maand`,
    amount: plan.price, status: 'open' }).select().single());
  const sep = redirectUrl.includes('?') ? '&' : '?';
  const pay = await mollie('POST', '/payments', {
    amount: money(plan.price), customerId, sequenceType: 'first', ...(mollieMethod ? { method: mollieMethod } : {}),
    description: `BeautyPass ${plan.name} · eerste maand`,
    redirectUrl: redirectUrl + sep + 'ref=' + row.id, webhookUrl: webhookUrl(),
    metadata: { member_id: m.id, kind: 'eerste', plan: plan.id },
  }).catch(async (e) => { await db().from('payments').delete().eq('id', row.id); throw e; });
  await one(db().from('payments').update({ mollie_payment_id: pay.id }).eq('id', row.id));
  return { checkoutUrl: pay._links.checkout.href, ref: row.id };
}
