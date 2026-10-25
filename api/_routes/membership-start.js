// Onboarding (signed in): the first payment for the chosen plan. Not signed in yet → membership-checkout.
import { handler, currentUser, db, one, APP_URL, HttpError, readJson } from '../_lib.js';
import { startFirstPayment } from '../_membership.js';

export default handler(async (req) => {
  const user = await currentUser(req);
  const { plan: planId, method } = await readJson(req);
  const m = (await one(db().from('members').select('*').eq('user_id', user.id)))[0];
  if (!m) throw new HttpError(400, 'Vul eerst je gegevens in');
  if (!['nieuw', 'opgezegd'].includes(m.status)) throw new HttpError(400, 'Je bent al member. Wijzig je membership in de app.');
  // Terms: once the salon has filled in its links, the member has to accept them before paying
  const st = await one(db().from('settings').select('*').eq('id', 1).single());
  if (st.terms_url && st.privacy_url && !m.terms_accepted_at) throw new HttpError(400, 'Ga eerst akkoord met de voorwaarden en het privacybeleid');
  const plan = (await one(db().from('plans').select('*').eq('id', planId || m.plan_id).eq('active', true)))[0];
  if (!plan) throw new HttpError(400, 'Kies een membership');
  return startFirstPayment(m, plan, method, APP_URL() + '/onboarding?betaald=1');
});
