# Beauty Edit campaign refinement — 25 October 2026

Implemented on the existing BeautyPass landing page; hero, Maison copy, membership and invitation remain unchanged.

## Design decisions

- Laser & wax follows L2's raised-leg pose, angular window light and cast shadow, with warm taupe/cocoa surroundings.
- Nails keeps the existing brunette model and manicure design, replacing the competing fur texture with chocolate satin. The foreground nails have greater visual prominence.
- Skincare uses an adult East Asian model in the established facial-treatment composition.
- Mobile retains the large horizontal lookbook images. A single shared Explore treatments control, counter and progress line now sit above the image and remain under the site header while the lookbook is in view. No additional overlay copy competes with the image.
- Manicure & pedicure stays the explicit category label; BIAB is an option within its treatment details.

## Image production

All images were produced with the built-in image_gen tool using referenced_image_paths and transparent_background=false. Full assets are 1024 × 1536 WebP; responsive versions are 640 × 960. Conversion/resizing only; no additional image retouch outside image_gen. Existing source assets are retained.

### Laser & wax

Mode: Reference-guided photographic recreation.

Reference: User upload L2.jpg (primary), L3.jpg reviewed for lighting direction.

Saved website assets:

- `assets/smooth-sunlight-v2.webp`
- `assets/smooth-sunlight-v2-640.webp`

Prompt:

```text
Faithfully recreate the uploaded body-care advertising photograph as a high-resolution portrait 2:3 photographic campaign asset. The reference is the exact composition target: the two smooth legs of an adult woman lifted upward, the right leg nearly vertical with its foot near the top, the left knee bent and its calf rising diagonally behind the right leg. Preserve that graceful pose, the two-leg anatomy, natural proportions and the foot directions. The body remains outside the lower crop exactly as in the reference. Preserve the dramatic window sunlight, the bright angular patch on the plaster wall, the recognizable cast shadow of the legs on the right, and the large warm cocoa shadow area on the left. Beautiful realistic skin texture, smooth healthy skin, warm neutral tan and taupe palette, refined honey highlights without oversaturation. Photographic realism, not illustration or plastic CGI. Preserve the sculptural direction and shadow composition of this reference; do not add a bed, robe, furnishings, props, shoes, equipment, text or logos. Only adapt the outer framing as necessary for a 2:3 portrait without changing limb proportions. A polished mainstream beauty campaign photograph.
```

### Manicure & pedicure

Mode: Edit of existing campaign image.

Reference: assets/nails-mobile-v21.webp

Saved website assets:

- `assets/nails-satin-v2.webp`
- `assets/nails-satin-v2-640.webp`

Prompt:

```text
Edit this existing BeautyPass manicure campaign photograph. Keep the same adult brunette model, black bob hairstyle, narrow brown sunglasses, warm natural skin, the foreground hand's anatomically correct pose, and the existing almond-shaped nude manicure with tortoiseshell French tips and deep espresso accent nails. The nails are the primary subject. Replace ONLY the voluminous shaggy brown fur coat with a simple chocolate-brown satin blouse with long sleeves, a modest neckline and very restrained soft folds; no fuzzy fibers, no blazer lapels, no jewelry. Maintain the photographic campaign mood and warm ivory plaster backdrop. Recompose slightly closer to the foreground hand so the beautifully finished nails are visibly more prominent, but keep natural hand-to-face proportions and do not make a giant hand. Foreground fingernails and cuticles in crisp elegant focus, face and blouse gently softer using realistic shallow depth of field. The model's face remains recognizable in the upper right. Clean expensive beauty photography with realistic hands, five fingers per hand, believable polish highlights. Quiet cocoa fabric across the lower part for white website text added later. Keep 2:3 portrait format. No text, logo, borders, tools or products. Preserve nail design and model identity.
```

### Skincare & facials

Mode: New model using existing composition as reference.

Reference: assets/skincare-v21.webp

Saved website assets:

- `assets/skincare-asian-v2.webp`
- `assets/skincare-asian-v2-640.webp`

Prompt:

```text
Create a new high-resolution luxury facial-treatment photograph using this image as the composition and lighting reference. Replace the model with a clearly adult East Asian woman, approximately 28 years old, natural dark eyes, dark straight hair held back with an ivory spa headband. Preserve the treatment moment: she lies comfortably on ivory cotton towels, the practitioner's two natural anatomically accurate hands gently support her cheeks and jaw. Her expression is serene and confident. Smooth luminous hydrated skin with real pores and subtle natural texture, controlled satin sheen instead of an oily wet face; minimal makeup. Elegant editorial beauty photography with warm creamy daylight, soft cocoa shadows, a taupe and ivory palette that matches the reference, no clinical blue light. Keep the centered close-up face composition and natural head-to-hands proportions, framed from the headband down to a modest towel-covered upper chest, with quiet ivory towel in the bottom quarter for HTML captions added later. Portrait 2:3. No equipment, jewelry, additional hands, text or logos. This is a new adult model; retain the calm, premium facial-treatment context and the reference's warm campaign aesthetic.
```

## Validation

- JavaScript syntax check; scope comparison against the previous version outside Beauty Edit.
- Browser inspection of desktop and mobile widths 320, 393 and 430 CSS pixels, including shorter viewport heights.
- Shared button follows the active category; manicure details contain Manicure, Pedicure and BIAB.
- Sticky control placement inspected during vertical scrolling. Anchor offsets account for the control height.
- Screenshots document responsive browser rendering; this is not a physical iPhone/Safari test.

