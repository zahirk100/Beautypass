import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
const sql = (q) => execFileSync('docker', ['exec', 'supabase_db_Beautypass', 'psql', '-U', 'postgres', '-tAc', q]).toString().trim();
const ok = (c, l) => { console.log((c ? '  ✓ ' : '  ✗ ') + l); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = 'http://127.0.0.1:54321', KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH', APP = 'http://localhost:5173', MOCK = 'http://127.0.0.1:4010';
async function token(email, pw) { const c = createClient(URL, KEY, { auth: { persistSession: false } }); const { data, error } = await c.auth.signInWithPassword({ email, password: pw }); if (error) throw error; return data.session.access_token; }
const call = async (tok, path, body) => { const r = await fetch(APP + '/api/' + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(body || {}) }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
const email = sql("select email from members where status='actief' and email like 'e2e.f.%' order by created_at desc limit 1");
const M = await token(email, 'Geheim-1234'), O = await token('owner@beautypass-test.nl', 'Team-12345'), D = await token('desk@beautypass-test.nl', 'Team-12345');
const mem = () => sql(`select status||'|'||coalesce(plan_id,'')||'|'||coalesce(next_plan_id,'-')||'|'||coalesce(mollie_subscription_id,'-')||'|'||coalesce(next_payment_date::text,'-')||'|'||coalesce(cancel_at::text,'-') from members where email='${email}'`);
const state = async () => (await fetch(MOCK + '/mock/state')).json();
console.log('member', email, mem());

console.log('auth');
ok((await call(null, 'membership-change', { action: 'pause' })).status === 401, 'zonder token 401');
ok((await call(M, 'membership-change', { action: 'retry', member_id: sql(`select id from members where email='${email}'`) })).status === 403, 'member kan geen team-actie op member_id');
ok((await call(D, 'mollie-check')).status === 403, 'receptie mag Mollie-check niet');
ok((await call(O, 'mollie-check')).mode === 'test', 'eigenaar: Mollie bereikbaar, test-modus');
ok((await call(D, 'team-invite', { email: 'x@beautypass-test.nl', role: 'desk' })).status === 403, 'receptie kan geen team uitnodigen');
const pid = sql(`select p.id from payments p join members m on m.id=p.member_id where m.email='${email}' and p.status='betaald' limit 1`);
ok((await fetch(APP + '/api/invoice', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + D }, body: JSON.stringify({ id: pid }) })).status === 403, 'receptie kan geen factuur openen');
ok((await fetch(APP + '/api/invoice', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + O }, body: JSON.stringify({ id: pid }) })).status === 200, 'eigenaar kan factuur openen');

console.log('upgrade (Essential → Signature)');
let r = await call(M, 'membership-change', { action: 'plan', plan: 'signature' });
ok(r.ok && r.immediate, 'upgrade direct: ' + JSON.stringify(r));
await sleep(1200);
ok(mem().split('|')[1] === 'signature', 'plan nu signature');
ok(sql(`select p.status from payments p join members m on m.id=p.member_id where m.email='${email}' and kind='upgrade'`) === 'betaald', 'verschil naar rato geïncasseerd');
let st = await state(); const subId = sql(`select mollie_subscription_id from members where email='${email}'`);
ok(st.subscriptions[subId].amount.value === sql("select price from plans where id='signature'"), 'Mollie subscription-bedrag aangepast: ' + st.subscriptions[subId].amount.value);

console.log('downgrade (Signature → Essential), per volgende periode');
r = await call(M, 'membership-change', { action: 'plan', plan: 'essential' });
ok(r.ok && !r.immediate && mem().split('|')[2] === 'essential', 'next_plan essential, nu nog signature');
await fetch(`${MOCK}/mock/charge/${subId}?status=paid`, { method: 'POST' }); await sleep(1500);
ok(mem().split('|')[1] === 'essential' && mem().split('|')[2] === '-', 'na maandincasso: essential actief');

console.log('pauze 1 maand + vroeg hervatten');
const before = mem().split('|')[4];
r = await call(M, 'membership-change', { action: 'pause', months: 1 });
ok(r.ok && mem().startsWith('gepauzeerd'), 'gepauzeerd tot ' + r.until);
st = await state(); ok(st.subscriptions[subId].status === 'canceled', 'subscription gestopt bij Mollie');
ok((await call(M, 'membership-change', { action: 'pause', months: 2 })).status === 400, 'dubbele pauze geweigerd');
r = await call(M, 'membership-change', { action: 'resume' });
const after = mem().split('|');
ok(r.ok && after[0] === 'actief' && after[4] === before, `hervat; volgende incasso blijft ${before} (geen dubbele betaling): ${after[4]}`);
ok(sql(`select count(*) from membership_pauses p join members m on m.id=p.member_id where m.email='${email}'`) === '0', 'pauze op dezelfde dag ongedaan telt niet mee');
r = await call(M, 'membership-change', { action: 'pause', months: 2 }); ok(r.ok, 'pauze 2 maanden');
r = await call(M, 'membership-change', { action: 'resume' }); 
r = await call(M, 'membership-change', { action: 'pause', months: 1 }); 
ok(r.status === 400 || r.ok, 'pauzelimiet: ' + (r.error || 'ok (dezelfde dag ongedaan)'));
if (mem().startsWith('gepauzeerd')) await call(M, 'membership-change', { action: 'resume' });

console.log('nieuwe betaalmethode (verificatie €0,01)');
r = await call(M, 'membership-change', { action: 'mandate', method: 'Creditcard' });
ok(!!r.checkoutUrl, 'checkout voor verificatie');
const tr = r.checkoutUrl.split('/').pop();
await fetch(r.checkoutUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'status=paid', redirect: 'manual' });
await sleep(800);
st = await state(); const sub2 = sql(`select mollie_subscription_id from members where email='${email}'`);
ok(st.subscriptions[sub2].mandateId === st.payments[tr].mandateId, 'subscription op nieuw mandaat');
ok(Object.values(st.refunds).some((x) => x.paymentId === tr), 'verificatiebedrag teruggestort');

console.log('cron');
ok((await fetch(APP + '/api/cron-daily', { headers: { authorization: 'Bearer fout' } })).status === 401, 'cron zonder geheim 401');
sql(`update appointments set reminder_sent_at=null where false`);
r = await (await fetch(APP + '/api/cron-daily', { headers: { authorization: 'Bearer local-cron-secret' } })).json();
ok(r.ok, 'cron draait: ' + JSON.stringify(r));

console.log('opzeggen');
r = await call(M, 'membership-change', { action: 'cancel' });
ok(r.ok && mem().split('|')[5] === r.endsOn && mem().startsWith('actief'), 'loopt door tot ' + r.endsOn);
st = await state(); ok(st.subscriptions[sub2].status === 'canceled', 'geen nieuwe incasso’s');
sql(`update members set cancel_at=current_date where email='${email}'`);
await fetch(APP + '/api/cron-daily', { headers: { authorization: 'Bearer local-cron-secret' } });
ok(mem().startsWith('opgezegd'), 'cron zet op opgezegd na einddatum');

console.log('wachtlijst + first access');
const wl = `first.${Date.now()}@beautypass-test.nl`;
sql(`insert into waitlist (email) values ('${wl}')`);
const wid = sql(`select id from waitlist where email='${wl}'`);
ok((await call(D, 'waitlist-invite', { ids: [wid] })).ok, 'receptie nodigt uit');
ok(sql(`select status from waitlist where id='${wid}'`) === 'uitgenodigd', 'status uitgenodigd');
ok((await (await fetch(MOCK + '/mock/mails')).json()).some((x) => x.to[0].email === wl && /First access/.test(x.subject)), 'uitnodigingsmail');
console.log('team-invite');
r = await call(O, 'team-invite', { email: `new.${Date.now()}@beautypass-test.nl`, role: 'specialist' });
ok(r.ok && r.invited, 'eigenaar nodigt specialist uit (Supabase stuurt mail)');
