# GoteFigure — Design Prototype Brief (for Claude Design)
*Feed this to Claude Design to mock the refined storefront. Then bring it back here to perfect against the real Astro/Fourthwall build. 2026-06-13.*

## The job
Refine the existing GoteFigure V2 storefront (custom Astro + Fourthwall Storefront API, "ink on paper, alive" aesthetic) using the research findings. We already have: category-wall homepage, rough.js boiling frames, two-register type (Shantell hand voice + mono commerce), The Wink intro, announcement bar, square-gallery PDP, cart drawer. This prototype **layers the research-backed conversion + premium-positioning elements onto that foundation** — it is a refinement, not a teardown.

## Brand constants (do not change)
- **Colors:** paper `#F2F1EA` (cream bg, never white), ink `#111111`, amber `#F0A028` (CTAs), teal `#2AA79B` (secondary). `#F27C8D` pink is RESERVED for 2020 OG-archive contexts only.
- **Type:** hand voice (Shantell-style display) for headers/drop names; clean mono/grotesque for prices, buttons, sizes — buying never gets hard to read.
- **Motion:** transform/opacity only; every animation needs a reduced-motion static equivalent. Animation is garnish, never a gate.

## The 6 things to prototype (priority order)

**1. PDP as museum placard** (highest impact)
- Square gallery: flat-lay mockup as primary, 1 on-model render secondary, **+ one macro shot of raw ink texture**.
- Description reads like a placard: medium, tools, hours, the story of the drawing — not fabric blend.
- **Granular sizing table** (exact chest / high-point-shoulder in inches), care notes. Trust row under the CTA (shipping clarity, secure checkout).
- Era badge ("NEW" / "BACK FROM 2020") + price.

**2. Original-art price anchor tier**
- A section/collection showing 3–5 original physical ink drawings at $300–500, several marked "Sold." Makes the $32–35 tees feel accessible. Treat visually as gallery pieces (max white space, no retail chrome).

**3. Permanent "Sold Out" archive**
- A page/section that keeps vaulted drop designs visible forever, marked sold. This is the social-proof graveyard — design it to feel like a hall of past exhibitions, not an error state.

**4. Proof-of-work module**
- Homepage or About: a looping pen-on-paper clip (real footage), framed as proof the art is made by a human hand. Caption ties the daily drawing habit to the products.

**5. Esoteric navigation + microcopy**
- Rename nav away from Shop/About/Cart toward the ink world (e.g. "Ink & Artifacts / The Archive / Manifestos / The Wink"). Keep it legible.
- Microcopy moments: empty cart *"The canvas is blank. The ink has dried. Add an artifact to begin."* · post-purchase *"The ink is set. The artifact is yours."* · 404, newsletter prompt, sold-out state ("gone — for now").

**6. Ink micro-animations**
- Hover states as ink-blot expansions / jittery hand-drawn underlines rather than color fades. Newsletter capture styled as part of the art, not a corporate popup. (Prototype the *feel*; final implementation is GSAP in the real build.)

## Layout to mock (mobile-first — probe at 375px width)
1. **Home** — Wink intro → category wall → proof-of-work loop → newsletter capture → footer with esoteric nav.
2. **PDP** — the placard layout above.
3. **Archive** — sold-out gallery.
4. **Original art** — the anchor tier.

## Out of scope for the prototype
Real checkout (Fourthwall-hosted), real product data, the GSAP/lifecycle engineering. Mock the *experience and hierarchy*; we wire it to the real Astro components afterward.

## When it comes back here
I'll reconcile the prototype against the live `site/` components, the spec (System_Architecture.md §3/§6/§7), and the animation lifecycle rules, then we implement for real.
