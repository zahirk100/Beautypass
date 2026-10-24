// A treatment outside the plan or over the monthly limit: one-off payment for the 30-minute hold
import { handler, currentUser, db, one, mollie, money, webhookUrl, APP_URL, HttpError, readJson } from '../_lib.js';

export default handler(async (req) => {
  const user = await currentUser(req);
  const { group_id } = await readJson(req);
  const m = (await one(db().from('members').select('*').eq('user_id', user.id)))[0];
  if (!m) throw new HttpError(403, 'Geen member');
  const a = (await one(db().from('appointments').select('*, treatments(name)').eq('group_id', group_id).eq('is_primary', true).eq('member_id', m.id)))[0];
  if (!a || a.status !== 'gepland' || a.confirmed) throw new HttpError(400, 'Deze afspraak hoeft niet (meer) betaald te worden');
  if (!a.hold_until || new Date(a.hold_until) < new Date()) throw new HttpError(400, 'De reservering is verlopen. Kies het tijdstip opnieuw.');
  const existing = (await one(db().from('payments').select('*').eq('appointment_group', group_id).eq('status', 'open')))[0];
  if (existing) {
    const p = await mollie('GET', '/payments/' + existing.mollie_payment_id);
    if (p.status === 'open' && p._links.checkout) return { checkoutUrl: p._links.checkout.href };
  }
  const pay = await mollie('POST', '/payments', {
    amount: money(a.paid_amount), description: `BeautyPass · ${a.treatments.name}`, ...(m.mollie_customer_id ? { customerId: m.mollie_customer_id } : {}),
    redirectUrl: APP_URL() + '/member/?betaald=1', webhookUrl: webhookUrl(), metadata: { member_id: m.id, kind: 'los', group: group_id },
  });
  await one(db().from('payments').insert({ member_id: m.id, kind: 'los', description: a.treatments.name, appointment_group: group_id,
    mollie_payment_id: pay.id, amount: a.paid_amount, status: 'open' }));
  return { checkoutUrl: pay._links.checkout.href };
});
