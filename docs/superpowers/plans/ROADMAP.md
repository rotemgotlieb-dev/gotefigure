# GoteFigure Build Roadmap (master checklist)

> Spec: [System_Architecture.md](../../../System_Architecture.md) v1.1 (approved 2026-06-11). Target launch ~2026-06-25.
> Each phase gets its own detailed step-by-step plan written at sprint start (Phase 1's exists: `2026-06-11-phase-1-foundation.md`). This file tracks the whole arc.

## Owner to-dos (Rotem) — dated, from §11

- [x] **Cloudflare account ✅ (2026-06-11)** — remaining: one-time `wrangler login` for first deploy + CI secrets
- [x] **Fourthwall account ✅ (2026-06-11)** — remaining: storefront token (Settings → For Developers → Headless) before Phase 3 day 1; garment picks can follow
- [x] **Registrar ✅ RESOLVED (2026-06-11):** Network Solutions → GoDaddy transfer in flight (5-yr paid, completes ~06-16/18). Phase 6 cutover: GoDaddy nameservers → Cloudflare after transfer completes
- [x] GitHub ✅ — `gh` authenticated (rotemgotlieb-dev); private repo + push handled in-session
- [ ] .ai source-file hunt (blocking per-SKU — §5 fallback table decides what ships without it)
- [ ] Hand-letter ~6 display words (SHOP, ABOUT, CART, GOTEFIGURE…), photograph straight-on
- [ ] Poster-shop test print (figure 2) + price/size quote
- [ ] Per-SKU art fallback decisions at Fourthwall setup (§5 ⚠️ rows: mockup render vs defer)
- [ ] Optional: sketch/WIP photos for About "process moments" (Phase 5, content-permitting)
- [ ] Gemini deep-research: POD comparison + relaunch playbook (feeds Fourthwall config + marketing)
- [ ] Housekeeping: fix YouTube description typo ("entertaning"), confirm/claim X handle

## Phase 1 — Foundation (~1.5 days) → detailed plan exists

- [x] Record repo-layout decision (site code in `site/`) in spec §8.5
- [x] Scaffold Astro 6 in `site/`, Node 22 pinned, dev server verified
- [x] Design tokens (`tokens.css` = §3.1) + base styles (reset, focus states, paper background)
- [x] Font: UI grotesque self-hosted (§13 decision executed); no interim handwriting face
- [x] `Layout.astro` shell: ClientRouter, header nav (logo / Shop / About / cart placeholder), footer, skip-link
- [x] Routes: `/`, `/shop`, `/about`, `404` with correct landmarks
- [x] Vitest smoke tests over built HTML
- [ ] `wrangler.jsonc` (Workers static assets) + deploy scripts; config ✅ + dry-run validated; first deploy when Cloudflare token arrives
- [x] GitHub Actions: build+deploy on push, weekly cron (inert until repo/secrets exist)
- [x] `CLAUDE.md` (≤150 lines, §12 protocol) + `.claude/rules/` (animation §7.6.6, assets §4.1, commerce §8.3)
- **Exit:** branded-empty site builds green, smoke tests pass, deployable to a preview URL

## Phase 2 — Asset pipeline (~2 days)

- [ ] Trace/clean priority art per §4.1 techniques: nine-head lineup (centerline/stroke), silhouette + alien + mandala (filled trace), rabbit eyes (interactive SVG), stitch glyphs set
- [ ] Cleanups: OG Rabbit 02 (gold scribble, bottom bar), Web Hero 3 rotation, alien shadow variant
- [ ] Optimize: SVGO pass, AVIF/WebP photo derivatives, `public/art/` populated
- [ ] Verify each asset animates as §7 specifies (the §4.1 contract — stroke-draw vs mask-wipe)
- **Exit:** production art set, animation-ready, documented in `.claude/rules/assets.md`

## Phase 3 — Commerce spine (~2.5 days)

- [ ] Fourthwall store configured (owner: products, garments, prices, ship-from-home for posters/stickers)
- [ ] Commerce adapter (`src/lib/commerce/`, §8.3 interface, neutral types, TDD)
- [ ] Products overlay (`products.json` per §5 contract) + build-time content layer + fail-loud validation
- [ ] Shop grid (type/era filters, art-first cards, salon-wall sizing) — functional, plainly styled
- [ ] PDP (variants, sizing, add-to-cart) + cart drawer island (token hygiene §8.2, focus-trap, ESC)
- [ ] Checkout handoff → Fourthwall hosted; waiting-rabbit placeholder on async
- **Exit:** a real test purchase completes end-to-end

## Phase 4 — The art layer (~2.5 days)

- [ ] GSAP setup + module lifecycle per §7.6.6 (init/destroy, astro:page-load / astro:before-swap)
- [ ] The Sketch intro (§7.1): draw-on, ≤2s, skippable, sessionStorage-gated
- [ ] Scroll life (§7.2): glyph dust parallax, viewport stroke-draws, marquee divider
- [ ] Ink Bloom PDP transition (§7.3) + reduced-motion crossfade fallback
- [ ] Waiting rabbit loader + 404 page full version (§7.4); cursor-tracked googly eyes + alien beam-up (§7.5)
- [ ] `prefers-reduced-motion` parity audit on every moment
- **Exit:** motion system at 60fps on throttled mid-tier profile (§10)

## Phase 5 — Story & layers (~2 days)

- [ ] Home assembly (hero photo + gradient continuation, featured products, eras strip, video strip, signup)
- [ ] About: origin story, archive faux-feed (IG-post content), YouTube embed, process moments (content-permitting)
- [ ] YouTube RSS build-time fetch + last-snapshot fallback (§8.2)
- [ ] Newsletter adapter + provider pick (§8.4) + sold-out tagged-signup CTA (§6.2)
- [ ] Drops banner reading `drops.json`; microcopy pass site-wide (§3.4 voice)
- [ ] Info pages (shipping/returns honesty incl. split POD/self-ship delivery, contact)
- **Exit:** content-complete site

## Phase 6 — Hardening & launch (~1.5 days)

- [ ] Lighthouse + real-device audit vs §10 budgets (LCP <2s, JS <150KB Brotli); fix violations
- [ ] Accessibility pass: keyboard path shop→checkout, focus states, contrast, alt text
- [ ] SEO: meta, OG image template (build-generated), JSON-LD Product, sitemap; analytics (Cloudflare)
- [ ] Cross-browser/device sweep (incl. Safari + Firefox animation fallbacks)
- [ ] DNS repoint gotefigure.com → Cloudflare; HTTPS + headers verified; old-cert 403 gone
- [ ] Launch checklist: test order on production, refund drill, social links live, weekly-cron rebuild verified
- **Exit:** live on gotefigure.com

## Standing rules for every phase

Builds are manual (no build-by-workflow); research/sweeps go to subagents. TDD on logic-bearing code. Frequent commits. Verify with real browser (webapp-testing) before claiming done. Spec is law — changes get recorded in System_Architecture.md first (§12).
