# Demo & testen per rol

## Demodata laden
1. Supabase → **SQL Editor** → voer eerst [`003_locations_favorites.sql`](../supabase/migrations/003_locations_favorites.sql) uit.
2. Voer daarna [`supabase/seed/demo.sql`](../supabase/seed/demo.sql) uit. Je ziet een overzicht met het aantal salons, tijden, boekingen en reviews.
3. Opnieuw uitvoeren = alles verversen (nieuwe vrije tijden voor de komende 2 weken).
4. **Vóór de lancering:** voer [`demo_cleanup.sql`](../supabase/seed/demo_cleanup.sql) uit. Alleen demodata wordt verwijderd; echte salons, members en de wachtlijst blijven staan.

## Testaccounts (wachtwoord voor allemaal: `Demo2026!`)

| Account | Rol | Wat kun je testen |
|---|---|---|
| `demo.sophie@example.com` | Member, Signature, founding Nº 001 | Boeken, annuleren, favorieten, reviews, afstand vanaf De Pijp |
| `demo.fleur@example.com` | Member, Luxe | Meer credits; heeft een afspraak die nú bezig is |
| `demo.noa@example.com` | Member, Essential | Klein tegoed: sommige behandelingen zijn te duur |
| `demo.julia@example.com` | Member, gepauzeerd | Kan niet boeken |
| `demo.lisa@example.com` | Member, aanvraag in behandeling | Wacht op activatie (test "Activeer" in Beheer) |
| `demo.amira@example.com` | Account zonder membership | Membership kiezen |
| `demo.noor@example.com` | Salon-eigenaar Studio Noor | Agenda, voltooid/no-show, uitbetalingen, team |
| `demo.mila@example.com` | Medewerker Studio Noor | Ziet agenda, maar mag het profiel en team niet wijzigen |
| `demo.eva@example.com` | Eigenaar van 2 salons | Wisselen tussen Maison Eva en The Brow Room |
| `demo.ops@example.com` | Beheer: Operations | Salons, tarieven, leden activeren |
| `demo.support@example.com` | Beheer: Support | Credits corrigeren, pauzeren; géén tarieven wijzigen |
| `demo.finance@example.com` | Beheer: Finance | Alles inzien, niets wijzigen |

Tip: gebruik een privévenster per rol, dan kun je tegelijk als member en als salon ingelogd zijn.

## Testscenario's
1. **Member boekt:** log in als Sophie → Boeken → sorteer op *Dichtbij* → kies een salon → behandeling + tijd → bevestig. Check: credits gaan eraf.
2. **Salon ziet het:** log in als Noor → *Vandaag* of *Agenda*: de boeking staat er, met alleen "Sophie d.".
3. **Afronden:** als Noor de afspraak van Fleur (nu bezig) op *Voltooid* zetten → zie *Uitbetalingen*.
4. **Annuleren:** als Sophie een afspraak > 24 uur vooruit annuleren → credits terug.
5. **Activeren:** als Ops → Leden → Lisa → *Activeer* → log in als Lisa: credits staan klaar.
6. **Rechten:** als Mila of Finance proberen te wijzigen wat niet mag: de knoppen ontbreken of zijn uitgeschakeld.
