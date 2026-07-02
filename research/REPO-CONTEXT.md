# GoteFigure — repo context for Claude Design
*Upload this so Design knows what already exists, without a GitHub connection.*

## Stack (the real site)
Custom **Astro 6** storefront, **GSAP** for animation, **rough.js** for hand-drawn boiling frames, **Fourthwall Storefront API** (headless — we own the front-end), deployed on Cloudflare. Mobile-first. The prototype mocks *experience and hierarchy*; we wire it to these real components afterward.

## Brand tokens (use exactly)
- `--paper: #F2F1EA` — cream background, NEVER white. Subtle paper grain.
- `--ink: #111111` — linework, text, dominant graphic voice.
- `--amber: #F0A028` — CTAs, highlights only.
- `--teal: #2AA79B` — secondary accents, pattern fills.
- `--og-pink: #F27C8D` — RESERVED: only on 2020-era "OG archive" products. Pink = history.
- **Type:** hand-lettered display voice (Shantell-style) for headers + drop names; clean mono/grotesque for prices, buttons, sizes.

## What already exists (V2 — refine, don't rebuild)
- Homepage **IS the shop**: a category wall (tees / sweats / hats / prints) with boiling rough.js frames.
- **The Wink** intro module (a measured eye-registration animation on entry).
- Announcement bar; two-register type system (hand voice + mono commerce).
- PDP with a **square gallery**; cart drawer (a11y-done); privacy page; 404.

## The art (the hero — show it BIG)
Real hand-drawn assets to feature, not decorate with:
- `silhouette.svg` — recolorable figure, mask-wipe.
- `nine-heads.svg` — a lineup of 9 heads (one path each). Strong hero candidate.
- `rabbit-stipple` — stippled rabbit contour.
- `alien` — filled creature + textured variant.
- `figure-2` — flagship vector poster (3 melted figures + teal monogram field). Poster/PDP hero.
- `mandala` — 4-fold creature, spins on 90° snaps.
- `glyphs.svg` (+ + = #) and `rabbit-eyes` — interactive accents, stitch bullets.

## Non-negotiable motion rules (from spec §7)
- transform/opacity only. Every animation needs a calm **reduced-motion** static equivalent — motion is garnish, never a gate to buying.
- Must not break at **375px** mobile. Never push the buy button off-screen.

## Voice
Friend-group energy, playful + sincere. Canon line: *"unique wearable art… high quality goods for people who love the niche."* Personality lives in cheap durable places: collection names, badges ("NEW", "BACK FROM 2020"), empty-cart copy, sold-out states ("gone — for now").
