# BeautyPass skincare — Repose v6

Date: 2026-10-27

## Decision

Replace the rejected two-hand portrait with a relaxed, single-hand editorial pose. The manicure asset uses foreground perspective to make its category immediate, while the hair asset combines recognizable rollers with an off-duty coffee moment. The skin asset needs a similarly believable gesture, with the cheek as the sharpest and brightest subject.

Reference review: A1 provides directional light but its symmetrical framing is too demonstrative; A2 supplies a natural resting gesture; A3 has a stronger sideways tilt than the narrow crop can support; A4 supplies intimacy and direct gaze but its two-hand framing was rejected; A5–A6 provide relaxed proximity, without borrowing their hair, watches or prominent nail styling.

Final choice: same adult model, one relaxed hand beneath the jaw, a diagonal shoulder line, luminous cheek, warm-neutral light and matte taupe knitwear. The two-hand v5 experiment was not deployed.

## Assets and implementation

- assets/skincare-repose-v6.webp — 1024 × 1536
- assets/skincare-repose-v6-640.webp — 640 × 960
- index.html — image, responsive source, alt text and stylesheet cache key only
- beauty-edit.css — skin focal point and localized caption shading only

Original source: generated_images/exec-512a2bb8-062f-419c-870d-54c06be3d03a.png

Mode: built-in image_gen tool, identity-preserve edit. References: existing skincare-window-v3.webp (model), A2 and A6 (gesture/attitude), nails-satin-v2.webp (campaign warmth). WebP encoding and proportional resizing only; no programmatic retouching.

## Validation

Desktop page inspected at 1348 × 926. Mobile page inspected at 320, 393 and 430 CSS pixels. Face and support hand remain readable, and white captions retain their existing layout with localized shading. The shortest viewport retains the existing full-height gallery and can scroll to its lower edge. No form or backend behavior changed.

## Final image prompt

Use case: identity-preserve editorial portrait edit.
Edit target image 1: the existing BeautyPass Korean model portrait. Keep this same adult Korean woman, age around 26, her recognizable facial identity, natural dark brown eyes, skin tone and dark hair. Images 2 and 3 are POSE AND PHOTOGRAPHIC ATTITUDE references only, not identity or hairstyle references. Image 4 is the companion BeautyPass manicure campaign, a reference for photographic warmth and self-possessed lifestyle attitude; do not copy its wardrobe, sunglasses, nail styling or pose.

Create a new accomplished editorial skincare photograph for BeautyPass's full-height portrait campaign card. A believable intimate off-duty moment, photographed close at eye level, rather than a stock skincare demonstration. The model leans forward toward the camera with her shoulders at a slight diagonal, one forearm resting naturally along a low warm limestone ledge at the bottom of the frame. Her chin rests lightly on ONE loosely curled hand under the far corner of her jaw, like the effortless resting gesture in reference 2. The hand is relaxed, fingers naturally bent together, not a fist pressed to the lips; no flat palm like a display shelf, no pointing fingers, no hand at the temple. Only ONE hand is visible, the other remains outside the crop. Believable wrist-to-forearm anatomy. Both cheeks, the mouth and eyes are completely unobstructed. Keep the hand subordinate to the face.

She turns her face only slightly into the light and tilts her head about ten degrees, looking straight into the lens with an assured, relaxed expression and softly closed lips, the faintest suggestion of a smile. This is a magnetic fashion portrait, not a blank beauty catalogue face. Keep the luminous cheek turned to the viewer prominent. Dark hair loosely pulled back low, a few delicate natural wisps near the ear but no loose hair across the cheeks, no styled curls or wet slick hair.

Frame portrait 2:3, from just above the crown to upper torso. Face fairly large in the upper two thirds, eyes approximately 31 percent from the top, chin about 61 percent, hair crown around 7 percent. Slight asymmetry, not centered passport symmetry. Maintain whole face within central 65 percent of the width for narrow mobile crops. The forearm and diagonal shoulder create depth and an intimate perspective at the lower edge, not oversized hands. The face is the sharpest plane; the far shoulder and backdrop soften naturally.

Wardrobe: an expensive finely knitted soft stone-grey/taupe cashmere top with a relaxed wide neckline, modest, one shoulder line subtly visible. It occupies only a small part of the lower corners. Beautiful tactile matte fine knit, neither a bulky sweater nor plain white tee nor black business top nor brown satin. A tiny sculptural brushed-gold stud earring is the only accessory; subtle, not a jewelry advertisement. Natural short unpainted nails, no ring or watch.

Skin is the hero: healthy translucent glass-skin finish, a luminous softly shaped reflection across the near cheekbone and a smaller highlight on the bridge of the nose. Delicate natural pores, subtle rose flush, hydrated lips. Keep forehead, jaw, neck and hand much less shiny; avoid sweaty or oil-coated skin. Minimal makeup, no heavy eyeliner, exaggerated lashes, glitter highlighter or contouring. Do not plastic-smooth the face.

Photographic direction: warm-neutral afternoon window light falling diagonally over one cheek, gently shaded opposite cheek, creamy but not yellow whites, deep soft shadows. Quiet unfocused warm limestone and softly shaded interior behind her, no obvious salon or bathroom, no products or treatment props. A soft-edged architectural window shadow behind her gives a little depth. Rich editorial tonality like the companion manicure image but more fresh and intimate, not uniformly beige or orange. The lower quarter is naturally in soft shade for white website type added later. No artificial vignette, no text, logo, border or watermark. One finished photograph.
