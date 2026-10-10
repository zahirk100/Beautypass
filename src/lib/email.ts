// Branded e-mails, sent through Brevo (https://developers.brevo.com).
// Table layout with inline styles: that is what e-mail clients reliably render.
// Overview of every mail and when it is sent: docs/emails.md

export const SITE = "https://www.beautypass.nl";
const C = { plum: "#3a1828", rose: "#b8466e", champagne: "#e3c79f", ivory: "#fbf7f2", ink: "#22141b", muted: "#75626b" };
const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS = "'Jost', 'Helvetica Neue', Arial, sans-serif";
const SOFT = "rgba(251,247,242,.8)";
const LINE = "rgba(251,247,242,.16)";

export type Mail = { subject: string; html: string };

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const firstName = (name: unknown) => String(name ?? "").trim().split(/\s+/)[0] ?? "";

export const inviteUrl = (code: string) => `${SITE}/?ref=${encodeURIComponent(code)}`;
const whatsappShare = (code: string) =>
  `https://wa.me/?text=${encodeURIComponent(
    `Ik heb me aangemeld voor BeautyPass: één membership voor al je beauty-afspraken in Amsterdam. Meld je via mijn link aan, dan sta jij ook op de lijst: ${inviteUrl(code)}`,
  )}`;

const TZ = "Europe/Amsterdam";
export const when = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const day = (iso: string) => new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, day: "numeric", month: "long" }).format(new Date(iso));

// ─────────────────────────────── Building blocks ───────────────────────────────

type Footer = "waitlist" | "account" | "salon";
const FOOTERS: Record<Footer, string> = {
  waitlist: `Je krijgt deze mail omdat je je hebt aangemeld voor de wachtlijst op <a href="${SITE}" style="color:${C.muted};">beautypass.nl</a>.<br>Geen mails meer? Antwoord met &ldquo;afmelden&rdquo;.`,
  account: `Je krijgt deze mail omdat je een account hebt bij <a href="${SITE}" style="color:${C.muted};">BeautyPass</a>.<br>Vragen? Antwoord gewoon op deze mail.`,
  salon: `Je krijgt deze mail als partnersalon van <a href="${SITE}" style="color:${C.muted};">BeautyPass</a>.<br>Vragen? Antwoord gewoon op deze mail.`,
};

function layout(preheader: string, body: string, footer: Footer) {
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>BeautyPass</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;1,500&family=Jost:wght@400;500;600&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${C.ivory};font-variant-numeric:lining-nums;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
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
  ${FOOTERS[footer]} · <a href="${SITE}/privacy" style="color:${C.muted};">Privacy</a><br>BeautyPass · Amsterdam
</td></tr>
</table></td></tr></table></body></html>`;
}

const h1 = (html: string) =>
  `<h1 style="margin:0 0 14px;font-family:${SERIF};font-weight:500;font-size:34px;line-height:1.1;color:${C.ivory};">${html}</h1>`;
const h2 = (text: string) =>
  `<h2 style="margin:28px 0 12px;font-family:${SANS};font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:600;color:${C.champagne};">${text}</h2>`;
const p = (html: string, extra = "") => `<p style="margin:0 0 14px;color:${SOFT};${extra}">${html}</p>`;
const b = (html: string) => `<b style="color:${C.ivory};font-weight:500;">${html}</b>`;
const em = (html: string) => `<i style="color:${C.champagne};">${html}</i>`;
const divider = () => `<div style="height:1px;background:${LINE};margin:24px 0;"></div>`;

const button = (href: string, label: string) => `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 12px;"><tr><td style="border-radius:999px;background:${C.champagne};">
  <a href="${href}" style="display:inline-block;padding:15px 28px;font-family:${SANS};font-weight:600;font-size:15px;color:${C.plum};text-decoration:none;">${label} &rarr;</a>
</td></tr></table>`;
const textLink = (href: string, label: string) =>
  `<a href="${href}" style="color:${C.champagne};text-decoration:underline;">${label}</a>`;

/** Numbered steps: what happens next */
const steps = (items: string[]) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;">${items
  .map((t, i) => `<tr><td valign="top" style="width:30px;padding:0 0 12px;font-family:${SERIF};font-style:italic;font-size:22px;line-height:1.2;color:${C.champagne};">${i + 1}</td>
  <td style="padding:2px 0 12px;color:${SOFT};font-size:15px;line-height:1.55;">${t}</td></tr>`)
  .join("")}</table>`;

/** Label/value rows, e.g. appointment details */
const details = (rows: [string, string][]) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border-top:1px solid ${LINE};">${rows
  .map(([k, v]) => `<tr><td style="padding:11px 12px 11px 0;border-bottom:1px solid ${LINE};font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${C.champagne};font-weight:600;white-space:nowrap;vertical-align:top;">${k}</td>
  <td style="padding:11px 0;border-bottom:1px solid ${LINE};color:${C.ivory};font-size:15px;text-align:right;">${v}</td></tr>`)
  .join("")}</table>`;

const signoff = () => `<p style="margin:26px 0 0;font-family:${SERIF};font-size:20px;color:${C.ivory};">Tot snel,<br>${em("Team BeautyPass")}</p>`;

/** Big position number with what it means */
function spot(position: number, total: number) {
  const status = position <= 100
    ? `Je staat binnen de eerste 100`
    : `Nog ${position - 100} ${position - 100 === 1 ? "plek" : "plekken"} tot de eerste 100`;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};">
<tr><td style="padding:16px 0;width:1%;white-space:nowrap;font-family:${SERIF};font-variant-numeric:lining-nums;font-size:56px;line-height:1;color:${C.champagne};">#${position}</td>
<td style="padding:16px 0 16px 16px;font-family:${SANS};">
  <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:600;color:${C.champagne};">Jouw plek op de lijst</div>
  <div style="font-size:14px;color:rgba(251,247,242,.75);">van ${total} aanmeldingen · ${status}</div>
</td></tr></table>`;
}

/** How inviting works, with an example based on their own position */
function inviteBlock(code: string, position: number) {
  const example = position > 1
    ? p(`Voorbeeld: meldt één vriendin zich via jouw link aan, dan ga je van ${b(`#${position}`)} naar ${b(`#${Math.max(1, position - 10)}`)}.`)
    : p(`Je staat al bovenaan. Deel je link gerust: hoe sneller de lijst groeit, hoe sneller we openen.`);
  return `
${h2("Eerder aan de beurt")}
${p(`We sturen de uitnodigingen in volgorde van de lijst. Voor elke vriendin die zich aanmeldt via ${b("jouw persoonlijke link")}, ga je ${b("10 plekken vooruit")}.`)}
${example}
${button(whatsappShare(code), "Deel via WhatsApp")}
${p(`Of stuur je link zelf door: ${textLink(inviteUrl(code), inviteUrl(code).replace("https://", ""))}`, "font-size:13px;color:rgba(251,247,242,.6);")}`;
}

// ─────────────────────────────── Waitlist ───────────────────────────────

export function welcomeEmail(d: { name: string; position: number; total: number; code: string }): Mail {
  return {
    subject: `Je staat op de lijst: plek #${d.position}`,
    html: layout(`Wat BeautyPass is, wat er nu gebeurt en hoe je eerder aan de beurt bent.`, `
${h1(`Welkom, ${em(esc(firstName(d.name)))}`)}
${p(`Je staat op de wachtlijst voor ${b("BeautyPass")}: één membership voor al je beauty-afspraken in Amsterdam. Je betaalt een vast bedrag per maand en krijgt daarvoor credits. Daarmee boek je zelf je nagels, haar, brows of lashes bij geselecteerde salons, wanneer het jou uitkomt.`)}
${spot(d.position, d.total)}
${h2("Wat gebeurt er nu")}
${steps([
  `We starten in Amsterdam met een kleine groep leden. ${b("De eerste 100 leden worden founding member")}, met een speciaal tarief.`,
  `Vlak voor de start mailen we je een ${b("persoonlijke uitnodiging")}. Wie hoger op de lijst staat, krijgt die eerder.`,
  `Met die uitnodiging kies je je membership en boek je direct je eerste afspraak.`,
])}
${inviteBlock(d.code, d.position)}
${signoff()}`, "waitlist"),
  };
}

export function referralEmail(d: { name: string; friend: string; position: number; total: number; referrals: number; code: string }): Mail {
  const friend = esc(firstName(d.friend) || "Een vriendin");
  return {
    subject: `${firstName(d.friend) || "Een vriendin"} meldde zich aan via jouw link`,
    html: layout(`Je staat nu op plek #${d.position}.`, `
${h1(`Goed bezig, ${em(esc(firstName(d.name)))}`)}
${p(`${b(friend)} heeft zich aangemeld via jouw persoonlijke link. ${d.position === 1 ? "Je staat nu bovenaan de lijst." : "Daardoor ben je 10 plekken vooruitgegaan."}`)}
${p(`In totaal ${d.referrals === 1 ? "heeft 1 vriendin" : `hebben ${d.referrals} vriendinnen`} zich via jou aangemeld.`)}
${spot(d.position, d.total)}
${inviteBlock(d.code, d.position)}`, "waitlist"),
  };
}

// ─────────────────────────────── Account (Supabase Auth) ───────────────────────────────

export type AuthAction = "signup" | "recovery" | "magiclink" | "invite" | "email_change" | "email" | "reauthentication";

export function authEmail(action: AuthAction | string, d: { name?: string; url: string; token?: string; newEmail?: string }): Mail {
  const hi = firstName(d.name) ? `, ${em(esc(firstName(d.name)))}` : "";
  const code = d.token ? p(`Of vul deze code in: ${b(`<span style="font-size:20px;letter-spacing:.2em;">${esc(d.token)}</span>`)}`) : "";
  const expiry = p(`Deze link werkt één keer en is beperkt geldig. Heb je dit niet zelf aangevraagd? Dan kun je deze mail negeren.`, "font-size:13px;color:rgba(251,247,242,.6);");
  switch (action) {
    case "signup":
      return {
        subject: "Bevestig je e-mailadres",
        html: layout("Nog één stap: bevestig je e-mailadres.", `
${h1(`Welkom bij BeautyPass${hi}`)}
${p(`Fijn dat je er bent. Bevestig je e-mailadres om je account te activeren.`)}
${button(d.url, "Bevestig e-mailadres")}
${h2("Daarna")}
${steps([`Kies je membership in de app.`, `Wij activeren je membership en je credits staan klaar.`, `Boek je eerste behandeling bij een salon bij jou in de buurt.`])}
${expiry}`, "account"),
      };
    case "recovery":
      return {
        subject: "Stel een nieuw wachtwoord in",
        html: layout("Via deze link stel je een nieuw wachtwoord in.", `
${h1(`Nieuw wachtwoord${hi}`)}
${p(`We kregen een verzoek om je wachtwoord opnieuw in te stellen. Via de knop log je in en kies je onder ${b("Profiel")} een nieuw wachtwoord.`)}
${button(d.url, "Nieuw wachtwoord instellen")}
${expiry}`, "account"),
      };
    case "magiclink":
      return {
        subject: "Je inloglink voor BeautyPass",
        html: layout("Log in met één tik.", `
${h1(`Inloggen${hi}`)}
${p(`Tik op de knop om in te loggen. Je hebt geen wachtwoord nodig.`)}
${button(d.url, "Inloggen")}
${code}
${expiry}`, "account"),
      };
    case "invite":
      return {
        subject: "Je bent uitgenodigd voor BeautyPass",
        html: layout("Maak je account aan via deze link.", `
${h1(`Je bent uitgenodigd${hi}`)}
${p(`Je bent uitgenodigd om een account aan te maken bij BeautyPass. Tik op de knop en kies daarna in je profiel een wachtwoord.`)}
${button(d.url, "Account activeren")}
${expiry}`, "account"),
      };
    case "email_change":
      return {
        subject: "Bevestig je nieuwe e-mailadres",
        html: layout("Bevestig de wijziging van je e-mailadres.", `
${h1(`E-mailadres wijzigen${hi}`)}
${p(`Bevestig dat je voortaan ${b(esc(d.newEmail ?? "dit nieuwe adres"))} wilt gebruiken voor BeautyPass.`)}
${button(d.url, "Bevestig wijziging")}
${expiry}`, "account"),
      };
    default:
      return {
        subject: "Je verificatiecode voor BeautyPass",
        html: layout("Je verificatiecode.", `
${h1(`Je code${hi}`)}
${p(`Gebruik deze code om door te gaan:`)}
<p style="margin:0 0 18px;font-family:${SERIF};font-size:42px;letter-spacing:.2em;color:${C.champagne};">${esc(d.token ?? "")}</p>
${expiry}`, "account"),
      };
  }
}

// ─────────────────────────────── Membership ───────────────────────────────

export type MembershipEvent = {
  name: string; email: string; plan: string; monthly_credits: number;
  founding_number?: number | null; period_end?: string | null; balance?: number; resumed?: boolean;
};

export function membershipRequestedEmail(d: MembershipEvent): Mail {
  return {
    subject: "We hebben je aanvraag ontvangen",
    html: layout(`Je aanvraag voor ${d.plan} is binnen.`, `
${h1(`Bijna zover, ${em(esc(firstName(d.name)))}`)}
${p(`We hebben je aanvraag voor het membership ${b(esc(d.plan))} ontvangen: ${b(`${d.monthly_credits} credits per maand`)}.`)}
${h2("Wat gebeurt er nu")}
${steps([`We controleren je aanvraag. Dat duurt meestal minder dan een dag.`, `Je krijgt een mail zodra je membership actief is.`, `Dan staan je credits klaar en kun je direct boeken.`])}
${signoff()}`, "account"),
  };
}

export function adminMembershipRequestedEmail(d: MembershipEvent): Mail {
  return {
    subject: `Nieuwe aanvraag: ${d.name || d.email} (${d.plan})`,
    html: layout("Er wacht een membership op activatie.", `
${h1("Nieuwe aanvraag")}
${details([["Lid", esc(d.name || "–")], ["E-mail", esc(d.email)], ["Membership", esc(d.plan)]])}
${button(`${SITE}/admin/leden`, "Bekijk in beheer")}`, "account"),
  };
}

export function membershipActivatedEmail(d: MembershipEvent): Mail {
  const founding = d.founding_number ? `<br>Je bent ${b(`founding member nº ${d.founding_number}`)}.` : "";
  return {
    subject: d.resumed ? "Je membership is weer actief" : "Je membership is actief",
    html: layout(`Je credits staan klaar. Boek je eerste afspraak.`, `
${h1(d.resumed ? `Welkom terug, ${em(esc(firstName(d.name)))}` : `Je bent lid, ${em(esc(firstName(d.name)))}`)}
${p(`Je membership ${b(esc(d.plan))} is ${d.resumed ? "weer " : ""}actief.${founding}`)}
${details([
  ["Credits", `${d.balance ?? d.monthly_credits}`],
  ["Per maand", `${d.monthly_credits} credits`],
  ...(d.period_end ? ([["Volgende ronde", day(d.period_end)]] as [string, string][]) : []),
])}
${button(`${SITE}/app/boeken`, "Boek je eerste afspraak")}
${p(`Tip: annuleren is gratis tot 24 uur voor je afspraak. Daarna blijven de credits bij de salon.`, "font-size:13px;color:rgba(251,247,242,.6);")}
${signoff()}`, "account"),
  };
}

export function membershipPausedEmail(d: MembershipEvent): Mail {
  return {
    subject: "Je membership is gepauzeerd",
    html: layout("Je membership staat op pauze.", `
${h1(`Even pauze, ${em(esc(firstName(d.name)))}`)}
${p(`Je membership ${b(esc(d.plan))} staat op pauze. Je kunt in die tijd geen nieuwe afspraken boeken; geplande afspraken blijven gewoon staan.`)}
${p(`Wil je weer verder? Antwoord op deze mail, dan zetten we het voor je aan.`)}
${signoff()}`, "account"),
  };
}

export function membershipCancelledEmail(d: MembershipEvent): Mail {
  return {
    subject: "Je membership is opgezegd",
    html: layout("Bevestiging van je opzegging.", `
${h1(`Jammer dat je gaat, ${em(esc(firstName(d.name)))}`)}
${p(`Je membership ${b(esc(d.plan))} is opgezegd. Je account blijft bestaan, dus je kunt altijd weer instappen.`)}
${p(`We horen graag waarom je stopt. Antwoord op deze mail, ook een paar woorden helpen ons verder.`)}
${signoff()}`, "account"),
  };
}

export function creditsRenewedEmail(d: MembershipEvent): Mail {
  return {
    subject: `Je nieuwe credits staan klaar`,
    html: layout(`Er staan ${d.balance ?? d.monthly_credits} credits voor je klaar.`, `
${h1(`Nieuwe maand, ${em(esc(firstName(d.name)))}`)}
${p(`Je ${b(`${d.monthly_credits} nieuwe credits`)} van ${esc(d.plan)} zijn bijgeschreven.`)}
${details([["Je saldo", `${d.balance ?? d.monthly_credits} credits`], ...(d.period_end ? ([["Volgende ronde", day(d.period_end)]] as [string, string][]) : [])])}
${button(`${SITE}/app/boeken`, "Plan je volgende afspraak")}`, "account"),
  };
}

// ─────────────────────────────── Bookings ───────────────────────────────

export type BookingEvent = {
  booking_id: string; starts_at: string; credits: number; note?: string | null;
  treatment: string; member_name: string; member_email: string;
  salon_name: string; salon_address?: string; salon_district?: string;
};

const place = (d: BookingEvent) => [esc(d.salon_name), esc([d.salon_address, d.salon_district].filter(Boolean).join(", "))].filter(Boolean).join("<br>");
const bookingRows = (d: BookingEvent): [string, string][] => [
  ["Wanneer", esc(when(d.starts_at))],
  ["Behandeling", esc(d.treatment)],
  ["Salon", place(d)],
  ["Credits", String(d.credits)],
];
const appt = (d: BookingEvent) => `${SITE}/app/afspraken/${d.booking_id}`;

export function bookingConfirmedEmail(d: BookingEvent): Mail {
  return {
    subject: `Geboekt: ${d.treatment}, ${when(d.starts_at)}`,
    html: layout(`${d.treatment} bij ${d.salon_name}.`, `
${h1(`Je afspraak staat, ${em(esc(firstName(d.member_name)))}`)}
${details(bookingRows(d))}
${d.note ? p(`Je opmerking voor de salon: ${b(esc(d.note))}`) : ""}
${button(appt(d), "Bekijk je afspraak")}
${p(`${textLink(`${appt(d)}/agenda`, "Zet in je agenda")} · Gratis annuleren tot 24 uur vooraf.`, "font-size:13px;")}
${signoff()}`, "account"),
  };
}

export function bookingReminderEmail(d: BookingEvent): Mail {
  return {
    subject: `Morgen: ${d.treatment} bij ${d.salon_name}`,
    html: layout(`Je afspraak is ${when(d.starts_at)}.`, `
${h1(`Tot morgen, ${em(esc(firstName(d.member_name)))}`)}
${p(`Een herinnering aan je afspraak.`)}
${details(bookingRows(d))}
${button(appt(d), "Bekijk je afspraak")}
${p(`Kun je toch niet? Je kunt nog annuleren, maar omdat het binnen 24 uur is blijven de credits bij de salon.`, "font-size:13px;color:rgba(251,247,242,.6);")}`, "account"),
  };
}

export function bookingCancelledEmail(d: BookingEvent & { refunded: boolean }): Mail {
  return {
    subject: `Geannuleerd: ${d.treatment}, ${when(d.starts_at)}`,
    html: layout("Je afspraak is geannuleerd.", `
${h1("Afspraak geannuleerd")}
${p(d.refunded
  ? `Je afspraak is geannuleerd en je ${b(`${d.credits} credits`)} staan weer op je saldo.`
  : `Je afspraak is geannuleerd. Omdat dit binnen 24 uur voor de afspraak was, blijven de ${d.credits} credits bij de salon.`)}
${details(bookingRows(d).slice(0, 3))}
${button(`${SITE}/app/boeken`, "Nieuwe afspraak boeken")}`, "account"),
  };
}

export function bookingCancelledBySalonEmail(d: BookingEvent): Mail {
  return {
    subject: `${d.salon_name} heeft je afspraak geannuleerd`,
    html: layout("Je credits staan weer op je saldo.", `
${h1(`Sorry, ${em(esc(firstName(d.member_name)))}`)}
${p(`${b(esc(d.salon_name))} kan je afspraak helaas niet laten doorgaan. Je ${b(`${d.credits} credits`)} staan weer op je saldo.`)}
${details(bookingRows(d).slice(0, 3))}
${button(`${SITE}/app/boeken`, "Kies een ander moment")}`, "account"),
  };
}

export function bookingCompletedEmail(d: BookingEvent): Mail {
  return {
    subject: `Hoe was je ${d.treatment}?`,
    html: layout(`Laat ${d.salon_name} weten hoe het was.`, `
${h1(`Hoe was het, ${em(esc(firstName(d.member_name)))}?`)}
${p(`We hopen dat je hebt genoten van je ${esc(d.treatment)} bij ${b(esc(d.salon_name))}. Met een korte beoordeling help je andere leden kiezen, en de salon groeien.`)}
${button(`${SITE}/app/afspraken`, "Geef een beoordeling")}
${p(`Ook zin in een volgende? ${textLink(`${SITE}/app/boeken`, "Boek opnieuw")}.`, "font-size:14px;")}`, "account"),
  };
}

export function bookingNoShowEmail(d: BookingEvent): Mail {
  return {
    subject: `We hebben je gemist bij ${d.salon_name}`,
    html: layout("Je afspraak is als gemist geregistreerd.", `
${h1(`We hebben je gemist`)}
${p(`Je afspraak voor ${b(esc(d.treatment))} bij ${b(esc(d.salon_name))} op ${esc(when(d.starts_at))} is als gemist geregistreerd. De credits blijven daarom bij de salon.`)}
${p(`Klopt dit niet? Antwoord op deze mail, dan zoeken we het uit.`)}`, "account"),
  };
}

// Salon side: member shown as first name + initial
export function salonNewBookingEmail(d: BookingEvent & { member_short: string }): Mail {
  return {
    subject: `Nieuwe boeking: ${d.treatment}, ${when(d.starts_at)}`,
    html: layout(`${d.member_short} heeft geboekt.`, `
${h1("Nieuwe boeking")}
${details([["Wanneer", esc(when(d.starts_at))], ["Behandeling", esc(d.treatment)], ["Lid", esc(d.member_short)]])}
${d.note ? p(`Opmerking van het lid: ${b(esc(d.note))}`) : ""}
${button(`${SITE}/salon/agenda`, "Open je agenda")}`, "salon"),
  };
}

export function salonBookingCancelledEmail(d: BookingEvent & { member_short: string; late: boolean }): Mail {
  return {
    subject: `Geannuleerd: ${d.treatment}, ${when(d.starts_at)}`,
    html: layout(`${d.member_short} heeft geannuleerd.`, `
${h1("Boeking geannuleerd")}
${details([["Wanneer", esc(when(d.starts_at))], ["Behandeling", esc(d.treatment)], ["Lid", esc(d.member_short)]])}
${p(d.late
  ? `Dit is een ${b("late annulering")} (binnen 24 uur): je ontvangt de uitbetaling voor deze afspraak gewoon. Het tijdslot blijft voor je gereserveerd.`
  : `Het tijdslot is weer vrijgegeven, zodat een ander lid het kan boeken.`)}
${button(`${SITE}/salon/agenda`, "Open je agenda")}`, "salon"),
  };
}

// ─────────────────────────────── Sending ───────────────────────────────

type Sender = { name: string; email: string };
const sender = (): Sender => ({
  name: process.env.EMAIL_FROM_NAME ?? "BeautyPass",
  email: process.env.EMAIL_FROM ?? "hallo@beautypass.nl",
});
export const adminInbox = () => process.env.ADMIN_NOTIFY_EMAIL ?? sender().email;

/** Demo accounts (example.com) must never receive mail: bounces hurt the sender reputation */
export const deliverable = (email: unknown) =>
  typeof email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && !/@(example\.(com|org|net)|[^@]+\.(test|invalid|local))$/i.test(email);

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

export async function sendEmail(to: { email: string; name?: string }, mail: Mail) {
  if (!deliverable(to.email)) return;
  await brevo("/smtp/email", { sender: sender(), to: [to], replyTo: sender(), subject: mail.subject, htmlContent: mail.html });
}

/** Adds or updates the contact in the Brevo list used for launch mailings (BREVO_LIST_ID). */
export async function saveContact(d: { email: string; name: string; code?: string }) {
  if (!deliverable(d.email)) return;
  const list = Number(process.env.BREVO_LIST_ID);
  await brevo("/contacts", {
    email: d.email,
    updateEnabled: true,
    attributes: { FIRSTNAME: firstName(d.name), ...(d.code ? { REFERRAL_LINK: inviteUrl(d.code) } : {}) },
    ...(list ? { listIds: [list] } : {}),
  });
}
