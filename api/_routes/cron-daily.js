// Daily at 07:00 (vercel.json): reminders for tomorrow, memberships that end, pauses that end, downgrades.
import { timingSafeEqual } from 'node:crypto';
import { db, one, env, mollie, money, webhookUrl, todayAms, addMonths } from '../_lib.js';
import { mails, sendMail } from '../_mail.js';
import { visitInfo } from './notify.js';

const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

export default async function cron(req, res) {
  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!env('CRON_SECRET') || !same(auth, env('CRON_SECRET'))) return res.status(401).end();
  const today = todayAms(), tomorrow = todayAms(1);
  const done = { reminders: 0, completed: 0, reviews: 0, ended: 0, resumed: 0, downgraded: 0 };
  try {
    await db().rpc('release_expired_holds');
    // Reminders for tomorrow's appointments (members who want them)
    const from = new Date(tomorrow + 'T00:00:00+01:00').toISOString(), to = new Date(addMonths(tomorrow, 0) + 'T23:59:59+02:00').toISOString();
    const appts = await one(db().from('appointments').select('*, treatments(name), staff(name), members(name,email,prefs)')
      .eq('status', 'gepland').eq('is_primary', true).eq('confirmed', true).is('reminder_sent_at', null).gte('starts_at', from).lte('starts_at', to));
    const settings = await one(db().from('settings').select('cancel_hours').eq('id', 1).single());
    const visitsDone = new Set();
    for (const a of appts) {
      if (new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date(a.starts_at)) !== tomorrow) continue;
      if (a.members.prefs && a.members.prefs.reminders === false) continue;
      if (a.visit_id) {
        // a routine visit: one reminder for all its treatments
        if (!visitsDone.has(a.visit_id)) {
          visitsDone.add(a.visit_id);
          await sendMail({ email: a.members.email, name: a.members.name }, mails.reminder(a.members, (await visitInfo(a, settings)).info));
          done.reminders++;
        }
        await one(db().from('appointments').update({ reminder_sent_at: new Date().toISOString() }).eq('id', a.id));
        continue;
      }
      await sendMail({ email: a.members.email, name: a.members.name }, mails.reminder(a.members, { ...a, treatment: a.treatments.name, staff: a.staff.name, cancel_hours: settings.cancel_hours }));
      await one(db().from('appointments').update({ reminder_sent_at: new Date().toISOString() }).eq('id', a.id));
      done.reminders++;
    }
    // Checked in and over: completed, so the team does not have to close every appointment by hand
    try {
      const closed = await one(db().from('appointments').update({ status: 'afgerond', updated_at: new Date().toISOString() })
        .eq('status', 'gepland').not('checked_in_at', 'is', null).lt('ends_at', new Date().toISOString()).select('id,is_primary'));
      done.completed = closed.filter((x) => x.is_primary).length;
    } catch (e) { console.error('cron_complete_failed', e && e.message); }
    // "Hoe was je behandeling?" for yesterday's completed treatments (once, members who want mails)
    try {
      const yday = todayAms(-1);
      const finished = await one(db().from('appointments').select('*, treatments(name), staff(name), members(name,email,prefs)')
        .eq('status', 'afgerond').eq('is_primary', true).is('review_asked_at', null).gte('starts_at', yday + 'T00:00:00Z').lt('starts_at', today + 'T23:59:59Z'));
      for (const a of finished) {
        if (new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date(a.starts_at)) !== yday) continue;
        const has = await one(db().from('reviews').select('appointment_id').eq('appointment_id', a.id));
        await one(db().from('appointments').update({ review_asked_at: new Date().toISOString() }).eq('id', a.id));
        // a routine visit: ask once (about its first treatment)
        const later = a.visit_id && (await one(db().from('appointments').select('id').eq('visit_id', a.visit_id).eq('status', 'afgerond').lt('starts_at', a.starts_at))).length;
        if (has.length || later || (a.members.prefs && a.members.prefs.reminders === false)) continue;
        await sendMail({ email: a.members.email, name: a.members.name }, mails.reviewAsk(a.members, { ...a, treatment: a.treatments.name, staff: a.staff.name }));
        done.reviews++;
      }
    } catch (e) { console.error('cron_reviews_failed', e && e.message); }
    // Cancelled memberships whose paid period is over
    const ending = await one(db().from('members').select('id').lte('cancel_at', today).neq('status', 'opgezegd'));
    for (const m of ending) { await one(db().from('members').update({ status: 'opgezegd' }).eq('id', m.id)); done.ended++; }
    // Pauses that end today: start billing again
    const paused = await one(db().from('members').select('*').eq('status', 'gepauzeerd').lte('paused_until', today));
    for (const m of paused) try {
      const plan = await one(db().from('plans').select('*').eq('id', m.next_plan_id || m.plan_id).single());
      const sub = await mollie('POST', `/customers/${m.mollie_customer_id}/subscriptions`, { amount: money(plan.price), interval: '1 month', startDate: today,
        description: `BeautyPass ${plan.name}`, mandateId: m.mandate_id || undefined, webhookUrl: webhookUrl(), metadata: { member_id: m.id } });
      await one(db().from('members').update({ status: 'actief', paused_until: null, plan_id: plan.id, next_plan_id: null, mollie_subscription_id: sub.id, next_payment_date: addMonths(today, 1) }).eq('id', m.id));
      done.resumed++;
    } catch (e) { console.error('cron_resume_failed', m.id, e && e.message); done.failed = (done.failed || 0) + 1; }
    // Downgrades start with the new period (normally already done by the webhook of that month's payment)
    const down = await one(db().from('members').select('id,next_plan_id,next_payment_date').not('next_plan_id', 'is', null).lte('next_payment_date', today));
    for (const m of down) { await one(db().from('members').update({ plan_id: m.next_plan_id, next_plan_id: null }).eq('id', m.id)); done.downgraded++; }
    // Checkouts that were never paid and never used (no login): removed after 3 days, so no stray accounts remain
    try {
      const stale = await one(db().from('members').select('id,user_id').eq('status', 'nieuw').lt('created_at', new Date(Date.now() - 3 * 864e5).toISOString()));
      for (const m of stale) {
        if ((await one(db().from('payments').select('id').eq('member_id', m.id).eq('status', 'betaald'))).length) continue;
        if (m.user_id) {
          const { data } = await db().auth.admin.getUserById(m.user_id);
          if (data && data.user && data.user.last_sign_in_at) continue;
        }
        await one(db().from('members').delete().eq('id', m.id));
        if (m.user_id) await db().auth.admin.deleteUser(m.user_id);
        done.cleaned = (done.cleaned || 0) + 1;
      }
    } catch (e) { console.error('cron_cleanup_failed', e && e.message); }
    return res.status(200).json({ ok: true, ...done });
  } catch (e) {
    console.error('cron_error', e && e.message);
    return res.status(500).json({ ok: false, ...done });
  }
}
