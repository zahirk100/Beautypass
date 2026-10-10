// Branded transactional e-mails, sent through Brevo (https://developers.brevo.com).
// Table layout with inline styles: that is what e-mail clients reliably render.

const SITE = "https://www.beautypass.nl";
const C = { plum: "#3a1828", rose: "#b8466e", champagne: "#e3c79f", ivory: "#fbf7f2", ink: "#22141b", muted: "#75626b", blush: "#fbeef1" };
const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS = "'Jost', 'Helvetica Neue', Arial, sans-serif";

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const inviteUrl = (code: string) => `${SITE}/?ref=${encodeURIComponent(code)}`;

function layout(preheader: string, body: string) {
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>BeautyPass</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;1,500&family=Jost:wght@400;500;600&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${C.ivory};font-variant-numeric:lining-nums;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ivory};"><tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 6px 20px;font-family:${SERIF};font-size:26px;color:${C.ink};">
  <span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:9px;background:${C.plum};color:${C.champagne};font-style:italic;font-weight:600;font-size:22px;vertical-align:middle;">B</span>
  <span style="vertical-align:middle;margin-left:8px;">Beauty<i style="color:${C.rose};">Pass</i></span>
</td></tr>
<tr><td style="background:${C.plum};border-radius:24px;padding:34px 30px;color:${C.ivory};font-family:${SANS};font-size:16px;line-height:1.6;">
${body}
</td></tr>
<tr><td style="padding:22px 8px 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted};text-align:center;">
  Je krijgt deze mail omdat je je hebt aangemeld op <a href="${SITE}" style="color:${C.muted};">beautypass.nl</a>.<br>
  Geen mails meer? Antwoord op deze mail met &ldquo;afmelden&rdquo;. · <a href="${SITE}/privacy" style="color:${C.muted};">Privacy</a><br>
  BeautyPass · Amsterdam
</td></tr>
</table></td></tr></table></body></html>`;
}

const h1 = (html: string) =>
  `<h1 style="margin:0 0 14px;font-family:${SERIF};font-weight:500;font-size:36px;line-height:1.08;color:${C.ivory};">${html}</h1>`;

const spot = (position: number, total: number) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;border-top:1px solid rgba(251,247,242,.16);border-bottom:1px solid rgba(251,247,242,.16);">
<tr><td style="padding:16px 0;width:1%;white-space:nowrap;font-family:${SERIF};font-variant-numeric:lining-nums;font-size:56px;line-height:1;color:${C.champagne};">#${position}</td>
<td style="padding:16px 0 16px 16px;font-family:${SANS};">
  <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:600;color:${C.champagne};">Jouw plek</div>
  <div style="font-size:14px;color:rgba(251,247,242,.75);">van ${total} op de lijst</div>
</td></tr></table>`;

const inviteBlock = (code: string) => `
<p style="margin:0 0 16px;color:rgba(251,247,242,.8);">Wil je eerder aan de beurt? <b style="color:${C.ivory};font-weight:500;">Elke vriendin die zich via jouw link aanmeldt, schuift je 10 plekken omhoog.</b></p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 10px;"><tr><td style="border-radius:999px;background:${C.champagne};">
  <a href="${inviteUrl(code)}" style="display:inline-block;padding:15px 28px;font-family:${SANS};font-weight:600;font-size:15px;color:${C.plum};text-decoration:none;">Deel jouw persoonlijke link &rarr;</a>
</td></tr></table>
<p style="margin:0;font-size:13px;color:rgba(251,247,242,.6);">Of kopieer: <a href="${inviteUrl(code)}" style="color:${C.champagne};">${inviteUrl(code).replace("https://", "")}</a></p>`;

export function welcomeEmail(p: { name: string; position: number; total: number; code: string }) {
  const first = esc(p.name.split(" ")[0]);
  return {
    subject: `Je staat op de lijst: plek #${p.position}`,
    html: layout(`Plek #${p.position} van ${p.total}. Zo kom je eerder aan de beurt.`, `
${h1(`Welkom op de lijst, <i style="color:${C.champagne};">${first}</i>`)}
<p style="margin:0;color:rgba(251,247,242,.8);">Fijn dat je erbij bent. Zodra BeautyPass in Amsterdam opent, krijg je als een van de eersten je persoonlijke link om een founding membership te claimen.</p>
${spot(p.position, p.total)}
${inviteBlock(p.code)}
<p style="margin:26px 0 0;font-family:${SERIF};font-size:20px;color:${C.ivory};">Tot snel,<br><i style="color:${C.champagne};">Team BeautyPass</i></p>`),
  };
}

export function referralEmail(p: { name: string; friend: string; position: number; total: number; referrals: number; code: string }) {
  const first = esc(p.name.split(" ")[0]);
  const friend = esc(p.friend.split(" ")[0]);
  const top = p.position === 1;
  return {
    subject: top ? `${p.friend.split(" ")[0]} heeft zich aangemeld via jouw link` : `Je bent gestegen naar plek #${p.position}`,
    html: layout(`${p.friend.split(" ")[0]} meldde zich aan via jouw link.`, `
${h1(`Goed bezig, <i style="color:${C.champagne};">${first}</i>`)}
<p style="margin:0;color:rgba(251,247,242,.8);"><b style="color:${C.ivory};font-weight:500;">${friend}</b> heeft zich via jouw link aangemeld${top ? ". Je staat bovenaan de lijst." : ", dus je bent 10 plekken gestegen."} In totaal ${p.referrals === 1 ? "is er 1 vriendin" : `zijn er ${p.referrals} vriendinnen`} via jou aangemeld.</p>
${spot(p.position, p.total)}
${inviteBlock(p.code)}`),
  };
}

type Sender = { name: string; email: string };
const sender = (): Sender => ({
  name: process.env.EMAIL_FROM_NAME ?? "BeautyPass",
  email: process.env.EMAIL_FROM ?? "hallo@beautypass.nl",
});

async function brevo(path: string, body: unknown) {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error("BREVO_API_KEY ontbreekt");
  const res = await fetch(`https://api.brevo.com/v3${path}`, {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Brevo ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export async function sendEmail(to: { email: string; name?: string }, mail: { subject: string; html: string }) {
  await brevo("/smtp/email", { sender: sender(), to: [to], replyTo: sender(), subject: mail.subject, htmlContent: mail.html });
}

/** Adds or updates the contact in the Brevo list used for launch mailings (BREVO_LIST_ID). */
export async function saveContact(p: { email: string; name: string; position?: number; code?: string }) {
  const list = Number(process.env.BREVO_LIST_ID);
  await brevo("/contacts", {
    email: p.email,
    updateEnabled: true,
    attributes: { FIRSTNAME: p.name.split(" ")[0], ...(p.code ? { REFERRAL_LINK: inviteUrl(p.code) } : {}) },
    ...(list ? { listIds: [list] } : {}),
  });
}
