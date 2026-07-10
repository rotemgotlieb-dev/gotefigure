# After Hours performance pass — Lighthouse before/after (2026-07-10, W1 Opus sprint)

Measured with Lighthouse 12 against the **built worker** (`wrangler dev` on
`dist/server/wrangler.json`), public After Hours page `/` (the live pre-launch surface).
System Chrome, headless. The gated store is behind the seal and unchanged.

| Metric | Mobile before | Mobile after | Desktop before | Desktop after |
|---|---|---|---|---|
| Performance | 70 | **94** | 99 | 99 |
| First Contentful Paint | 2.6 s | 1.9 s | 0.5 s | 0.5 s |
| Largest Contentful Paint | 5.6 s | **2.7 s** | 0.9 s | 0.6 s |
| Total Blocking Time | 0 ms | 0 ms | 0 ms | 0 ms |
| Cumulative Layout Shift | 0.07 | 0.049 | 0.026 | 0.066 |
| Total byte weight | 876 KiB | **401 KiB** | 875 KiB | 537 KiB |

Mobile: **+24 points, LCP cut from 5.6 s to 2.7 s, page 54% lighter.** Desktop held at 99
(already strong) and got lighter + faster LCP. Desktop CLS rose to 0.066 (still "good",
< 0.1) from lazy images settling; acceptable, noted for a future width/height pass.

## What was load-bearing (from the before run's diagnostics)

- **LCP element = the `ghost` wall image** (a large decorative PNG shown at ~92cqw).
- `modern-image-formats`: 380 KiB / ~1170 ms available by serving next-gen formats.
- All ~600 KiB of salon art loaded EAGERLY, and both the mobile and desktop blocks are
  always in the DOM, so mobile was downloading desktop-only art too, starving the LCP.

## Fixes applied (public After Hours page only, zero visual change)

1. **WebP conversion** of the salon art via `sharp` (q82). 9 of 11 images got smaller
   (598 KiB PNG -> 296 KiB WebP total). Two (`overthinking`, `twins`) were LARGER as WebP
   so they stay PNG. Refs updated in `index.astro`.
2. **`fetchpriority="high"` on the LCP ghost image** so it fetches first.
3. **`loading="lazy"` on the gallery + decorative art** (the 7 framed works, both
   signatures, the desktop wall-tag ghost). Safe here by design: the salon starts DARK
   and the art is revealed only when the visitor "shines the torch", so it is never the
   first paint. The LCP ghost and the header wordmark stay eager.

## Verified (proof by observation)

- Lighthouse re-run on the built worker: numbers above.
- Playwright at 1512x946 and 390x844, lit salon: **0 failed art requests, 0 broken
  images** at both widths; screenshot confirms all art (WebP + the 2 kept-PNG), the ghost
  watermark, wordmark (inverted), and signature (multiply blend) render identically.
- `npm run verify` green (build + dist-lint + 60 tests) after the changes.

## Not done (future, deliberate)

- The GATED store (`/store`, PDP) perf: needs auth to measure; post-launch item. The same
  WebP + lazy pattern applies to `/art/v3/*` when the store perf pass runs.
- Render-blocking font CSS (6 @fontsource imports, ~700 ms on mobile FCP): brand fonts,
  left alone this pass; a critical-font preload could shave FCP further without visual risk.
