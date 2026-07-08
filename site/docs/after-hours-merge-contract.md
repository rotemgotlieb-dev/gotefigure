# After Hours — one responsive page (desktop + mobile reconciled)

The desktop build (this branch) and the mobile build (merged into `main` via PR #2) are now
**one responsive page** at `/`. This documents the final unified structure.

## Structure
- **Route** `/` (site root) · **page** `src/pages/index.astro` · **layout** `src/layouts/Immersive.astro` (chromeless full-viewport takeover). After Hours is the pre-launch homepage; the Fable 5 store is preserved at `/store` (+ `piece/[id]`, `vault`, `about`, `info`, `404`) and gated behind the author code.
- **Two blocks, one DOM**, toggled purely by CSS:
  - `[data-ah-block="mobile"]` — the phone salon (cqw stage), verbatim from "After Hours Phone.dc.html". Shown `< 1024px`.
  - `[data-ah-block="desktop"]` — the landscape salon (1512×946 stage scaled to the viewport), 1:1 from "GoteFigure After Hours.dc.html". Shown `≥ 1024px`.
- **One breakpoint-aware module** `src/animations/after-hours.ts` (`defineModule` via core; init on `astro:page-load`, teardown on `astro:before-swap`). It wires the shared gate once, mounts only the active block's torch/cord/email/eyes, and re-mounts the other block on a media-query change. Reduced-motion → static lit in both.
- **Author gate** (shared, single corner element `[data-gate]`/`[data-gate-btn]`): near-invisible 9px dot (44px hit area, 16px input) → code field. Correct `GATE_CODE` (in `after-hours.ts`) sets `localStorage['gf-store-open']` and opens `/store`. Store pages (`Layout`) bounce to `/` pre-paint unless `gf-store-open` is set. Client-side soft gate (not real security — the durable hard gate is a post-hosting Worker/middleware step).
- **Tokens** `src/styles/tokens.css`: the `--ah-*` palette + rgb-triplet lighting tokens + `--font-brush` / `--font-scrawl` / `--font-mono`. Both blocks use them.
- **Assets** `public/art/after-hours/*.png` (one set; `grain.png` tiled bg). Fonts via `@fontsource` (loaded by `Immersive`).
- **Keyframes** `gfahm-*` (global, in the page `<style is:global>`) so JS-set `animation:` refs resolve. Both blocks + the module use them.
- **State keys**: `gf-ah-found` (lights memory), `gf-soon-email` (notify capture, stub provider — one integration point in `submitEmail`), `gf-store-open` (author preview unlock).

## Copy
Verbatim from the mocks except two em dashes swapped to satisfy the no-em-dash rule: tagline `· after hours`; mobile dark subhead `the shop opens soon. you brought a torch. have a wander.` (desktop uses `…meanwhile, you brought a torch. have a wander.`).

## Follow-ups (not blockers)
- Email provider is a localStorage stub (§8.4 owner decision).
- The durable server-side store hard-gate (Worker/middleware + secret) is a post-hosting step; the current gate is client-side.
