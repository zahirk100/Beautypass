# BeautyPass: platform opzetten (eenmalig, ±10 minuten)

## 1. Database bijwerken (Supabase)
1. Open je project in Supabase → **SQL Editor** → **New query**.
2. Plak de volledige inhoud van [`supabase/migrations/002_platform.sql`](../supabase/migrations/002_platform.sql) en klik op **Run**.
   (`001_waitlist.sql` heb je al eerder uitgevoerd.)

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
