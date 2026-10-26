// The database reports new and cancelled appointments here (migration 002, pg_net); we send the mail.
import { timingSafeEqual } from 'node:crypto';
import { db, one, readJson, env, mollie } from '../_lib.js';
import { mails, sendMail } from '../_mail.js';

const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

// A paid single treatment is refunded when the member cancels in time, or when the salon cancels.
// The payment is claimed first (betaald → terugbetaald), so a repeated call never refunds twice.
async function refund(a) {
  if (a.late_cancel && a.cancel_reason !== 'team') return false;
  const paid = await one(db().from('payments').select('*').eq('appointment_group', a.group_id).eq('kind', 'los').eq('status', 'betaald'));
  let done = false;
  for (const p of paid) {
    const claimed = await one(db().from('payments').update({ status: 'terugbetaald' }).eq('id', p.id).eq('status', 'betaald').select());
    if (!claimed.length) continue;
    try {
      await mollie('POST', `/payments/${p.mollie_payment_id}/refunds`, { amount: { currency: 'EUR', value: Number(p.amount).toFixed(2) }, description: 'BeautyPass · geannuleerde afspraak' });
      done = true;
    } catch (e) {
      console.error('refund_failed', p.id, e && e.message);
      await one(db().from('payments').update({ status: 'betaald' }).eq('id', p.id));
      await db().from('audit_log').insert({ action: 'refund_failed', entity: 'payment', entity_id: p.id, details: { error: String(e && e.message).slice(0, 200) } });
    }
  }
  return done;
}

// A time came free: tell members waiting for that day, if their treatment now fits (each watch mails once)
async function waitingList(a) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date(a.starts_at));
  const watches = await one(db().from('slot_watches').select('*, members(name,email,status), treatments(name)').eq('date', date).is('notified_at', null));
  for (const w of watches) {
    if (!w.members || w.members.status !== 'actief') continue;
    const slots = await one(db().rpc('available_slots', { p_treatment: w.treatment_id, p_date: date }));
    if (!slots.length) continue;
    const claimed = await one(db().from('slot_watches').update({ notified_at: new Date().toISOString() }).eq('id', w.id).is('notified_at', null).select());
    if (!claimed.length) continue;
    const dateText = new Date(date + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
    await sendMail({ email: w.members.email, name: w.members.name }, mails.slotFree(w.members, { treatment: w.treatments.name, dateText }));
  }
}

// A routine visit: its treatments as one mail (claimed once per visit and kind)
export async function visitInfo(a, settings) {
  const segs = await one(db().from('appointments').select('*, treatments(name), staff(name)').eq('visit_id', a.visit_id).order('starts_at'));
  const live = segs.filter((x) => x.status !== 'geannuleerd');
  const list = live.length ? live : segs;
  return { segs, live, info: { ...list[0], starts_at: list[0].starts_at, ends_at: list.reduce((e, x) => (x.ends_at > e ? x.ends_at : e), list[0].ends_at),
    treatment: `je routine (${list.length} behandeling${list.length === 1 ? '' : 'en'})`, kids: Math.max(...list.map((x) => x.kids || 0)),
    extra: list.reduce((n, x) => n + Number(x.paid_amount || 0), 0), cancel_hours: settings.cancel_hours,
    segments: list.map((x) => ({ starts_at: x.starts_at, treatment: x.treatments.name, staff: x.staff.name })) } };
}
const claimVisit = async (id, col) => (await one(db().from('visits').update({ [col]: new Date().toISOString() }).eq('id', id).is(col, null).select('id'))).length > 0;

export default async function notify(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!env('NOTIFY_SECRET') || !same(req.headers['x-notify-secret'] || '', env('NOTIFY_SECRET'))) return res.status(401).end();
  try {
    const { event, appointment_id } = await readJson(req);
    const a = (await one(db().from('appointments').select('*, treatments(name), staff(name), members(name,email,prefs)').eq('id', appointment_id)))[0];
    if (!a) return res.status(200).end();
    const settings = await one(db().from('settings').select('cancel_hours').eq('id', 1).single());
    const info = { ...a, treatment: a.treatments.name, staff: a.staff.name, cancel_hours: settings.cancel_hours };
    const to = { email: a.members.email, name: a.members.name };
    if (a.visit_id && event === 'booked') {
      if (await claimVisit(a.visit_id, 'booked_mail_at')) await sendMail(to, mails.booked(a.members, (await visitInfo(a, settings)).info));
    } else if (a.visit_id && event === 'cancelled' && !(await visitInfo(a, settings)).live.length) {
      // the whole visit is cancelled: one mail
      if (await claimVisit(a.visit_id, 'cancelled_mail_at')) {
        const v = await visitInfo(a, settings);
        await sendMail(to, mails.cancelled(a.members, { ...v.info, cancel_reason: a.cancel_reason, late_cancel: a.late_cancel, extra: 0 }));
      }
    } else if (event === 'booked') await sendMail(to, mails.booked(a.members, info));
    else if (event === 'cancelled') {
      info.refunded = await refund(a);
      await sendMail(to, mails.cancelled(a.members, info));
    }
    if (event === 'cancelled' || event === 'freed') await waitingList(a);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('notify_error', e && e.message);
    return res.status(500).end();
  }
}
