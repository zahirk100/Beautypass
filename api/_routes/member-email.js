// Beheer → member: correct a mistyped e-mail address, only as long as the member has never logged in
// (after the first login the address belongs to the membership and stays locked).
import { handler, currentUser, requirePerm, db, one, HttpError, readJson, mollie } from '../_lib.js';

export default handler(async (req) => {
  const user = await currentUser(req);
  requirePerm(user, 'members');
  const { member_id, email: raw } = await readJson(req);
  const email = String(raw || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, 'Vul een geldig e-mailadres in');
  const m = (await one(db().from('members').select('*').eq('id', member_id)))[0];
  if (!m) throw new HttpError(404, 'Member niet gevonden');
  if (m.email.toLowerCase() === email) return {};
  if ((await one(db().from('profiles').select('id').eq('email', email))).length || (await one(db().from('members').select('id').eq('email', email))).length) {
    throw new HttpError(409, 'Dit e-mailadres is al in gebruik');
  }
  if (m.user_id) {
    const { data } = await db().auth.admin.getUserById(m.user_id);
    if (data && data.user && data.user.last_sign_in_at) throw new HttpError(400, 'Deze member is al eens ingelogd. Het e-mailadres kan daarom niet meer worden gewijzigd.');
    const { error } = await db().auth.admin.updateUserById(m.user_id, { email, email_confirm: true });
    if (error) throw new HttpError(400, 'Wijzigen lukte niet: ' + error.message);
  }
  await one(db().from('members').update({ email }).eq('id', m.id));
  if (m.mollie_customer_id) await mollie('PATCH', '/customers/' + m.mollie_customer_id, { email }).catch(() => {});
  await db().from('audit_log').insert({ actor: user.id, action: 'member_email', entity: 'member', entity_id: m.id, details: {} });
  return {};
});
