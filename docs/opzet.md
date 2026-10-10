# BeautyPass: platform opzetten (eenmalig, ±10 minuten)

## 1. Database bijwerken (Supabase)
1. Open je project in Supabase → **SQL Editor** → **New query**.
2. Voer de migraties uit in volgorde, elk als eigen query (plakken → **Run**):
   - `001_waitlist.sql` (al gedaan)
   - [`002_platform.sql`](../supabase/migrations/002_platform.sql)
   - [`003_locations_favorites.sql`](../supabase/migrations/003_locations_favorites.sql)
   - [`004_salon_profiles_notes.sql`](../supabase/migrations/004_salon_profiles_notes.sql) (foto's, socials, opmerkingen)
   - [`005_media_keep_existing.sql`](../supabase/migrations/005_media_keep_existing.sql)
   - [`006_waitlist_referrals.sql`](../supabase/migrations/006_waitlist_referrals.sql) (wachtlijstpositie + uitnodigingslinks; de landingspagina gebruikt dit)
   - [`007_waitlist_is_new.sql`](../supabase/migrations/007_waitlist_is_new.sql) ("je staat al op de lijst" bij dubbele aanmelding)
   - [`008_waitlist_emails.sql`](../supabase/migrations/008_waitlist_emails.sql) (welkomstmail + mail bij uitnodiging, via Brevo; zie hieronder)
   - [`009_platform_emails.sql`](../supabase/migrations/009_platform_emails.sql) (mails bij membership en boekingen, herinneringen; zie [emails.md](emails.md))
   - Of in één keer 003 + 004 + 005 + demodata: [`supabase/seed/demo_alles_in_een.sql`](../supabase/seed/demo_alles_in_een.sql)
3. Wil je testen met voorbeelddata en testaccounts per rol? Zie [demo.md](demo.md).

## 2. Inloggen instellen (Supabase → Authentication → URL Configuration)
- **Site URL:** `https://beautypass-two.vercel.app` (later je eigen domein)
- **Redirect URLs:** voeg toe:
  - `https://beautypass-two.vercel.app/**`
  - `https://*-zahirk100s-projects.vercel.app/**` (voor previewversies)

Zonder deze instelling werken de bevestigingslinks in de e-mails niet.

> **Let op:** Supabase verstuurt standaard maar een paar e-mails per uur. Dat is genoeg om te testen. Koppel vóór de lancering een eigen mailprovider (bijv. Brevo) onder **Authentication → Emails → SMTP Settings**.

## 3. Jezelf super-admin maken
1. Ga naar `https://beautypass-two.vercel.app/login` → **Account aanmaken** en bevestig je e-mail.
2. Voer in de SQL Editor uit (met jouw e-mailadres):
   ```sql
   update public.profiles set admin_role = 'super_admin'
   where id = (select id from auth.users where email = 'jouw@email.nl');
   ```
3. Log opnieuw in: je komt nu in **Beheer**. Daar kun je onder **Team** andere teamleden een rol geven.

## 4. Een salon aansluiten
1. **Beheer → Salons → Nieuwe salon** (komt binnen als *lead*).
2. Open de salon en stel de **behandelingen en uitbetalingen** in.
3. Laat de eigenaar een account aanmaken op `/login`, en koppel het e-mailadres op de salonpagina als **Eigenaar**.
4. Zet de status op **Live**. Members zien de salon nu, en de salon zet vrije tijden open in het **Salonportaal → Agenda**.

## 5. Een member activeren (zolang de betaalkoppeling er nog niet is)
1. De member maakt een account aan en kiest een membership → status *In behandeling*.
2. Na de eerste betaling (handmatig, bijv. betaalverzoek): **Beheer → Leden → Activeer**. De member krijgt direct haar credits en een founding-nummer.
3. Elke maand: **Beheer → Dashboard → Maandovergang uitvoeren** geeft nieuwe credits aan iedereen van wie de maand om is.
   *(Kan later automatisch, via Supabase Cron of met de Mollie-koppeling.)*

## De drie omgevingen
| Omgeving | Adres |
|---|---|
| Landingspagina | `/` |
| Leden-app | `/app` |
| Salonportaal | `/salon` |
| Beheer | `/admin` |
| Inloggen (voor iedereen) | `/login` → stuurt je automatisch naar de juiste omgeving |

Later kunnen dit eigen subdomeinen worden (`app.`, `salon.`, `admin.beautypass.nl`).

## Als app op je telefoon
- **iPhone (Safari):** open de site → deelknop → **Zet op beginscherm**.
- **Android (Chrome):** menu ⋮ → **App installeren** / **Toevoegen aan startscherm**.
De app opent dan zonder browserbalk, met het BeautyPass-icoon.

## E-mail via Brevo (wachtlijst)

Na elke aanmelding roept de database `https://www.beautypass.nl/api/hooks/waitlist` aan; die stuurt de mail via Brevo
en zet het contact in je Brevo-lijst voor latere lanceringsmails.

1. Brevo: domein `beautypass.nl` authenticeren (DNS-records in Strato) en afzender `hallo@beautypass.nl` toevoegen.
2. Brevo: Contacts → Lists → lijst "Wachtlijst" aanmaken (noteer het ID). Maak onder Contacts → Settings het attribuut `REFERRAL_LINK` (tekst) aan.
3. Brevo: SMTP & API → API keys → nieuwe key.
4. Vercel → Settings → Environment Variables: `BREVO_API_KEY`, `BREVO_LIST_ID`, `WAITLIST_HOOK_SECRET` (zelfbedachte lange code), optioneel `EMAIL_FROM`. Daarna redeploy.
5. Supabase SQL Editor: `008_waitlist_emails.sql` uitvoeren, dan:
   `insert into private.settings values ('waitlist_hook_url','https://www.beautypass.nl/api/hooks/waitlist'), ('waitlist_hook_secret','<dezelfde code>') on conflict (key) do update set value = excluded.value;`
6. Controle: Supabase → `select * from net._http_response order by created desc limit 5;` toont de antwoorden van de website (200 = verstuurd).
