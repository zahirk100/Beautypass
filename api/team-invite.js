// Beheer → Instellingen → Gebruikers → Uitnodigen (owner only). Supabase sends the invitation mail
// (template "invite"); the link lands on /beheer where the new colleague chooses a password.
import { handler, currentUser, db, one, HttpError, readJson, APP_URL } from './_lib.js';

export default handler(async (req) => {
  const user = await currentUser(req);
  if (user.role !== 'owner') throw new HttpError(403, 'Alleen de eigenaar kan teamleden uitnodigen');
  const { email, role } = await readJson(req);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) throw new HttpError(400, 'Vul een geldig e-mailadres in');
  if (!['manager', 'desk', 'specialist'].includes(role)) throw new HttpError(400, 'Kies een rol');
  const existing = (await one(db().from('profiles').select('id,role').ilike('email', email.trim())))[0];
  let id = existing && existing.id;
  if (!id) {
    const { data, error } = await db().auth.admin.inviteUserByEmail(email.trim(), { redirectTo: APP_URL() + '/beheer/' });
    if (error) throw new HttpError(400, error.message);
    id = data.user.id;
  }
  if (!existing || existing.role === 'member') await one(db().from('profiles').update({ role }).eq('id', id));
  await db().from('audit_log').insert({ actor: user.id, action: 'team_invite', entity: 'profile', entity_id: id, details: { role } });
  return { invited: !existing };
});
