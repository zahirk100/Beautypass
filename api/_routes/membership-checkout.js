// Onboarding without an account: routine + plan + name/e-mail → straight to the first payment. The login is
// created here (e-mail only, no password); after paying, the member signs in with a code from their mail.
import { handler, db, one, HttpError, readJson, APP_URL } from '../_lib.js';
import { startFirstPayment, methods } from '../_membership.js';

// Best effort against scripted sign-ups (per server instance): at most 8 attempts per IP per 10 minutes
const hits = new Map();
function throttle(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  if (!process.env.VERCEL && /^(127\.|::1$|::ffff:127\.)/.test(ip)) return;   // local development
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 600000);
  if (list.length >= 8) throw new HttpError(429, 'Te veel pogingen. Probeer het over een paar minuten opnieuw.');
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
}

export default handler(async (req) => {
  // Only from our own pages
  const origin = req.headers.origin || '';
  let host = ''; try { host = new URL(origin).host; } catch {}
  if (!host || (host !== req.headers.host && host !== req.headers['x-forwarded-host'])) throw new HttpError(403, 'Niet toegestaan');
  throttle(req);
  const b = await readJson(req);
  if (b.website) throw new HttpError(400, 'Ongeldige gegevens');   // honeypot
  const name = String(b.name || '').trim().slice(0, 120);
  const email = String(b.email || '').trim().toLowerCase();
  const phone = String(b.phone || '').trim().slice(0, 30) || null;
  if (name.length < 2) throw new HttpError(400, 'Vul je naam in');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, 'Vul een geldig e-mailadres in');
  if (b.method && !methods[b.method]) throw new HttpError(400, 'Kies een betaalmethode');
  const plan = (await one(db().from('plans').select('*').eq('id', b.plan).eq('active', true)))[0];
  if (!plan) throw new HttpError(400, 'Kies een membership');
  const treatments = new Set((await one(db().from('treatments').select('id').eq('active', true))).map((t) => t.id));
  const routine = [...new Set((Array.isArray(b.routine) ? b.routine : []).map(String))].filter((t) => treatments.has(t)).slice(0, 30);
  const st = await one(db().from('settings').select('terms_url,privacy_url').eq('id', 1).single());
  const needTerms = !!(st.terms_url && st.privacy_url);
  if (needTerms && b.terms !== true) throw new HttpError(400, 'Ga eerst akkoord met de voorwaarden en het privacybeleid');

  // Who is this? An existing login, an existing member record, or someone new
  const prof = (await one(db().from('profiles').select('id,role').eq('email', email)))[0];
  if (prof && prof.role !== 'member') throw new HttpError(409, 'Dit e-mailadres hoort bij een teamaccount. Gebruik een ander e-mailadres.');
  let m = (await one(db().from('members').select('*').eq('email', email)))[0];
  if (m && !['nieuw', 'opgezegd'].includes(m.status)) throw new HttpError(409, 'Je bent al member met dit e-mailadres. Log in om je membership te beheren.');
  let userId = prof ? prof.id : m && m.user_id;
  let fresh = false;
  if (!userId) {
    const { data, error } = await db().auth.admin.createUser({ email, email_confirm: true, user_metadata: { name } });
    if (error) throw new HttpError(400, /already|registered/i.test(error.message) ? 'Er bestaat al een account met dit e-mailadres. Log in.' : 'Account aanmaken lukte niet. Probeer het opnieuw.');
    userId = data.user.id; fresh = true;
  }
  const { data: u } = await db().auth.admin.getUserById(userId);
  const signedInBefore = !!(u && u.user && u.user.last_sign_in_at);
  const terms = needTerms ? { terms_accepted_at: new Date().toISOString() } : {};
  if (!m) {
    m = await one(db().from('members').insert({ user_id: userId, name, email, phone, plan_id: plan.id, routine, ...terms }).select().single());
  } else {
    // Someone who has logged in before keeps their own details; a new or never-used record takes the new ones
    const patch = { user_id: userId, plan_id: plan.id, next_plan_id: null, routine, ...terms, ...(signedInBefore ? {} : { name, phone }) };
    m = await one(db().from('members').update(patch).eq('id', m.id).select().single());
  }
  if (fresh || !signedInBefore) await db().from('profiles').update({ name: m.name }).eq('id', userId);
  await db().from('audit_log').insert({ action: 'checkout', entity: 'member', entity_id: m.id, details: { plan: plan.id, fresh } });
  return startFirstPayment(m, plan, b.method, APP_URL() + '/onboarding?betaald=1');
});
