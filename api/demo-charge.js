// Demo payments only: run a member's monthly direct debit now, successful or failed (Beheer → member).
import { handler, currentUser, requirePerm, db, one, HttpError, readJson, demoPayments } from './_lib.js';
import { chargeSubscription } from './_mollie-demo.js';

export default handler(async (req) => {
  if (!demoPayments()) throw new HttpError(404, 'Alleen in de testmodus');
  const user = await currentUser(req);
  requirePerm(user, 'members');
  const { member_id, outcome } = await readJson(req);
  const m = (await one(db().from('members').select('id,mollie_subscription_id').eq('id', member_id)))[0];
  if (!m || !m.mollie_subscription_id) throw new HttpError(400, 'Deze member heeft geen lopende incasso');
  await chargeSubscription(m.mollie_subscription_id, outcome);
  return {};   // the handler settles the payment before it answers
});
