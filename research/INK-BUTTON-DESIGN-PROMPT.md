# Ink-Fill Button — paste-ready Claude Design prompt
*Distilled from a 3-way build + judge (SVG vs canvas vs CSS). 2026-06-13. Paste the PHASE 1 block into Claude Design. Hold the later phases until the feel is right.*

---

## PHASE 1 — paste this block into Claude Design

> Build GoteFigure's signature **"ink-fill" button** as a standalone, polished micro-interaction. Work on a BARE page first — just the cream background with two demo buttons. Do NOT touch the main site file yet; we'll integrate after the feel is perfect.
>
> **THE FEEL:** real wet ink filling a vessel, then running down the page. Tactile, satisfying, a little organic — never a flat CSS rectangle sweeping down.
>
> **EXACT INTERACTION (follow precisely):**
> 1. **Idle:** button is "clear" — ~2.5px solid ink (#111) outline, transparent (paper shows through) background, ink-colored label, ~13px radius.
> 2. **On hover:** ink fills **from the top edge, flowing downward**, progressively over ~0.9s until it reaches the bottom. The descending front (the "waterline") must look like wet ink — a slightly irregular, subtly rippling edge, NOT a flat line.
> 3. **Readability:** as ink covers the label, the label flips to paper color (#F2F1EA) so it stays readable — and the flip **tracks the waterline** (label is ink-colored above the line, paper below).
> 4. **When the fill reaches the bottom:** ink **drips** begin — several drips emerge at the bottom edge at varied x positions and run **down the page below the button** (teardrop heads with thin trails), at a moderate pace, with new drips continuing to spawn while hovered.
> 5. **Hold:** while hovered, stays filled and drips keep running down the page.
> 6. **On leave:** the ink **snaps up** — retracts upward fast but smoothly, with a satisfying overshoot, then the button returns to clear and the label flips back to ink.
>
> **USE THIS TECHNIQUE** (it's the best-feeling option and ports cleanly to our real SVG/GSAP site):
> - **Fill** = inline SVG: a black fill clipped by a morphing organic **waterline `<path>`** that descends top→bottom. Build the waterline from a multi-frequency sine ripple **plus a center meniscus bulge** (surface tension — this is what makes it read as *wet* rather than merely wavy).
> - **Label** = two layers: an ink base label + a paper-colored duplicate whose `clip-path: inset()` reveal tracks the waterline. Add a ~1px feather / thin ink-shadow at the crossover so no row of text ever goes near-invisible mid-transition.
> - **Drips** = SVG teardrop `<path>`s (thin neck → growing bulb head), in an `overflow: visible` container with a ~220px fall-zone **below** the button so they run down the page. Spawn only once the fill is essentially full (>0.98), at the bottom edge, at varied x, **biased toward where the crest last broke** (so drips look caused by the fill, not random). Moderate fall speed; new drip ~every 150ms while held; cap ~8–9 so it reads as drips, not a curtain.
>
> **CRITICAL — THE SNAP-UP (make-or-break; the naive easing gets this backwards):**
> On leave the ink must **only ever move UP**. Use an **end-overshoot** (GSAP `back.out` / easeOutBack feel): the ink retracts upward fast, slightly overshoots past empty, then settles. Do NOT use an easing that makes the ink dip/gulp **downward** first (`back.in` / easeInBack does exactly this — it overfills past the bottom before draining, which looks wrong). Verify by scrubbing frames: the ink front should never travel downward during the snap.
>
> **PERFORMANCE:** animate only `transform` / `opacity` / `clip-path` and the SVG path `d`. If you use rough.js for a rough edge, roughen the path **once per state change**, never every frame. Park the animation loop when idle (no work while not hovered).
>
> **EXPOSE THE FEEL AS NAMED KNOBS** at the top of the script so I can tune them live: `FILL_MS` (~920), `FILL_EASE` (easeOutCubic), `SNAP_MS` (~430), `SNAP_OVERSHOOT` (~1.7), `DRIP_SPAWN_MS` (~150), `DRIP_FALL_PXPS`, `DRIP_MAX` (~9), `DRIP_NECK`/`DRIP_BULB`, `MENISCUS_H`, `RIPPLE_AMP`.
>
> **SAFETY:** `prefers-reduced-motion` → instant solid fill on hover, no drips/snap. Touch (no hover) → tap fills + a short drip burst then auto-drains ~900ms so it isn't dead on mobile.
>
> **BRAND TOKENS:** paper #F2F1EA, ink #111111, amber #F0A028, teal #2AA79B; label font 'Space Mono'. Demo with two buttons: a primary **"Shop the drop →"** and **"Add to the Satchel — $34"**.
>
> **ACCEPTANCE:** fill visibly descends with a wet, wobbling front; label readable throughout; drips originate exactly at the bottom edge and run down the page while held; snap-up moves ink only upward with a satisfying end-overshoot; smooth on a throttled phone viewport.
>
> Start with hover→fill→drip→snap **only**. Once it feels right, I'll ask for the next phase.

---

## How to keep iterating in Design (the workflow that'll make this fast)
- **Tune numbers, not vibes.** Once the knobs exist, say "FILL_MS 920 → 1150, DRIP_FALL slower, SNAP_OVERSHOOT 1.7 → 2.1" — concrete tweaks beat re-describing the feeling.
- **Isolated page first, integrate last.** Perfect it on the bare page; only drop it into the main GoteFigure file when the feel is locked.
- **One change at a time on the snap.** The snap-up is the subtle part — change its easing/overshoot alone and re-feel before touching drips.

## PHASE 2 — click = flood-to-navigate (concept)
> Hover is the tease; clicking commits. On click, the ink doesn't just sit full — it **floods**: the ink washes across the whole viewport, and that flood IS the page transition into the next screen (e.g. the PDP). The new page is revealed underneath as the ink drains/"dries." Reuse the same ink visual; make every navigation feel like ink spilling. On-brand with "It's all still wet."

### PHASE 2 — build block (paste into Design, on the same bare page)
> Add Phase 2 on the same bare page — keep the Phase 1 button exactly as is. Add a second mock screen so we can feel the transition in isolation before integrating.
>
> **SETUP:** two mock screens — Screen A (mock "home" with the primary "Shop the drop →" button) and Screen B (mock "product placard" with a "← back" button). One visible at a time.
>
> **INTERACTION — click = flood-to-navigate:**
> 1. **Trigger.** Clicking the primary button commits; if already ink-filled from hover, go straight to flood and cancel any pending snap-up.
> 2. **COVER (~0.6s).** Ink erupts from the button and floods to cover the whole viewport — fast, decisive wash, leading edge an organic wavy ink front (reuse the Phase-1 waterline ripple + meniscus). Blooms from the button and sheets across until the screen is solid ink (#111).
> 3. **SWAP (hidden).** Once fully covered, instantly switch Screen A → B underneath (invisible).
> 4. **REVEAL (~0.7s).** Ink drains away to uncover Screen B — sheets downward off the bottom with an organic wavy trailing edge (a few quick runs), revealing the new page top-down.
> 5. **Back.** "← back" runs the same flood B→A.
>
> **FEEL:** fast + decisive but unmistakably ink (wavy fronts, never hard rectangles); reuse the exact Phase-1 ink color + waterline aesthetic.
> **TECHNIQUE:** one full-viewport fixed SVG overlay with an animated wavy-edge path/clip-path for cover + reveal; transform/opacity/path only; one element, cheap.
> **KNOBS:** `FLOOD_COVER_MS` (~600), `FLOOD_HOLD_MS` (~80), `FLOOD_REVEAL_MS` (~700), `FLOOD_EASE`, `FLOOD_EDGE_AMP`, `REVEAL_DIR` (down|up, default down).
> **SAFETY:** reduced-motion → no flood; fast crossfade / instant swap.
> Build only this; don't touch the main site — we'll wire it to the real Astro transition later.

## PHASE 3 — optional delighter
> **The lingering stain.** On snap-up, leave a *very faint* dried ink mark on the paper where a drip landed, accumulating subtly as the visitor browses (capped, never messy). "The ink is patient" — the site remembers where you were tempted.

## PHASE 4 — ink flows around objects (hero-section ambition; owner idea 2026-06-13)
> A homepage-hero-only signature: ink from the CTA runs **down and flows around the art/objects below it** (nine-heads, rabbit, figure). Build it **Tier 1 = scripted avoidance**, NOT a fluid sim: tag obstacle elements (e.g. `data-ink-obstacle`), read their bounding boxes, and route each ink run's path around them — deflect to the side, pool along the top edge, overflow, continue down. Optional Tier 2: ink pools/fills on a flat top edge then spills. Avoid Tier 3 (WebGL fluid) — too heavy for the perf budget (LCP <2s, JS <150KB).
> **Scope:** hero/landing showcase ONLY — never global. Buy buttons on product pages stay clean (no ink over products). Tier 1 is performant, deterministic, and reads as magic because the layout's obstacles are always known.

### PHASE 4 — build block (paste into Design, on the same bare page)
> Add Phase 4 on the same bare page — keep Phases 1 & 2 intact. Hero showcase: **ink that flows around objects**, built as scripted avoidance, NOT a fluid sim.
>
> **SETUP:** a tall hero (cream). Primary CTA near the top. Below it, in the ink's path, 2–3 placeholder objects tagged `data-ink-obstacle` (a circle + a wide rounded rect, varied sizes), positioned so descending runs hit them. (Real site: these are the hero art.)
>
> **BEHAVIOR:**
> 1. Hover CTA → button fills (Phase 1), then attached runs **pour much further down** the hero (`RUN_LENGTH`, not the short button drips) toward the objects.
> 2. **Flow around:** a run reaching ~`OBSTACLE_GAP` above an object's top edge diverts to the nearer vertical edge, **hugs down it** (offset `OBSTACLE_GAP`), and at the bottom returns to its original x and continues down. Object interior stays **dry**. A run centered on a wide object may **split, hug both sides, rejoin** below.
> 3. Hold → ink drapes around the objects.
> 4. Leave → **two-stage recoil** (Phase-1 style): runs retract up around the objects to the button edge first, then the fill drains up.
> 5. *(Optional `POOL` toggle = Tier 2):* ink pools/thickens on the object's top edge then overflows the sides.
>
> **TECHNIQUE:** read each `data-ink-obstacle` bbox on init + resize only (never per frame); route run SVG paths around them. SVG paths, transform/opacity/path-`d` only. No WebGL/fluid sim.
> **KNOBS:** `RUN_LENGTH`, `OBSTACLE_GAP` (~6), `FLOW_SPLIT` (default on), `POOL` (default off), + existing `DRIP_*`.
> **SAFETY:** reduced-motion → ink shown already-draped, no pour. **SCOPE:** hero-only — Phase-1/2 buttons stay clean.
> Build on the bare page; start with 2 objects + ~3 long runs for legibility, then scale.

## Production note (for when this returns to the real Astro site — not for Design)
- Wrap as `InkButton` with `init()`/`destroy()` bound to `astro:page-load` / `astro:before-swap` (NOT `beforeunload` — it doesn't fire on Astro client nav; would leak/duplicate on 2nd navigation). Kill the rAF + any ResizeObserver on before-swap. (spec §7.6.6 / animation.md rule 1)
- Keep the SVG-path technique: it's the natural DrawSVG/mask-wipe translation and lets rough.js roughen a real path once per state instead of per frame.

---

## REVISION 1 — drips: "attached ink runs," not falling rain (paste into the running Design chat)
*The fill, waterline, meniscus, and label flip are great — keep them. Only the drips are wrong: they detach and fall like rain. Replace the drip model.*

> The drips are wrong — right now they detach and fall down the page like rain. Replace the drip model with **attached ink runs** that ooze down from the button's bottom edge and stay connected to it (like ink running down a wall). Keep the fill, waterline, meniscus, and label-flip exactly as they are.
>
> 1. **Attached, never falling.** Each drip is a continuous run of ink whose top stays **anchored to the bottom edge of the button** — it never detaches. Only the leading head travels downward; the run stays contiguous with the filled button (same ink, visually connected) so it reads as the button *bleeding* ink, not raindrops.
> 2. **Across the whole width.** Distribute ~5–7 runs spread across the full bottom width of the button (slight randomness in position), not a few random points. Vary width and length so it's organic — a couple run longer ("leaders"), the rest shorter.
> 3. **Shape.** Each run is a tapering tendril: a bit wider where it meets the button, narrowing as it descends, with a rounded **bulb head** at the tip (surface tension).
> 4. **Motion.** Runs elongate downward at a **moderate, viscous pace** (ink, not water — slower than the current fall) to a capped max length (they run down the page a bit, not infinitely), then hold while hovered.
> 5. **Snap-up (on leave).** The runs **recoil upward back into the button** — the heads retract up to the button's bottom edge (fast, slight ease) and the runs shorten to zero **at the same time** as the fill snaps up. Nothing detaches or falls away; everything moves up and out together.
>
> Remove the old gravity / falling / fade-at-bottom behavior entirely. New knobs: `DRIP_COUNT` (~6), `DRIP_MAX_LEN`, `DRIP_GROW_PXPS` (viscous), `DRIP_HEAD_R`, `DRIP_RETRACT_MS`. Everything else stays.

---

## REVISION 2 — coverage, sequenced snap-up, always-black text (paste into the running Design chat)
*The attached ink-runs are right — keep them. Three tweaks.*

> Three changes. Keep the fill, waterline, meniscus, and the attached ink-runs as they are.
>
> 1. **More runs, more coverage.** Bump `DRIP_COUNT` from 6 to ~9 and spread them more evenly across the full bottom width (less gap between runs) so the bottom edge reads as *covered* with ink runs — still organic (keep the long-leader / short-run and slight width variation), just not sparse. Don't let them merge into a solid curtain.
>
> 2. **Two-stage snap-up — runs first, then the fill.** Right now the runs recoil and the fill drains at the same time. Sequence them: on leave, **first** the ink runs recoil all the way up to the button's bottom edge (over `DRIP_RETRACT_MS`); **only once they've reached the bottom of the button** does the fill then snap up to the top. Order = runs climb up to the button → then the ink inside the button drains up. Sequential, not simultaneous (a tiny overlap at the handoff is fine for smoothness, but the fill must not start draining until the runs are essentially back at the edge).
>
> 3. **Text always black until covered.** At idle the label was too hard to see (it only went solid black on hover). Fix: the label is **solid ink #111, fully visible at all times** when not covered by ink. It turns **paper-white only where/while ink covers it** (the existing waterline-tracking flip), then returns to solid black as the ink recedes and at rest. So: black at idle → white under ink → black again after. Make sure the idle/base label layer is full-opacity #111, not a faint or hover-dependent color.
