# Overnight Sprint — Phases 3+4+5 (+6-lite) in one pass

> Owner directive (2026-06-11, before sleep): build the complete experience with placeholder products
> ("build everything around it... whole landing page... no corners cut... real artistic style...
> world-class UX"), fix all bugs autonomously, deploy, and leave REPORT.md (aspirations +
> questionable choices). Owner does real Fourthwall products tomorrow.

## Standing decisions for tonight (recorded so the report can reference them)

1. **Commerce provider switch:** `PUBLIC_COMMERCE_PROVIDER=mock|fourthwall` env (default mock).
   Mock catalog = §5 candidates with real Phase-2 art + old-store price anchors. The Fourthwall
   provider is built and tested against the LIVE collections endpoint shape now (token works),
   so tomorrow = flip env + map real slugs in the overlay.
2. **Checkout in mock mode:** honest disabled state — "checkout opens when the real store
   connects" in brand voice. No fake payment step, ever.
3. **Token stays in local .env** (owner hasn't approved committing). CI build of the shop will
   only work after that approval OR with provider=mock; noted in report.
4. **No interim handwriting font** (§13): display = Space Grotesk; margin notes styled via
   italic + squiggle underline. Owner lettering upgrades this later.
5. **Newsletter:** UI + adapter with a `stub` provider (logs + success state, stores nothing);
   real provider account is an owner decision (report).
6. **Spec is law**: §3 tokens/voice, §6 IA, §7 motion incl. 7.6.6 lifecycle, §9 security, §10 budgets.

## Build order (dependencies first)

A. Commerce: `site/src/lib/commerce/` — types.ts / mock.ts / fourthwall.ts / index.ts (TDD)
B. Skill: frontend-design → component system: ProductCard (oval mask, era badge, hover photo
   crossfade), FilterBar, Price, Badge, MarginNote, SectionDivider (silhouette marquee), GlyphDust
C. Pages: shop grid → PDP (`/shop/[slug]`) → cart drawer island → home → about → info → 404
D. Motion (`site/src/animations/`, all init/destroy per §7.6.6): intro-sketch, scroll-life,
   ink-bloom, waiting-rabbit, pupils, beam-up; reduced-motion parity via gsap.matchMedia
E. Content: YouTube RSS build fetch (+ committed snapshot fallback), drops.json banner,
   microcopy pass, info pages
F. Hardening: vitest suites green; keyboard walk; reduced-motion run; JS budget check (≤150KB br);
   Playwright cross-viewport verification (375/768/1280); deploy; design-review workflow panel;
   fix findings; redeploy
G. REPORT.md + memory update

## Exit criteria

- All §6 surfaces exist and feel finished; all four §7 signature moments live on real pages
- `npm run verify` green; browser-verified on 3 viewports; reduced-motion verified
- Live at preview.gotefigure.workers.dev
- REPORT.md: what shipped, aspirations beyond it, questionable choices (each with my
  recommendation), tomorrow's 15-minute owner checklist
