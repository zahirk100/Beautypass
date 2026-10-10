# E-mails

Alle mails komen van **hallo@beautypass.nl** via Brevo, in de BeautyPass-stijl, en staan in code in
[`src/lib/email.ts`](../src/lib/email.ts). Antwoorden komen binnen in de mailbox van hallo@beautypass.nl.
Demo-adressen (`@example.com`) krijgen nooit mail.

| # | Moment | Ontvanger | Onderwerp | Bron |
|---|---|---|---|---|
| 1 | Aanmelding wachtlijst | aanmelder | Je staat op de lijst: plek #N | database → `/api/hooks/waitlist` (008) |
| 2 | Vriendin meldt zich aan via link | uitnodiger | Sara meldde zich aan via jouw link | idem |
| 3 | Account aanmaken | nieuw lid | Bevestig je e-mailadres | Supabase Auth → `/api/hooks/auth-email` |
| 4 | Wachtwoord vergeten | lid | Stel een nieuw wachtwoord in | idem |
| 5 | Inloglink / uitnodiging / e-mail wijzigen | lid | … | idem |
| 6 | Membership aangevraagd | lid + team (`ADMIN_NOTIFY_EMAIL`) | We hebben je aanvraag ontvangen | database → `/api/hooks/events` (009) |
| 7 | Membership actief (of hervat) | lid | Je membership is actief | idem |
| 8 | Membership gepauzeerd / opgezegd | lid | … | idem |
| 9 | Nieuwe maand credits | lid | Je nieuwe credits staan klaar | idem |
| 10 | Boeking | lid + salon (eigenaren en contactadres) | Geboekt: … / Nieuwe boeking: … | idem |
| 11 | Herinnering ±24 uur vooraf | lid | Morgen: … | pg_cron elk uur (009) |
| 12 | Annulering door lid | lid + salon | Geannuleerd: … (met of zonder credits terug) | idem |
| 13 | Annulering door salon | lid | Studio X heeft je afspraak geannuleerd | idem |
| 14 | Afspraak afgerond | lid | Hoe was je …? (beoordeling) | idem |
| 15 | Niet verschenen | lid | We hebben je gemist bij … | idem |

## Instellingen

Vercel (Environment Variables):

| Naam | Waarvoor |
|---|---|
| `BREVO_API_KEY` | versturen via Brevo |
| `BREVO_LIST_ID` | wachtlijst-contacten in Brevo-lijst (voor lanceringsmails) |
| `WAITLIST_HOOK_SECRET` | database → website (wachtlijst en events); zelfde code als `private.settings` |
| `AUTH_EMAIL_HOOK_SECRET` | Supabase Auth → website; de `v1,whsec_…` code uit Supabase → Authentication → Hooks |
| `ADMIN_NOTIFY_EMAIL` | optioneel, waar meldingen voor het team heen gaan (standaard hallo@beautypass.nl) |
| `EMAIL_FROM` / `EMAIL_FROM_NAME` | optioneel, afzender |

Controle: `https://www.beautypass.nl/api/hooks/waitlist` (GET) toont welke instellingen aanwezig zijn.
Mislukte verzendingen vanuit de database: `select status_code, content from net._http_response order by created desc limit 10;`
