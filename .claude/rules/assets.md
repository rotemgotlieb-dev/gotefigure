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
