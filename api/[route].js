// One serverless function for all of /api (Vercel's Hobby plan allows at most 12). Each route lives in
// api/_routes/; only the names below are reachable, so helpers like _lib.js are never exposed.
import appConfig from './_routes/app-config.js';
import appointmentPay from './_routes/appointment-pay.js';
import checkoutStatus from './_routes/checkout-status.js';
import cronDaily from './_routes/cron-daily.js';
import demoCharge from './_routes/demo-charge.js';
import demoCheckout from './_routes/demo-checkout.js';
import firstAccess from './_routes/first-access.js';
import invoice from './_routes/invoice.js';
import memberEmail from './_routes/member-email.js';
import membershipChange from './_routes/membership-change.js';
import membershipCheckout from './_routes/membership-checkout.js';
import membershipStart from './_routes/membership-start.js';
import mollieCheck from './_routes/mollie-check.js';
import mollieWebhook from './_routes/mollie-webhook.js';
import notify from './_routes/notify.js';
import teamInvite from './_routes/team-invite.js';
import waitlistInvite from './_routes/waitlist-invite.js';

const routes = {
  'app-config': appConfig,
  'appointment-pay': appointmentPay,
  'checkout-status': checkoutStatus,
  'cron-daily': cronDaily,
  'demo-charge': demoCharge,
  'demo-checkout': demoCheckout,
  'first-access': firstAccess,
  'invoice': invoice,
  'member-email': memberEmail,
  'membership-change': membershipChange,
  'membership-checkout': membershipCheckout,
  'membership-start': membershipStart,
  'mollie-check': mollieCheck,
  'mollie-webhook': mollieWebhook,
  'notify': notify,
  'team-invite': teamInvite,
  'waitlist-invite': waitlistInvite,
};

export default function router(req, res) {
  const name = new URL(req.url, 'http://x').pathname.split('/')[2];
  const route = Object.hasOwn(routes, name) ? routes[name] : null;
  if (!route) { res.setHeader('Cache-Control', 'no-store'); return res.status(404).json({ ok: false, error: 'Niet gevonden' }); }
  return route(req, res);
}
