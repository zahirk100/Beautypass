# Beauty Edit — lookbook en beeldkeuze

Datum: 25 oktober 2026.

## Definitieve keuzes

Desktop behoudt de schermvullende 2–1–2-compositie en het categorieoverzicht rechts. Het categorielabel op ieder beeld opent de behandeldetails; de vijf extra regels ‘Explore treatments’ vervallen.

Mobiel gebruikt een groot horizontaal lookbook. De foto is 24 px smaller dan het scherm, met 8 px tussenruimte en een zichtbare rand van het volgende beeld. Alle vijf categorieën blijven bovenaan bereikbaar, met de geselecteerde categorie onderstreept. Onder het beeld staan één gedeelde behandelknop, een teller en een dunne voortgangslijn. Geen pijlen, autoplay of scrollblokkade. Dit verkort het verticale traject zonder kleine catalogustegels te maken. De hoogte blijft royaal: 100svh minus 112 px, minimaal 520 px; de inhoud kan groeien bij grotere tekst.

Alle campagnekoppen en categorielabels zijn wit. Alleen achter de captions loopt een warme schaduw in; de rest van het beeld blijft licht. De bestaande fontrollen blijven behouden.

Het laserbeeld is vervangen door een warm beeld van gladde onderbenen en gekruiste enkels op hotellinnen. Dat suggereert het verzorgde resultaat en sluit op de rustige beautywereld aan. De gebruikte variant toont rustende benen, niet het eerder overwogen beeld met hoog geheven benen.

## Beeldbestanden

- `assets/smooth-legs-v1.webp` — 1024 × 1536, hoofdbeeld.
- `assets/smooth-legs-v1-640.webp` — 640 × 960, kleinere variant.
- Modus: ingebouwde image_gen, nieuw beeld. Alleen WebP-compressie en proportionele verkleining voor webgebruik; geen retouche of gewijzigde compositie achteraf.

## Gebruikte prompt

Use case: photorealistic-natural. Portrait 2:3 beauty skincare advertising photograph. Close-up of the two lower legs and feet of an adult woman, viewed from knee level down only. She is wearing a modest ivory cotton bathrobe; only the lower hem of the robe, calves and feet enter the frame, the rest of the body is out of shot. Her calves are lifted at a graceful diagonal, ankles softly crossed, against a warm taupe background above ivory cotton bed linen, like a calm boutique hotel morning. Exactly two calves and two naturally proportioned feet, realistic skin texture, elegant relaxed posture. Warm neutral color photography, fine texture, honey-olive skin, creamy window light, soft cocoa shadows. The composition is a sculptural study of clean smooth calves for a hair-removal beauty category, suitable for a mainstream wellness website. Place the legs mostly in the upper and central area, leaving naturally shaded taupe linen across the lower left for a white HTML caption. Rich tonal depth, quiet luxury editorial quality, 85mm photographic lens. No text, logo, watermark, products or equipment.

## Verificatie

- Desktopcompositie en witte captions visueel gecontroleerd.
- Mobiele breedtes 320, 393 en 430 px in Chromium-iframes gecontroleerd, inclusief haaruitsnede en 200% tekstgrootte.
- Native horizontaal scrollen, categorieknoppen, Home/End en links/rechts, gedeelde behandelknop, sluiten en Escape gecontroleerd.
- De actieve categorie en behandeldetails blijven gekoppeld bij snel wisselen.
- JavaScript-syntax gecontroleerd; vijf categorieën, vijf dialogs, unieke IDs en lokale beeldverwijzingen gecontroleerd.
- Hero, Maison-statement, House, FAQ, uitnodiging, formulier en footer buiten de Beauty Edit zijn niet gewijzigd.
- Geen fysieke iPhone/Safari-test of aanmeldverzoek uitgevoerd.
