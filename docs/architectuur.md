# BeautyPass: platformstructuur en rechten

Versie 0.2. Fase 0–3 zijn gebouwd (zie [opzet.md](opzet.md)); betalingen via Mollie en de groeifuncties volgen.

## 1. Drie omgevingen

| Omgeving | Adres | Voor wie | Doel |
|---|---|---|---|
| **Leden-app** | `beautypass.nl` + `app.beautypass.nl` | Abonnees | Membership afsluiten, salons ontdekken, boeken, credits en historie bekijken |
| **Salonportaal** | `salon.beautypass.nl` | Salons en hun medewerkers | Beschikbaarheid beheren, boekingen zien en afhandelen, uitbetalingen inzien |
| **Beheer** | `admin.beautypass.nl` | Het BeautyPass-team | Salons toelaten, leden en wachtlijst beheren, lanceringen, prijzen en credits, financiën, support |

**Eén codebase, drie ingangen.** We bouwen het als één applicatie met drie afgeschermde delen. Voorlopig via paden (`/app`, `/salon`, `/admin`), later via subdomeinen. Voordelen:
- één database en één login-systeem;
- gedeelde onderdelen zoals het ontwerp, de behandelingenlijst en de boekingslogica;
- één Vercel-project en dus één plek om te beheren.

Een omgeving afschermen gebeurt niet alleen in het scherm. **De database zelf controleert bij elke vraag wie je bent en wat je mag** (Row Level Security). Ook als iemand een URL raadt of de app omzeilt, ziet een salon nooit de gegevens van een andere salon.

## 2. Techniek (voorstel)

| Onderdeel | Keuze | Waarom |
|---|---|---|
| Framework | **Next.js** op Vercel | Sluit aan op je huidige Vercel-koppeling. Alle drie de omgevingen in één project. |
| Database + login | **Supabase** (Postgres, EU-regio) | Login (e-mail, magic link, Google/Apple), rechten op databaseniveau, AVG-vriendelijk in de EU |
| Betalingen | **Mollie** | Nederlands. iDEAL voor de eerste betaling, daarna automatische incasso voor het abonnement. Kan later ook salons uitbetalen. |
| E-mail | **Brevo** of **Resend** | Wachtlijst- en lanceringsmails, boekingsbevestigingen |
| Sms | Brevo of MessageBird | Melding bij de lancering, herinneringen |

> De wachtlijst van de landingspagina kan direct in Supabase worden opgeslagen. Dan zit hij meteen in het platform en kunnen we bij de lancering automatisch persoonlijke links versturen.

## 3. Rollen en rechten

### Rollen

| Rol | Omgeving | Omschrijving |
|---|---|---|
| `member` | Leden-app | Betalend lid (of iemand met een account, zonder actief abonnement) |
| `salon_owner` | Salonportaal | Eigenaar of beheerder van één of meer salons |
| `salon_staff` | Salonportaal | Medewerker van een salon. Ziet alleen de agenda en boekingen. |
| `admin_support` | Beheer | Teamlid voor klantenservice: kan leden en boekingen inzien en helpen |
| `admin_ops` | Beheer | Beheert salons, behandelingen, credits en lanceringen |
| `admin_finance` | Beheer | Uitbetalingen, facturen en rapportages |
| `super_admin` | Beheer | Alles, inclusief teamleden en rollen beheren |

Eén persoon kan meerdere rollen hebben. Een salonmedewerker kan bijvoorbeeld ook lid zijn. Salonrollen gelden **per salon**: iemand kan eigenaar zijn van salon A en medewerker bij salon B.

### Rechtenmatrix

✅ = mag · 👁 = alleen inzien · ➖ = niet · *eigen* = alleen eigen gegevens of eigen salon

| Actie | member | salon_staff | salon_owner | admin_support | admin_ops | admin_finance | super_admin |
|---|---|---|---|---|---|---|---|
| Eigen profiel en membership beheren | ✅ | – | – | 👁 | 👁 | 👁 | ✅ |
| Membership opzeggen of pauzeren | ✅ *eigen* | ➖ | ➖ | ✅ (namens lid) | ➖ | ➖ | ✅ |
| Salons en behandelingen bekijken | ✅ | 👁 *eigen* | 👁 *eigen* | 👁 | ✅ | 👁 | ✅ |
| Behandeling boeken / annuleren | ✅ *eigen* | ➖ | ➖ | ✅ (namens lid) | ✅ | ➖ | ✅ |
| Boekingen van de salon zien | ➖ | ✅ *eigen salon* | ✅ *eigen salon* | 👁 | ✅ | 👁 | ✅ |
| Boeking afvinken (verschenen / no-show) | ➖ | ✅ *eigen salon* | ✅ *eigen salon* | ➖ | ✅ | ➖ | ✅ |
| Beschikbaarheid en openingstijden | ➖ | ✅ *eigen salon* | ✅ *eigen salon* | ➖ | ✅ | ➖ | ✅ |
| Salonprofiel (foto's, tekst) | ➖ | ➖ | ✅ *eigen salon* | ➖ | ✅ | ➖ | ✅ |
| Medewerkers van de salon beheren | ➖ | ➖ | ✅ *eigen salon* | ➖ | ✅ | ➖ | ✅ |
| Uitbetalingen en facturen salon | ➖ | ➖ | 👁 *eigen salon* | ➖ | 👁 | ✅ | ✅ |
| Salons toelaten / pauzeren | ➖ | ➖ | ➖ | ➖ | ✅ | ➖ | ✅ |
| Credits per behandeling en tarieven | ➖ | ➖ | ➖ | ➖ | ✅ | 👁 | ✅ |
| Credits handmatig corrigeren | ➖ | ➖ | ➖ | ✅ (met reden) | ✅ | ➖ | ✅ |
| Wachtlijst en lanceringen | ➖ | ➖ | ➖ | 👁 | ✅ | ➖ | ✅ |
| Financiële rapportages | ➖ | ➖ | ➖ | ➖ | 👁 | ✅ | ✅ |
| Teamleden en rollen beheren | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ✅ |

### Privacy (AVG): wat ziet een salon van een lid?
Alleen wat nodig is voor de afspraak: **voornaam, eerste letter van de achternaam, de behandeling en het tijdstip**, plus eventuele opmerkingen van het lid. Geen e-mailadres, telefoonnummer of betaalgegevens. Contact loopt via het platform. Zo blijft de klantrelatie ook bij BeautyPass.

### Extra beveiliging voor beheer
- Verplichte tweestapsverificatie (2FA) voor alle beheerrollen en salon-eigenaren.
- **Audit-log**: elke handeling in beheer (credits aanpassen, salon pauzeren, terugbetaling) wordt vastgelegd met wie, wat, wanneer en waarom.
- Beheer alleen op `admin.beautypass.nl`, niet vindbaar via de gewone site.

## 4. Datamodel (hoofdlijnen)

```
profiles            gebruiker: naam, telefoon, voorkeuren
user_roles          platformrollen (member, admin_*, super_admin)
salons              naam, adres, wijk, foto's, status (aangemeld / actief / gepauzeerd)
salon_members       koppeling gebruiker ↔ salon + rol (owner / staff)
treatments          catalogus: manicure, pedicure, blowout, brows, lashes… + categorie
salon_treatments    welke salon wat aanbiedt, duur, inkoopprijs, aantal credits
availability        tijdslots of openingstijden per salon
plans               membership-niveaus: prijs, credits per maand, maximaal mee te nemen
memberships         abonnement van een lid: plan, status, startdatum, Mollie-referenties
credit_ledger       elke bij- en afschrijving van credits (maandtegoed, boeking, annulering, correctie)
bookings            lid, salon, behandeling, tijdstip, status, gebruikte credits
payouts             periodieke uitbetaling per salon (som van voltooide boekingen)
reviews             beoordeling per boeking (alleen na een voltooide afspraak)
waitlist            aanmeldingen van de landingspagina, bron, lanceringsronde, uitnodigingsstatus
launches            lanceringsrondes: aantal plekken, startmoment, voorrang voor de wachtlijst
audit_log           alle beheerhandelingen
```

**Credits als grootboek:** het saldo van een lid wordt niet als los getal opgeslagen. Het is de som van alle regels in `credit_ledger`. Zo is elke wijziging te herleiden en zijn fouten op te sporen.

## 5. Belangrijkste stromen

**Lancering**
1. De wachtlijst groeit via de landingspagina.
2. Beheer maakt een lanceringsronde aan, bijvoorbeeld 100 plekken.
3. Het systeem stuurt op het afgesproken moment persoonlijke links, eerst naar de wachtlijst en 10 minuten later naar iedereen.
4. Bij 100 verkochte plekken sluit de verkoop automatisch. Wie te laat was, blijft op de wachtlijst voor de volgende ronde.

**Boeken**
1. Een lid kiest een behandeling en salon en ziet de beschikbare tijden.
2. Bij het boeken worden de credits gereserveerd en krijgen lid en salon een bevestiging.
3. Annuleert het lid tijdig, dan komen de credits terug. Bij een late annulering of no-show (volgens de regels) niet.
4. De salon zet de afspraak op "voltooid", en die telt mee voor de uitbetaling.

**Uitbetaling aan salons**
- Elke maand (of elke twee weken) worden alle voltooide boekingen opgeteld tegen de afgesproken inkoopprijs.
- De salon ziet in het portaal een overzicht en de factuur. Beheer (finance) keurt goed en betaalt uit.

## 6. Functies per omgeving (inclusief extra ideeën)

✦ = extra idee bovenop het oorspronkelijke concept

### Leden-app
| Functie | Waarom |
|---|---|
| Membership afsluiten, pauzeren (bijv. vakantie) en opzeggen | Pauzeren ✦ voorkomt opzeggingen: wie een maand weg is, pauzeert in plaats van op te zeggen |
| Credits-overzicht met "wat kan ik nog boeken?" | Laat de waarde van het membership elke maand zien |
| Zoeken op behandeling, wijk, datum en beoordeling + kaart | Kernfunctie |
| Favoriete salons en stylisten ✦ | Vaste stylist = tevreden lid = minder opzeggingen |
| Slim opnieuw boeken ✦ | "Je BIAB is 3 weken oud. Zelfde salon, zelfde tijd?" Eén tik, en voorspelbare vraag voor salons. |
| Last-minute plekken ✦ | Vrije plekken van vandaag goedkoper in credits: vult lege uren voor salons |
| Digitale ledenpas in Apple/Google Wallet ✦ | Met QR-code voor het inchecken in de salon. Voelt premium en is te gebruiken tegen misbruik. |
| Credits bijkopen of een ander niveau kiezen ✦ | Extra omzet zonder korting |
| Beoordelen na elke afspraak (kort, met sterren) | Kwaliteitscontrole van salons |
| Verwijzen: "Nodig een vriendin uit" ✦ | Beide krijgen bonuscredits. De goedkoopste groei. |
| Membership cadeau geven ✦ | Verjaardagen, Moederdag, december: sterke verkoopmomenten |
| Founding member-status en ledenevents ✦ | Exclusiviteit en community, goed voor TikTok-content |

### Salonportaal
| Functie | Waarom |
|---|---|
| Dashboard: boekingen, gevulde uren en verdiensten deze maand | Laat de salon direct de waarde van BeautyPass zien |
| Beschikbaarheid instellen, met aparte "BeautyPass-uren" ✦ | Salons geven vooral rustige uren vrij, en daardoor ook betere inkoopprijzen |
| Inchecken door de QR-code van het lid te scannen ✦ | Bewijs dat de afspraak plaatsvond: basis voor uitbetaling, en tegen no-shows en misbruik |
| No-show melden | Lid verliest de credits, salon krijgt (deels) betaald |
| Medewerkers met eigen login en rechten | Eigenaar beheert, medewerker ziet alleen de agenda |
| Automatische uitbetalingsoverzichten en facturen (self-billing) ✦ | BeautyPass maakt de factuur namens de salon. Geen administratie voor de salon. |
| Inzicht in beoordelingen en feedback | Kwaliteit verbeteren |
| Later: koppeling met Salonized / Treatwell-agenda | Geen dubbele agenda's |
| Later: extra zichtbaarheid kopen ✦ | Extra inkomstenbron voor het platform |

### Beheer
| Functie | Waarom |
|---|---|
| Wachtlijst: aantallen per kanaal (TikTok, Instagram, creators), export | Marketing sturen |
| Lanceringsrondes ("drops"): plekken, startmoment, voorrang, automatisch sluiten | Het lanceringsmechanisme uit het concept |
| Salon-pipeline (CRM) ✦: lead → gesprek → proefbezoek → contract → actief | Salons werven is het moeilijkste deel, dus houd het bij als een verkoopproces |
| Vraag- en aanbodkaart ✦: wachtlijst en boekingen per wijk en behandeling, afgezet tegen capaciteit | Laat zien waar je salons moet werven en wanneer er plek is voor een nieuwe ronde |
| **Economie-dashboard ✦**: kosten per lid, gebruik per lid, marge per niveau, opzeggingen | **Het belangrijkste scherm**: laat elke week zien of het model klopt |
| Kwaliteitscontrole ✦: salons met dalende scores, klachten, mystery visits | Eén slechte salon schaadt het hele merk |
| Misbruiksignalen ✦: veel no-shows, pas gedeeld met anderen | Beschermt de marge |
| Credits en tarieven per behandeling en salon instellen | Prijzen bijsturen zonder nieuwe code |
| Support: lid of salon opzoeken, boeking aanpassen, credits corrigeren (met reden) | Klantenservice |
| Uitbetalingen goedkeuren, audit-log | Financiële controle |

## 7. Risico's die het platform moet opvangen

| Risico | Hoe we het opvangen |
|---|---|
| **Marge**: leden gebruiken alles, inkoop is te duur | Credits per behandeling, vaste inkoopprijzen, BeautyPass-uren, economie-dashboard vanaf dag 1 |
| **Omzeilen**: salon en lid spreken buiten het platform af | Salon krijgt geen contactgegevens. Het lid heeft voordeel van variatie en van het vaste bedrag. Afspraak in het salon-contract. |
| **Pas delen** met vriendinnen | QR-check-in, naam en profielfoto in de app, misbruiksignalen |
| **Kwaliteit** wisselt per salon | Selectie vooraf, beoordelingen, kwaliteitsscores, salons pauzeren |
| **Capaciteit** op piekmomenten (vrijdag, zaterdag) | Credits laten variëren per tijdstip, last-minute plekken, nieuwe rondes pas openen bij genoeg capaciteit |
| **Juridisch**: abonnementsrecht, btw, AVG | Online opzeggen, duidelijke voorwaarden, btw-advies over de constructie, privacyverklaring, verwerkersovereenkomsten |

## 8. Bouwvolgorde

| Fase | Wat | Doel |
|---|---|---|
| **0 – Nu** | Landingspagina + wachtlijst in Supabase | Vraag opbouwen |
| **1 – Beheer light** | Inloggen voor het team, wachtlijst inzien en exporteren, salons vastleggen | Overzicht voor de lancering |
| **2 – Leden: lancering** | Account, membership afsluiten via Mollie, lanceringsrondes met maximaal aantal plekken | De eerste 100 leden laten betalen |
| **3 – Boeken + salonportaal** | Credits, beschikbaarheid, boeken, salon ziet en voltooit afspraken | Het product werkt van begin tot eind |
| **4 – Geld** | Uitbetalingen, facturen, rapportages | Salons automatisch betalen |
| **5 – Groei** | Reviews, verwijzingen ("nodig vriendinnen uit"), app-meldingen, commissiemodel | Opschalen |

> Tip: tijdens fase 2 kan het boeken eerst nog handmatig door het team via beheer gebeuren. Zo kun je eerder lanceren en leer je wat salons en leden echt nodig hebben voordat het salonportaal af is.

## 9. Open beslissingen

1. Credits per behandeling en de membership-niveaus (prijs per maand)
2. Regels voor annuleren en no-shows (bijvoorbeeld kosteloos tot 24 uur vooraf)
3. Hoeveel ongebruikte credits mogen mee naar de volgende maand?
4. Uitbetaling aan salons per twee weken of per maand?
5. Boeken in realtime via de eigen agenda van de salon (koppeling met Salonized of Treatwell), of via beschikbaarheid in ons portaal? Advies: eerst ons eigen portaal, koppelingen later.
6. Domeinnaam: is `beautypass.nl` beschikbaar?
7. Merknaam: controleer "BeautyPass" in de merkenregisters van BOIP (Benelux) en EUIPO (EU) en leg de naam vast voordat je groot gaat adverteren.
