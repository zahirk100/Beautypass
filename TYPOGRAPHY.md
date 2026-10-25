# BeautyPass typografie

Vastgelegd op 25 oktober 2026. Gebruik `typography.css` als laatste laag na
de bestaande sectiestijlen. Nieuwe onderdelen krijgen een rol; kies geen
nieuw lettertype voor een afzonderlijke sectie.

## Lettertypefamilies

| Familie | Rol | Bestanden en CSS-naam |
| --- | --- | --- |
| Instrument Serif | Editoriale merkuitingen | `font-01.ttf` regular en `font-02.ttf` italic; `BPInstrument` |
| DM Sans | Informatie, uitleg en bediening | `manrope-medium.woff` bevat daadwerkelijk variabele DM Sans; `DM Sans` |
| Nimbus Roman | Beperkt klassiek merkbijschrift | `font-01.otf`; `BPFineSerif` |

De bestandsnamen uit de oorspronkelijke backup zijn geen betrouwbare
lettertypenamen. De tabel is gecontroleerd in de metadata van de fontbestanden.
Regular en italic van Instrument Serif zijn één familie. Logo en getekende
signatuur zijn SVG-merkbeelden, geen aanvullende familie voor lopende tekst.

## Rollen

| Klasse | Gebruik | Vorm |
| --- | --- | --- |
| `bp-type-display` | Hero, emotionele beeldtitels, uitnodiging | Instrument Serif 400. Alleen een bewust gekozen zinsdeel cursief. |
| `bp-type-statement` | Eén zelfstandig merkstatement | Instrument Serif 400, recht. Alle zinsdelen op hetzelfde typografische niveau. |
| `bp-type-section` | Inhoudelijke sectiekoppen zoals Good to know | DM Sans 500, recht; 28–36 px desktop, 28 px mobiel. |
| `bp-type-label` | Plaats, categorie, kleine bovenregel | DM Sans 400–450. Kapitalen alleen bij korte labels; rustige letterafstand. |
| `bp-type-copy` | Uitleg en beschrijvingen | DM Sans 400, normale schrijfwijze. Huidige leesgroottes doorgaans 14–16 px. |
| `bp-type-ui` | Navigatie, links, knoppen en invoer | DM Sans, recht. Behoud klikvlak, focusweergave en mobiele invoerlogica. |
| `bp-type-fine` | In one membership; persoonlijke afsluiting op de handschoen | Nimbus Roman 400, recht. Geen algemene ondertitelstijl. |
| `bp-type-note` | Praktische formulierhulp of status | DM Sans 400, recht; geen sierlijk merkbijschrift. |

De functie bepaalt de rol, niet alleen het HTML-element. Een H2 kan een
merkstatement of informatieve kop zijn. Geef daarom expliciet de juiste rol.
Het woord ‘subkop’ is op zichzelf geen typografische rol: onderscheid een
categorielabel, beschrijvende uitleg en een kort merkbijschrift.

## Compositie

- De hero behoudt de goedgekeurde verhouding tussen de rechte kapitalen,
  de cursieve vervolgregel en het kleinere klassieke bijschrift.
- Het Maison-statement blijft drie semantische regels: 48–52 px desktop,
  26–32 px mobiel, regelhoogte 1,18. Geen cursief en geen kleinere slotregel.
- De Maison-sectie houdt 80 px boven/onder op desktop en 60/64 px op mobiel.
  De hoogte volgt de inhoud en mag groeien bij tekstvergroting.
- Koppen als Good to know krijgen de rustige DM Sans-laag. Geen automatische
  cursieve tweede regel en geen vet gesimuleerde serif.
- De foto- en uitnodigingstitels zijn bewuste editorialere merkuitingen.
  Hun schaal volgt de beeldcompositie; koppen voor informatie imiteren die
  schaal niet.
- Breek bij betekenisvolle zinsdelen. Gebruik geen `white-space: nowrap`
  om de afgesproken regelverdeling bij tekstvergroting af te dwingen.
- Voeg geen nieuwe fontfamilie toe om één onderdeel een ander gevoel te geven.
  Werk eerst met rol, grootte, gewicht, afstand, uitlijning en beschikbare breedte.

## Verificatie bij wijzigingen

Controleer de gebruikte rollen, tekstvergroting en smalle mobiele breedtes.
Controleer formulieren en tabs visueel als hun typografie verandert; een
typografische aanpassing mag hun gedrag of aanmeldverwerking niet wijzigen.
