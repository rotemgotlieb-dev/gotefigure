# Asset pipeline rules (spec §4)

- Source art lives in `for NEW site/` + root files; NEVER lift art from IG screenshots (§4.3).
- Techniques (§4.1): line art (nine-head lineup, stipple-rabbit contour) → centerline/stroke
  trace → true DrawSVG. Filled art (silhouette, alien, doodle-camo, mandala) → vtracer/potrace
  filled trace → mask-wipe fake-draw. SVGO every production SVG.
- Known cleanups: OG Rabbit 02 = stray gold scribble top-left + black bar bottom; Web Hero 3 =
  EXIF rotation; alien logo = baked shadow (light bg only); booty.png = skip (redundant twin).
- Photos: AVIF/WebP responsive via Astro assets. Hero candidates: profile pic.jpg, Web Hero 3 (fixed).
- Phase 2 exit = each asset ANIMATES as §7 specifies, not merely "SVG exists".
- Handoff formats from owner: SVG > PNG/JPG ~1500–2000px > PDF (§4.4).

## Production inventory (Phase 2, 2026-06-11)
| file | class | status |
|---|---|---|
| silhouette.svg 9KB | mask-wipe, currentColor recolorable | final-ish |
| nine-heads.svg 34KB, 9 paths (one per head) | mask-wipe (DEVIATION: filled trace; centerline=stretch pending .ai) | interim |
| alien.svg 81KB + alien-textured.webp | mask-wipe / raster display | final-ish; baked shadow = light bg only (dark-bg variant deferred) |
| glyphs.svg (5 symbols) + rabbit-eyes.svg (pupil ids) | STROKED true DrawSVG / interactive | final (hand-authored) |
| mandala.svg 19KB | 90°-snap spinner | interim (low-res source) |
| figure-2.svg 1.3MB | TRUE VECTOR — poster/PDP lazy-load ONLY, never inline | final |
| rabbit-stipple.png | raster + Phase-4 hand contour | gold fill removed; residual ink curl at left ear awaits .ai |
| rabbit-cameo.webp, 10 photos in src/assets/photos/ | display rasters | hero-sunset-marina = upright portrait |
| assets-source/gote-signature-crop.png | logotype source | trace in Phase 5 with hand-lettering |
