# BeautyPass skincare visual — refracted daylight
Date: 2026-10-27

## Decision
Replace the previous closed-eye skin portrait with an original three-quarter, direct-gaze skincare campaign portrait. The image is judged as part of the Beauty Edit, especially beside Beautifully smooth.

The rejected patches concept was never published. It introduced a home-care cue and an incompatible dark brown backdrop. This replacement uses a light limestone palette, diagonal sunlight, bare neck and shoulders, sleek dark hair, defined glossy skin highlights and one clear glass edge at the right foreground.

The intended strength is the combination of a confident gaze, a diagonal silhouette and optical depth. The glass is subordinate to the skin, with no treatment equipment, self-care accessories, clothing or jewelry. The existing Skincare & facials category gives service context. This is a design judgment, not a claim of measured conversion improvement.

## Implementation
- Only the skin image, responsive image sources and alt text in index.html are changed.
- Desktop 1024×1536 WebP: assets/skincare-refracted-v11.webp.
- Mobile 640×960 WebP: assets/skincare-refracted-v11-640.webp.
- Existing image position (50% 10%), white captions, typography, dimensions and gradients retained.
- All other sections, visuals and signup behavior preserved.
- Generated with the built-in image_gen.imagegen tool; new original generation, opaque background; no input image references.
- Original render: generated_images/exec-c2ffc620-1cbb-4743-a46b-6b05bc303565.png.
- WebP export via Pillow: full size quality 90; mobile quality 86.

## Review
Mobile browser layout review at 320×568, 393×650 and 430×760: face remains clear of the caption; cheek highlight and direct gaze remain visible. On the shortest 320px viewport, the existing minimum-height gallery continues below the viewport; no gallery layout change was included.

Desktop browser review: skin and legs both use a stone background with diagonal daylight; white captions remain readable and do not cover the face. Screenshot: review/skin-refracted-20261027.jpg.

## Exact generation prompt
```text
Original high-end photographic skincare campaign for BeautyPass. A striking sculptural portrait of an adult Korean woman age 27, glossy translucent skin, sleek jet-black hair, direct self-possessed eye contact. Vertical 2:3, 1024x1536. This must have the memorable art direction of a luxury fragrance/beauty campaign while the skin is unequivocally the hero.

COMPOSITION AND GESTURE: elegant three-quarter view, her shoulders turn away while she turns her face back toward the lens. Chin gently lifted, neck long and naturally proportioned, lips relaxed with no smile or pout, dark brown eyes confidently meeting the viewer. A defined cheekbone and interesting natural face, not a generic friendly stock model. Hair perfectly smooth and pulled behind her head, precise center part, no loose hair, no visible messy bun. Bare neck, collarbones and upper shoulders; tasteful beauty crop above the bust. No clothes or jewelry in the crop. The near shoulder forms a rising diagonal in the bottom right; face occupies the upper 60 percent, eyes around 30 percent and chin around 55 percent. Keep the entire important face within the center 65 percent of image width. Intimate close framing with the top of the sleek hair almost reaching the upper border.

THE VISUAL IDEA IS LIGHT AND GLASS: one real clear optical-glass slab with a clean thick bevel enters the near foreground at the lower-right edge, leaning diagonally away toward the right edge beside her neck. It is mostly transparent and slightly out of focus, but its edge catches a very fine bright line and a restrained fragment of reflected shoulder. It MUST NOT cover or distort her eyes, nose, mouth or the main cheek. The glass is an elegant photographic light instrument, not a gemstone, not a decorative crystal crown or necklace. A narrow refracted ribbon of natural warm-white light grazes the cheekbone and collarbone, adding a fresh liquid-looking reflection. This should feel like a real studio photograph using sunlight and optical glass: no rainbow effects, fantasy sparkle, starbursts, lens flare or added graphics. The slab is supported out of frame, no hands. No second slab or extra objects.

SKIN: luminous Korean glass skin, clear glossy specular reflections on the cheek, nose bridge and brow bone. Hydrated peach-beige skin with a subtle pink undertone, real fine pores, translucent depth and natural small skin variations. Reflections are locally bright and liquid but most skin stays satin-soft, not drenched in oil. Very light natural makeup, sheer rose lip balm, naturally separated lashes, no eyeliner or heavy foundation. Skin is the brightest and most inviting part of the frame. The glass reflection is a secondary detail.

LIGHT AND BACKGROUND: the image will sit beside a photograph of smooth legs raised into a sunlit warm stone wall. Match that LIGHTER warm grey/limestone world: a quiet warm grey stone-colored backdrop, a broad off-white sunlit patch with one diagonal soft-edged architectural shadow, soft taupe shadow tones. No chocolate brown or dark brown backdrop, no peach seamless, no furniture, curtains or cozy interior. Strong directional warm-neutral daylight from upper left gives the cheek gloss and a defined graceful shadow under the jaw and along the far neck. A subtly backlit contour separates the near shoulder. Keep white balance neutral-warm, not yellow or orange. Lower quarter naturally shaded and visually quiet for white website typography added later; the glass edge stays mostly to the far right, leaving lower-left uncluttered.

Photoreal medium-format editorial beauty photograph with sculptural lighting and optical depth. The sophisticated effect comes from confident facial expression, lit skin against stone, the diagonal shoulder, and a transparent foreground plane. Avoid a flat centered headshot, closed eyes, skincare patches, masks, towels, spa props, equipment, treatment gloves, hands, satin or knitwear. No earrings, necklace, text, logos or watermark. One beautifully art-directed finished image.
```
