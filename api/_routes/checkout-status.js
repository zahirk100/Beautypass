// Back from Mollie without being signed in: did the first payment go through? Only the status of the payment
// behind this unguessable reference is returned, nothing about the member.
import { handler, db, one, readJson, HttpError } from '../_lib.js';

export default handler(async (req) => {
  const { ref } = await readJson(req);
  if (!/^[0-9a-f-]{36}$/i.test(String(ref || ''))) throw new HttpError(400, 'Onbekende betaling');
  const p = (await one(db().from('payments').select('status,kind,created_at').eq('id', ref)))[0];
  if (!p || p.kind !== 'eerste' || Date.now() - new Date(p.created_at).getTime() > 7 * 864e5) throw new HttpError(404, 'Onbekende betaling');
  return { status: p.status === 'betaald' ? 'paid' : p.status === 'mislukt' ? 'failed' : 'open' };
});
