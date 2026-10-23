// Beheer → First access → Uitnodigen: next round, mail with a link to the onboarding
import { handler, currentUser, requirePerm, db, one, HttpError, readJson } from './_lib.js';
import { mails, sendMail } from './_mail.js';

export default handler(async (req) => {
  const user = await currentUser(req);
  requirePerm(user, 'waitlist');
  const { ids } = await readJson(req);
  if (!Array.isArray(ids) || !ids.length || ids.length > 500) throw new HttpError(400, 'Kies wie je wilt uitnodigen');
  const rows = await one(db().from('waitlist').select('*').in('id', ids).eq('status', 'wachtend'));
  const last = (await one(db().from('waitlist').select('round').not('round', 'is', null).order('round', { ascending: false }).limit(1)))[0];
  const round = ((last && last.round) || 0) + 1;
  let sent = 0;
  for (const w of rows) {
    const r = await sendMail({ email: w.email }, mails.invite(w.email));
    if (r.ok || r.skipped) sent++;
    await one(db().from('waitlist').update({ status: 'uitgenodigd', round, invited_at: new Date().toISOString() }).eq('id', w.id));
  }
  await db().from('audit_log').insert({ actor: user.id, action: 'waitlist_invite', entity: 'waitlist', entity_id: String(round), details: { count: rows.length } });
  return { sent, round };
});
