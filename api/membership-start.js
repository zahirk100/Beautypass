// Onboarding step 4: create the Mollie customer and the first payment (iDEAL/card). The webhook
// turns a paid first payment into a monthly subscription and activates the membership.
import { handler, currentUser, db, one, mollie, money, webhookUrl, APP_URL, HttpError, readJson } from './_lib.js';

export default handler(async (req) => {
  const user = await currentUser(req);
  const { plan: planId } = await readJson(req);
  const m = (await one(db().from('members').select('*').eq('user_id', user.id)))[0];
  if (!m) throw new HttpError(400, 'Vul eerst je gegevens in');
  if (!['nieuw', 'opgezegd'].includes(m.status)) throw new HttpError(400, 'Je bent al member. Wijzig je membership in de app.');
  const plan = (await one(db().from('plans').select('*').eq('id', planId || m.plan_id).eq('active', true)))[0];
  if (!plan) throw new HttpError(400, 'Kies een membership');
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
    if (p && p.status === 'open' && p._links.checkout && p.amount.value === money(plan.price).value) return { checkoutUrl: p._links.checkout.href };
    if (p && p.status === 'open') await mollie('DELETE', '/payments/' + open.mollie_payment_id).catch(() => {});
    if (p && ['open', 'canceled', 'expired', 'failed'].includes(p.status)) await one(db().from('payments').update({ status: 'mislukt' }).eq('id', open.id));
  }
  const pay = await mollie('POST', '/payments', {
    amount: money(plan.price), customerId, sequenceType: 'first',
    description: `BeautyPass ${plan.name} · eerste maand`,
    redirectUrl: APP_URL() + '/onboarding?betaald=1', webhookUrl: webhookUrl(),
    metadata: { member_id: m.id, kind: 'eerste', plan: plan.id },
  });
  await one(db().from('payments').insert({ member_id: m.id, kind: 'eerste', description: `Membership ${plan.name} · eerste maand`,
    mollie_payment_id: pay.id, amount: plan.price, status: 'open' }));
  return { checkoutUrl: pay._links.checkout.href };
});
