# After Hours — desktop/mobile merge contract

The desktop build (branch `luxembourg`) and the mobile build (branch `salvador`) target **one
responsive page**. This is the shared surface so the two branches merge with minimal conflict.

## Shared (do not diverge)
- **Route** `/` (site root) · **page** `src/pages/index.astro` · **layout** `src/layouts/AfterHoursLayout.astro` (minimal full-viewport takeover — no store header/footer/cart). After Hours is the pre-launch homepage; the real store home is preserved at `/store` and gated behind the author code.
- **Author gate**: a near-invisible bottom-right dot (`[data-gate]`) → code field; correct code sets `localStorage['gf-preview']` and opens `/store`. Code constant `ACCESS_CODE` in `src/animations/after-hours.ts`. Store pages (Layout) bounce to `/` unless `gf-preview` is set.
- **Tokens** `src/styles/tokens.css`: the `--ah-*` palette + `--font-brush` / `--font-marker` / `--font-typewriter`. (V2 and V3 tokens.css already had the 4px spacing + type scales — nothing was ported; the `--ah-*` group was added.)
- **Fonts** `src/styles/after-hours.css` (@font-face) → `public/fonts/after-hours/*.woff2` (self-hosted latin subsets extracted from the mock).
- **Art** `src/assets/after-hours/*.png` (Astro `<Image>` → webp) + `public/art/after-hours/grain.png` (tiled bg).
- **Motion** `src/animations/after-hours.ts` — `initAfterHours()/destroyAfterHours()`, bound in the layout to `astro:page-load` / `astro:before-swap`. Keyframes `gfah-*` live in the page `<style>`.
- **Email seam**: `localStorage['gf-soon-email']`; real provider is one integration point (see `submitEmail`). Lights memory: `localStorage['gf-ah-found']`.
- **Copy** (em-dashes swapped per the no-em-dash rule): tagline `· after hours`; dark subhead `the shop opens soon. meanwhile, you brought a torch. have a wander.` Everything else verbatim from the mock.
- **Stable IDs**: `#ah-root #ah-header #ah-headline #ah-gallery #ah-notify #ah-signature`.
- **data-hooks** (JS depends on these): `data-stage-back` `data-stage-front` `data-dark` `data-glow` `data-cord` `data-cord-inner` `data-eyes` `data-email-card` `data-email-form` `data-email-input` `data-email-wrap` `data-email-done` `data-h-dark` `data-h-lit` `data-s-dark` `data-s-lit` `data-hint` `data-wm` `data-tagline`.

## The split (each branch owns one block)
- **DOM** is authored in **mobile-flow order** (copy → room/gallery → email → signature → overlays). Desktop absolutely-positions via z-index, so DOM order is free for desktop and correct for mobile.
- **CSS `<style>` has three delimited blocks**: `SHARED` (fonts/colors/keyframes/visual treatment), `MOBILE BASE (< 1024px)`, and `DESKTOP STAGE (>= 1024px)`. Desktop owns the last block; mobile owns the middle one. Merge = keep both blocks.
- **JS** is breakpoint-aware: the fixed 1512×946 scaled stage + torch + cord run only on `min-width:1024px`; `initAfterHours()` returns early on mobile after wiring the email form. Mobile motion (touch reveal, etc.) goes in that early-return branch / a mobile helper — `salvador` owns it.
- Elements with class `.ah-desk` are desktop-only (room lighting, floor, eyes, cord, dark/glow); hidden in the mobile base.

## Known follow-ups (not blockers)
- The `meanwhile: the sketchbooks →` link points to `/notebooks` (a forward reference to a not-yet-built page — currently 404). Wire or remove when that page ships.
- Email provider is a local-storage stub (§8.4 owner decision).
- Mobile base in `after-hours.astro` is a coherent placeholder (`salvador` refines it): iOS-safe (≥16px input, ≥24px tap targets), lit copy shown, torch hidden.
