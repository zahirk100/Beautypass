// Beheer → First access → Uitnodigen: next round, mail with a link to the onboarding
import { handler, currentUser, requirePerm, db, one, HttpError, readJson, env } from '../_lib.js';
import { mails, sendMail } from '../_mail.js';

// A sign-up from the website only counts once it is confirmed (double opt-in at Brevo puts the contact on the
// First access list). Without that check anyone could put someone else's address on the list.
export async function confirmedAtBrevo(email) {
  const key = env('BREVO_API_KEY'), list = Number(env('BREVO_FIRST_ACCESS_LIST_ID'));
  if (!key || !Number.isSafeInteger(list) || list <= 0) return true;   // no list configured: nothing to check against
  const r = await fetch(env('BREVO_API_URL', 'https://api.brevo.com/v3') + '/contacts/' + encodeURIComponent(email),
    { headers: { 'api-key': key, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (r && r.status === 404) return false;
  if (!r || !r.ok) throw new HttpError(502, 'Brevo is even niet bereikbaar. Probeer het zo opnieuw.');
  const c = await r.json();
  return (c.listIds || []).includes(list) && !c.emailBlacklisted;
}

export default handler(async (req) => {
  const user = await currentUser(req);
  requirePerm(user, 'waitlist');
  const { ids } = await readJson(req);
  if (!Array.isArray(ids) || !ids.length || ids.length > 500) throw new HttpError(400, 'Kies wie je wilt uitnodigen');
  const rows = await one(db().from('waitlist').select('*').in('id', ids).eq('status', 'wachtend'));
  const last = (await one(db().from('waitlist').select('round').not('round', 'is', null).order('round', { ascending: false }).limit(1)))[0];
  const round = ((last && last.round) || 0) + 1;
  let sent = 0, unconfirmed = 0;
  for (const w of rows) {
    if (w.source === 'website' && !(await confirmedAtBrevo(w.email))) { unconfirmed++; continue; }
    const r = await sendMail({ email: w.email }, mails.invite(w.email));
    if (r.ok || r.skipped) sent++;
    await one(db().from('waitlist').update({ status: 'uitgenodigd', round, invited_at: new Date().toISOString() }).eq('id', w.id));
  }
  await db().from('audit_log').insert({ actor: user.id, action: 'waitlist_invite', entity: 'waitlist', entity_id: String(round), details: { count: rows.length - unconfirmed, unconfirmed } });
  return { sent, round, unconfirmed };
});
