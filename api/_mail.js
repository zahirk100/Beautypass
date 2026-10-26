// Transactional e-mails through Brevo, in the BeautyPass style (ink, espresso, paper, Cormorant + Manrope).
import { env, APP_URL, fmtWhen, eur } from './_lib.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const first = (name) => esc(String(name || '').trim().split(/\s+/)[0]);
const SANS = "'Manrope','Helvetica Neue',Arial,sans-serif", SERIF = "'Cormorant Garamond',Georgia,'Times New Roman',serif";

function layout({ preheader, eyebrow, title, it, body }) {
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>BeautyPass</title></head>
<body style="margin:0;padding:0;background:#faf9f6;font-variant-numeric:lining-nums;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f6;"><tr><td align="center" style="padding:36px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding:0 4px 28px;font-family:${SANS};font-size:15px;letter-spacing:.32em;color:#1d1a17;">BEAUTYPASS</td></tr>
<tr><td style="background:#ffffff;border:1px solid #e6e0d6;border-radius:24px;padding:36px 32px;font-family:${SANS};font-size:15px;line-height:1.6;color:#5f5850;">
<p style="margin:0 0 10px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:600;color:#958c80;">${esc(eyebrow)}</p>
<h1 style="margin:0 0 18px;font-family:${SERIF};font-weight:500;font-size:38px;line-height:1.05;color:#1d1a17;">${title}${it ? ` <i style="font-weight:400;">${it}</i>` : ''}</h1>
${body}
</td></tr>
<tr><td style="padding:22px 4px 0;font-family:${SANS};font-size:12px;line-height:1.6;color:#958c80;">BeautyPass house · Amsterdam · <a href="${APP_URL()}" style="color:#958c80;">beautypass.nl</a><br>Vragen? Antwoord gewoon op deze mail.</td></tr>
</table></td></tr></table></body></html>`;
}
const p = (html) => `<p style="margin:0 0 16px;">${html}</p>`;
const b = (html) => `<b style="color:#1d1a17;font-weight:600;">${html}</b>`;
const button = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;"><tr><td style="border-radius:999px;background:#1d1a17;"><a href="${href}" style="display:inline-block;padding:15px 30px;font-family:${SANS};font-weight:600;font-size:15px;color:#ffffff;text-decoration:none;">${label}</a></td></tr></table>`;
const rows = (list) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;border-top:1px solid #e6e0d6;">${list.map(([k, v]) =>
  `<tr><td style="padding:11px 12px 11px 0;border-bottom:1px solid #e6e0d6;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#958c80;font-weight:600;white-space:nowrap;vertical-align:top;">${k}</td><td style="padding:11px 0;border-bottom:1px solid #e6e0d6;color:#1d1a17;font-size:15px;text-align:right;">${v}</td></tr>`).join('')}</table>`;

const hhmm = (ts) => new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
// One appointment, or a routine visit (a.segments: its treatments, some at the same time)
const apptRows = (a) => a.segments ? rows([['Wanneer', esc(fmtWhen(a.starts_at)) + ' – ' + hhmm(a.ends_at)],
  ['Behandelingen', a.segments.map((x) => `${hhmm(x.starts_at)} ${esc(x.treatment)}<br><span style="font-size:13px;color:#958c80;">${esc(x.staff)}</span>`).join('<br>')],
  ['Waar', 'BeautyPass house · Amsterdam'],
  ...(a.extra > 0 ? [['Los af te rekenen', eur(a.extra) + ' in de salon']] : []),
  ...(a.kids > 0 && a.status !== 'geannuleerd' ? [['Kinderhoek', a.kids === 1 ? 'Gereserveerd voor 1 kind' : `Gereserveerd voor ${a.kids} kinderen`]] : [])])
  : rows([['Wanneer', esc(fmtWhen(a.starts_at))], ['Behandeling', esc(a.treatment)], ['Specialist', esc(a.staff)], ['Waar', 'BeautyPass house · Amsterdam'],
  ...(a.kids > 0 && a.status !== 'geannuleerd' ? [['Kinderhoek', a.kids === 1 ? 'Gereserveerd voor 1 kind' : `Gereserveerd voor ${a.kids} kinderen`]] : [])]);

export const mails = {
  welcome: (m, plan) => ({
    subject: `Welkom bij BeautyPass, ${String(m.name || '').split(' ')[0]}`,
    html: layout({ preheader: `Je ${plan.name}-membership is actief.`, eyebrow: 'Welkom bij BeautyPass', title: `${first(m.name)},`, it: "you're in.",
      body: p(`Je ${b(esc(plan.name))}-membership is actief. Je hebt elke maand ${b(plan.per_month + ' behandelingen')} tegoed, en die kun je nu al plannen.`)
        + rows([['Membership', esc(plan.name)], ['Per maand', eur(plan.price)], ['Behandelingen', plan.per_month + ' per maand']])
        + button(APP_URL() + '/member/', 'Plan je eerste behandeling')
        + `<p style="margin:16px 0 0;font-size:13px;color:#958c80;">Inloggen doe je met je e-mailadres ${esc(m.email)}: je krijgt dan een code per mail. Je betaalt maandelijks automatisch via Mollie en je kunt maandelijks opzeggen.</p>` }),
  }),
  booked: (m, a) => ({
    subject: `Bevestigd: ${a.treatment}, ${fmtWhen(a.starts_at)}`,
    html: layout({ preheader: `${a.treatment} · ${fmtWhen(a.starts_at)}`, eyebrow: 'Bevestigd', title: `${first(m.name)},`, it: 'see you soon.',
      body: p('Je afspraak staat vast. We kijken ernaar uit.') + apptRows(a) + (a.note ? p(`Je opmerking: ${b(esc(a.note))}`) : '')
        + button(APP_URL() + '/member/', 'Bekijk je afspraak')
        + `<p style="margin:16px 0 0;font-size:13px;color:#958c80;">Kosteloos annuleren of verzetten tot ${a.cancel_hours} uur van tevoren.</p>` }),
  }),
  reminder: (m, a) => ({
    subject: `Morgen: ${a.treatment} bij BeautyPass`,
    html: layout({ preheader: `Je afspraak is ${fmtWhen(a.starts_at)}.`, eyebrow: 'Herinnering', title: 'Tot', it: 'morgen.',
      body: p(`${first(m.name)}, een kleine herinnering aan je afspraak.`) + apptRows(a) + button(APP_URL() + '/member/', 'Bekijk je afspraak') }),
  }),
  cancelled: (m, a) => ({
    subject: `Geannuleerd: ${a.treatment}, ${fmtWhen(a.starts_at)}`,
    html: layout({ preheader: 'Je afspraak is geannuleerd.', eyebrow: 'Geannuleerd', title: 'Afspraak', it: 'geannuleerd.',
      body: p(a.cancel_reason === 'team' ? 'Helaas moeten we je afspraak annuleren. Onze excuses; plan gerust een nieuw moment.' : a.late_cancel ? `Je afspraak is geannuleerd. Omdat dit binnen ${a.cancel_hours} uur voor de afspraak was, telt de behandeling mee voor deze maand.` : 'Je afspraak is geannuleerd. De behandeling staat weer in je maandtegoed.')
        + (a.refunded ? p(`Je betaling van ${b(eur(a.paid_amount))} storten we terug; dat duurt meestal een paar werkdagen.`) : '')
        + apptRows(a) + button(APP_URL() + '/member/', 'Plan een nieuw moment') }),
  }),
  paymentFailed: (m, plan) => ({
    subject: 'Je betaling voor BeautyPass is niet gelukt',
    html: layout({ preheader: 'Werk je betaling bij om te blijven boeken.', eyebrow: 'Betaling', title: 'Even', it: 'bijwerken.',
      body: p(`${first(m.name)}, de maandelijkse incasso van ${b(eur(plan.price))} voor je ${esc(plan.name)}-membership is niet gelukt. Zolang dit openstaat, kun je geen nieuwe afspraken boeken.`)
        + button(APP_URL() + '/member/', 'Nu betalen')
        + `<p style="margin:16px 0 0;font-size:13px;color:#958c80;">Je kunt het openstaande bedrag direct in de app betalen. Vragen? Antwoord op deze mail.</p>` }),
  }),
  paidTooLate: (m, x) => ({
    subject: 'Je betaling komt terug',
    html: layout({ preheader: 'Je reservering was al verlopen; we storten het bedrag terug.', eyebrow: 'Betaling', title: 'Even', it: 'teruggestort.',
      body: p(`${first(m.name)}, je betaling van ${b(eur(x.amount))} voor ${b(esc(x.treatment))} kwam binnen nadat je reservering was verlopen. We storten het bedrag terug; dat duurt meestal een paar werkdagen.`)
        + button(APP_URL() + '/member/', 'Plan opnieuw') }),
  }),
  slotFree: (m, w) => ({
    subject: `Er is plek: ${w.treatment} op ${w.dateText}`,
    html: layout({ preheader: `Er is een tijd vrijgekomen op ${w.dateText}.`, eyebrow: 'Plek vrij', title: 'Goed', it: 'nieuws.',
      body: p(`${first(m.name)}, op ${b(esc(w.dateText))} is er weer plek voor ${b(esc(w.treatment))}. Wie het eerst boekt, heeft hem.`)
        + button(APP_URL() + '/member/', 'Nu boeken')
        + `<p style="margin:16px 0 0;font-size:13px;color:#958c80;">Je kreeg deze mail omdat je vroeg om een seintje voor deze dag.</p>` }),
  }),
  reviewAsk: (m, a) => ({
    subject: `Hoe was je ${a.treatment}?`,
    html: layout({ preheader: 'Laat in een paar seconden weten hoe het was.', eyebrow: 'Jouw mening', title: 'Hoe was', it: 'het?',
      body: p(`${first(m.name)}, bedankt voor je bezoek. Hoe vond je je ${b(esc(a.treatment))} bij ${esc(a.staff)}? Met je beoordeling maken we BeautyPass elke keer beter.`)
        + button(APP_URL() + '/member/?review=' + encodeURIComponent(a.id), 'Geef je beoordeling') }),
  }),
  invite: (email) => ({
    subject: 'Je First access tot BeautyPass staat klaar',
    html: layout({ preheader: 'Je uitnodiging voor BeautyPass Amsterdam.', eyebrow: 'Amsterdam · First access', title: "You're", it: 'invited.',
      body: p('Je stond op onze First access-lijst, en nu is het zover: je kunt als een van de eersten member worden van BeautyPass. Bekijk de memberships, kies je routine en plan je eerste behandeling.')
        + button(APP_URL() + '/onboarding?email=' + encodeURIComponent(email), 'Word member')
        + `<p style="margin:16px 0 0;font-size:13px;color:#958c80;">Een uitnodiging reserveert nog geen membership; we openen in rondes.</p>` }),
  }),
};

// Demo/test addresses never get mail (bounces hurt the sender reputation)
export const deliverable = (email) => typeof email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && !/@(example\.(com|org|net)|[^@]+\.(test|invalid|local))$/i.test(email);

export async function sendMail(to, mail) {
  if (!deliverable(to.email)) return { skipped: true };
  const key = env('BREVO_API_KEY');
  if (!key) { console.warn('mail_skipped_no_key', mail.subject); return { skipped: true }; }
  const sender = { name: env('EMAIL_FROM_NAME', 'BeautyPass'), email: env('EMAIL_FROM', 'hallo@beautypass.nl') };
  // A mail must never break the action that triggered it (payment, booking): failures are only logged
  let res;
  try {
    res = await fetch(env('BREVO_API_URL', 'https://api.brevo.com/v3') + '/smtp/email', {
      method: 'POST', headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender, replyTo: sender, to: [{ email: to.email, name: to.name || undefined }], subject: mail.subject, htmlContent: mail.html }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) { console.warn('brevo_unreachable', mail.subject, e && e.message); return { ok: false }; }
  if (!res.ok) { console.warn('brevo_error', res.status, (await res.text()).slice(0, 200)); return { ok: false }; }
  return { ok: true };
}
