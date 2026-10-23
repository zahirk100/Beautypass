// Membership changes that touch Mollie. Called by the member for themselves, or by the team
// (right "members") with member_id. Actions: pause, resume, cancel, plan, mandate, retry.
import { handler, currentUser, requirePerm, db, one, mollie, money, webhookUrl, APP_URL, HttpError, readJson, todayAms, addMonths, fmtDate } from './_lib.js';

async function load(user, memberId) {
  let m;
  if (memberId) {
    requirePerm(user, 'members');
    m = (await one(db().from('members').select('*').eq('id', memberId)))[0];
  } else {
    m = (await one(db().from('members').select('*').eq('user_id', user.id)))[0];
  }
  if (!m) throw new HttpError(404, 'Member niet gevonden');
  return m;
}

const audit = (user, action, m, details = {}) =>
  db().from('audit_log').insert({ actor: user.id, action, entity: 'member', entity_id: m.id, details });

async function cancelSubscription(m) {
  if (!m.mollie_customer_id || !m.mollie_subscription_id) return;
  await mollie('DELETE', `/customers/${m.mollie_customer_id}/subscriptions/${m.mollie_subscription_id}`).catch((e) => {
    if (!/not found|canceled|410|404/i.test(e.message)) throw e;
  });
}
async function newSubscription(m, plan, startDate) {
  const sub = await mollie('POST', `/customers/${m.mollie_customer_id}/subscriptions`, {
    amount: money(plan.price), interval: '1 month', startDate, description: `BeautyPass ${plan.name}`,
    mandateId: m.mandate_id || undefined, webhookUrl: webhookUrl(), metadata: { member_id: m.id },
  });
  return sub.id;
}

export default handler(async (req) => {
  const user = await currentUser(req);
  const body = await readJson(req);
  const m = await load(user, body.member_id);
  const byTeam = !!body.member_id;
  const settings = await one(db().from('settings').select('*').eq('id', 1).single());
  const plan = m.plan_id ? await one(db().from('plans').select('*').eq('id', m.plan_id).single()) : null;
  const today = todayAms();

  switch (body.action) {
    case 'pause': {
      const months = Number(body.months) === 2 ? 2 : 1;
      if (m.status !== 'actief') throw new HttpError(400, 'Alleen een actief membership kun je pauzeren');
      const since = addMonths(today, -12);
      const used = (await one(db().from('membership_pauses').select('months').eq('member_id', m.id).gte('starts', since))).reduce((n, p) => n + p.months, 0);
      if (!byTeam && used + months > settings.pause_months_per_year) {
        throw new HttpError(400, `Je kunt maximaal ${settings.pause_months_per_year} maanden per jaar pauzeren (al gebruikt: ${used})`);
      }
      // The paid period is not lost: billing resumes the given number of months after it ends
      const paidThrough = m.next_payment_date && m.next_payment_date > today ? m.next_payment_date : today;
      const resume = addMonths(paidThrough, months);
      await cancelSubscription(m);
      await one(db().from('membership_pauses').insert({ member_id: m.id, starts: today, ends: resume, months, paid_through: paidThrough }));
      await one(db().from('members').update({ status: 'gepauzeerd', paused_until: resume, mollie_subscription_id: null, next_payment_date: resume }).eq('id', m.id));
      await audit(user, 'pause', m, { months });
      return { until: resume };
    }
    case 'resume': {
      if (m.status !== 'gepauzeerd') throw new HttpError(400, 'Dit membership is niet gepauzeerd');
      if (!m.mandate_id) throw new HttpError(400, 'Er is geen betaalmethode vastgelegd');
      // Resuming early: what was already paid is not charged again
      const pause = (await one(db().from('membership_pauses').select('*').eq('member_id', m.id).order('created_at', { ascending: false }).limit(1)))[0];
      const start = pause && pause.paid_through && pause.paid_through > today ? pause.paid_through : today;
      const subId = await newSubscription(m, plan, start);
      await one(db().from('members').update({ status: 'actief', paused_until: null, mollie_subscription_id: subId, next_payment_date: start }).eq('id', m.id));
      // An early resume ends the pause today; a pause undone on the same day does not count
      if (pause && pause.ends > today) {
        if (today > pause.starts) await one(db().from('membership_pauses').update({ ends: today }).eq('id', pause.id));
        else await one(db().from('membership_pauses').delete().eq('id', pause.id));
      }
      await audit(user, 'resume', m);
      return {};
    }
    case 'cancel': {
      if (m.status === 'opgezegd' || m.status === 'nieuw') throw new HttpError(400, 'Dit membership loopt niet');
      // Runs until the end of the paid period; no new direct debits
      const end = m.next_payment_date && m.next_payment_date > today ? m.next_payment_date : today;
      await cancelSubscription(m);
      await one(db().from('members').update({ cancel_at: end, mollie_subscription_id: null, ...(end <= today || m.status !== 'actief' ? { status: 'opgezegd' } : {}) }).eq('id', m.id));
      // Appointments after the end date lapse
      await one(db().from('appointments').update({ status: 'geannuleerd', cancel_reason: byTeam ? 'team' : 'lid' }).eq('member_id', m.id).eq('status', 'gepland').gte('starts_at', end));
      await audit(user, 'cancel', m, { end });
      return { endsOn: end, endsOnText: fmtDate(end) };
    }
    case 'plan': {
      const to = (await one(db().from('plans').select('*').eq('id', body.plan).eq('active', true)))[0];
      if (!to) throw new HttpError(400, 'Kies een membership');
      if (!plan || to.id === plan.id) throw new HttpError(400, 'Dit is al je membership');
      if (!['actief', 'betaling mislukt'].includes(m.status)) throw new HttpError(400, 'Je membership is niet actief');
      if (m.mollie_subscription_id) {
        await mollie('PATCH', `/customers/${m.mollie_customer_id}/subscriptions/${m.mollie_subscription_id}`, { amount: money(to.price), description: `BeautyPass ${to.name}` });
      }
      if (Number(to.price) > Number(plan.price)) {
        // Upgrade: right away, the difference for the rest of this period is charged on the mandate
        const end = m.next_payment_date || addMonths(today, 1);
        const days = Math.max(0, (new Date(end) - new Date(today)) / 864e5);
        const diff = Math.round((Number(to.price) - Number(plan.price)) * Math.min(1, days / 30.44) * 100) / 100;
        await one(db().from('members').update({ plan_id: to.id, next_plan_id: null }).eq('id', m.id));
        if (diff >= 1 && m.mandate_id) {
          const pay = await mollie('POST', '/payments', { amount: money(diff), customerId: m.mollie_customer_id, mandateId: m.mandate_id, sequenceType: 'recurring',
            description: `BeautyPass upgrade naar ${to.name}`, webhookUrl: webhookUrl(), metadata: { member_id: m.id, kind: 'upgrade', plan: to.id } });
          await one(db().from('payments').insert({ member_id: m.id, kind: 'upgrade', description: `Upgrade naar ${to.name} (naar rato)`, mollie_payment_id: pay.id, amount: diff, status: 'open' }));
        }
        await audit(user, 'upgrade', m, { from: plan.id, to: to.id, diff });
        return { immediate: true };
      }
      // Downgrade: from the next period
      await one(db().from('members').update({ next_plan_id: to.id }).eq('id', m.id));
      await audit(user, 'downgrade', m, { from: plan.id, to: to.id });
      return { from: m.next_payment_date };
    }
    case 'mandate': {
      if (!m.mollie_customer_id) throw new HttpError(400, 'Er is nog geen betaalaccount');
      const method = { iDEAL: 'ideal', Creditcard: 'creditcard', 'SEPA-incasso': 'ideal' }[body.method] || 'ideal';
      const pay = await mollie('POST', '/payments', { amount: money(0.01), customerId: m.mollie_customer_id, sequenceType: 'first', method,
        description: 'BeautyPass · nieuwe betaalmethode', redirectUrl: APP_URL() + '/member/?betaald=1', webhookUrl: webhookUrl(), metadata: { member_id: m.id, kind: 'verificatie' } });
      await one(db().from('payments').insert({ member_id: m.id, kind: 'verificatie', description: 'Verificatie nieuwe betaalmethode', mollie_payment_id: pay.id, amount: 0.01, status: 'open' }));
      return { checkoutUrl: pay._links.checkout.href };
    }
    case 'retry': {
      requirePerm(user, 'members');
      if (m.status !== 'betaling mislukt' || !m.mandate_id) throw new HttpError(400, 'Er staat geen mislukte incasso open');
      const pay = await mollie('POST', '/payments', { amount: money(plan.price), customerId: m.mollie_customer_id, mandateId: m.mandate_id, sequenceType: 'recurring',
        description: `BeautyPass ${plan.name}`, webhookUrl: webhookUrl(), metadata: { member_id: m.id, kind: 'maand' } });
      await one(db().from('payments').insert({ member_id: m.id, kind: 'maand', description: `Membership ${plan.name} (opnieuw)`, mollie_payment_id: pay.id, amount: plan.price, status: 'open' }));
      await audit(user, 'retry_payment', m);
      return {};
    }
    default:
      throw new HttpError(400, 'Onbekende actie');
  }
});
