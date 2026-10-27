# Glass-skin refinement — 27 October 2026

## Decision

The preceding earring-adjusting portrait read primarily as getting dressed. This revision makes luminous skin the primary subject through a closer face crop, a clearer cheek reflection, and removal of jewelry and brown satin. A small matte ivory cotton neckline provides variation within the campaign. Fingertips rest beneath the jaw, leaving the cheek visible. The same adult model is retained. Existing copy, gallery dimensions, and controls are unchanged.

## Production

Mode: built-in image_gen, identity-preserving edit. Target: assets/skincare-window-v3.webp. Supporting finish reference: AS4.jpg. Transparent background: false.

Saved website assets:
- `assets/skincare-gloss-v4.webp` — 1024 × 1536
- `assets/skincare-gloss-v4-640.webp` — 640 × 960

Only WebP compression and proportional downscaling follow image generation. The previous asset remains available. Local caption shading is strengthened to retain white text contrast over the lighter neck and cotton top, without veiling the face.

## Final prompt

```text
Edit the first attached BeautyPass campaign portrait. Keep the identity of this SAME clearly adult Korean woman, her recognizable facial features, center-parted black hair in a low bun, and the warm neutral window-light photographic palette. The second attached image AS4 is a reference ONLY for glossy hydrated skin luminosity, NOT model identity or its background color.
Change the storytelling from getting dressed to a confident editorial SKIN BEAUTY close-up. Move significantly closer: her face dominates the frame, the highlighted cheek is the focal subject. Frame from the top of the head to just below collarbones, portrait 2:3, full eyes/nose/lips visible and the face contained within the central 78% of width for mobile crops. The top of the hair has a modest 3% margin. Her chin is at about 65% image height and eyes at about 32%. Calm self-possessed gaze near the camera, gentle three-quarter turn, near cheek angled to the light. Do not elongate her neck.
REMOVE the earring and all jewelry. REMOVE the hand at her ear and the raised forearm. Instead, one anatomically natural hand enters low from the lower-right and rests very lightly UNDER her jaw, fingertips along the underside of the chin, without obscuring or pressing the cheek. No face-massage treatment pose. Keep the hand visually secondary, softly lit, with short natural unpolished nails.
Replace ALL brown satin clothing with a minimal MATTE IVORY cotton top, only a small plain edge visible at the very bottom. No draped wrap, satin, brown clothing, bathrobe or towel. Face and skin occupy most of the photograph; no fashion wardrobe story.
Make the skin visibly more glassy and hydrated than the source: a broad silky luminous pearlescent reflection across the prominent upper cheek, smaller clean gleams on the bridge of the nose and brow bone, soft translucent pink-peach cheeks. The glossy light should read instantly as a high-end skincare campaign even at thumbnail size. Fine pores and natural microtexture remain clearly visible. Smooth clear adult skin, not plastic, waxy, blurry or artificial. Control the glow: strongest on cheekbone, softer shadow on the far cheek and neck. Avoid excessive glitter, droplets, serum streaks or oil running down skin. Lips have restrained natural translucent balm, no heavy makeup, eyeliner or theatrical eyelashes.
Use a large clean window reflection to create a deliberate luminous cheek highlight, softer and more neutral than the golden fashion portrait. Keep cream, neutral warm skin, deep dark hair, taupe background. Background unobtrusive softly blurred pale warm stone; remove the detailed curtain and scenery. No blue/mint tint or orange tan filter. A nuanced shadow under chin and across the bottom neck gives a quiet place for white website text to be added later, but do not paint black bands or overlays into the photo. No text, logos or borders.
Luxury macro beauty editorial photo with crisp skin detail and natural skin-to-eye proportions. The unmistakable hierarchy is luminous cheek and skin FIRST, eyes second, gesture third. Retain the same woman's identity; do not create another model.
```

## Checks

Generated image visually inspected. Desktop pairing and mobile viewport crops checked at 320, 393 and 430 CSS pixels. HTML scope limited to skincare source/srcset/alt and CSS version; CSS changes limited to skincare caption shading and mobile focal position, keeping the facial outline inside the narrower frame. Browser viewport checks are not a physical iPhone test.

