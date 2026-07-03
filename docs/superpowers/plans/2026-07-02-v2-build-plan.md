# V2 Build Plan — from "redesign in Fable 5" to a live, converting store

> Written 2026-07-02 after a full-repo deep scan (docs, research, code, ink-lab, art, drift audit).
> Supersedes the phase framing in ROADMAP.md for sequencing; the spec remains law and gets
> updated FIRST per §12. Newest decision layer: HANDOFF.md (monthly cadence, rarity, maker
> visible, ink-button + flood-nav = keep).

## Plan principles

1. **Two tracks.** Track A (truth, rarity model, commerce) is design-independent — do it now so
   the Fable 5 design lands on a store that already sells honestly. Track B (the look) is gated
   on the design landing.
2. **The kept motion system is a contract, not a style.** `data-ink` on any element = ink button;
   flood overlay persists in Layout. The Fable 5 design gets *received into* this system.
3. **Monthly rarity is the conversion model.** One drop a month, limited, never reprinted,
   vaulted forever. Every phase below either builds that machinery or must not contradict it.
4. Labeled placeholders for missing art/products — never invented stand-ins.

## Phase 0 — Truth & doc sync (now, no design needed, ~½ day)

- **Spec first (§12):** record in System_Architecture.md — monthly cadence + rarity/vault model,
  maker-visibility mandate, ink-button + flood-nav as canonical §7 interactions (currently
  un-specced), home-is-shop IA + /shop redirect, Shantell Sans interim decision, square-frame
  system, new launch target. Then sync ROADMAP.md (checkboxes are badly stale in both
  directions), add cadence/rarity/maker rules to CLAUDE.md/.claude/rules/, correction header on
  research/MASTER-PLAN.md (daily→monthly, quarterly→monthly), fix research/_scratch/brand-context.md
  ("draws daily" is now false) and DESIGN-BRIEF.md:27 before any doc feeds another design prompt.
- **Live copy purge (launch-blocking honesty, independent of redesign):**
  - Daily language: index.astro:83-84 maker band + the `Day (\d+)` title parsing at :21-22 (the
    derivation itself must go or every build resurrects the streak), Footer.astro:10 (every page),
    about.astro:31,77,79-80, contact.astro:16-17.
  - False claims: catalog.mock.ts:83,86 (nine-heads "draws itself on the front door" — it doesn't
    anymore), :110 (mandala "loading spinner" — it isn't), NewsletterForm.astro:14 ("8AM sharp"),
    sold-out "gone — for now" → never-reprinted vault voice.
- **Dead-code sweep (REPORT #9, confirmed):** intro-sketch.ts, SectionDivider.astro,
  YouTubeStrip.astro (carries banned copy), unwired drops.json (or wire it in Phase 1),
  rough-notation dep, unused core.ts ease exports.

## Phase 1 — Rarity engine + commerce goes real (pre-design)

- **Drop/edition data model:** extend commerce types (drop month, edition state
  available|vaulted, never-reprinted flag); wire drops.json (next-drop countdown, drop window);
  basic vault surface for the 11-piece OG 2020 archive (display images exist in
  assets-source/og-2020-products/).
- **Overlay contract per rules:** replace silently-defaulting `overlay.ts` with the
  `src/content/overlay/products.json` fail-loud contract (.claude/rules/commerce.md) so renamed
  Fourthwall handles can never silently drop era/type/art.
- **Fourthwall flip (owner-gated):** publish the 4 draft products, storefront token, checkout
  domain → exercise fourthwall.ts live, enable checkout, sanitize CartDrawer innerHTML before
  live data, add a build fallback/failure policy for FW fetches. **Exit: a real test purchase
  completes** (spec Phase 3 exit, still unmet).
- **Newsletter:** pick provider, replace the stub that currently fake-succeeds.
- **Motion theming prep:** lift hardcoded INK/PAPER from ink-button.ts:10-11 + flood fill in
  Layout.astro into CSS custom props / data attrs; extend the paper label clone to survive
  nested markup (cloneNode+recolor) — so the engine is palette- and markup-agnostic the day the
  design lands.

## Phase 2 — Receive the Fable 5 design (the gate)

- Design delivers look/layout/content as static mocks; this repo owns motion + commerce + build.
- Reconciliation pass: map design → tokens.css + Astro components; confirm every animated moment
  has a code plan inside the core.ts defineModule lifecycle (init/destroy, §7.6.6), reduced-motion
  parity, transform/opacity budgets, 375px probe.
- Decide what interim V2 survives (wink, boil, Shantell, ink trail, category wall) — design's call;
  don't litigate beforehand.

## Phase 3 — Build the look for real

- Pages per design: home, museum-placard PDP (granular sizing table, macro ink shot, provenance),
  vault/archive as "hall of past exhibitions", originals anchor tier ($300–500), about/maker, 404,
  info pages. Shareable stable PDP URLs (drop-day deep links).
- Signature motion wired wherever design specifies: `data-ink` CTAs, flood-nav (already global).
  If design wants the hero-scale pour: port `_makeHero` from ink-lab (FLOW_SPLIT/POOL) **with the
  two ribbon-tip fixes** (ink-button.ts:166,172); wordmark draw-on from
  assets-source/gotefigure-wordmark-clean.svg (8-path, animation-ready).
- Maker layer: Rotem visible — name, face/first-person, signature (trace exists). Blocked on owner
  assets (portrait, process footage/photos, hand-lettering).
- Verify with the ink-lab harness pattern: frame series, drip-count/width scaling, reduced-motion
  0-drips instant fill, flood drained after every nav incl. back, zero console errors.

## Phase 4 — Catalog & content fill (owner-parallel)

- Owner uploads: monthly-drop art (none in repo — every current asset is 2020-era), product
  photos/flat-lays, maker/process shots, .ai files (blocking per-SKU per §5 fallback policy).
- Overlay entries + placard copy per product; archive lore for all 11 vault pieces.

## Phase 5 — Hardening & launch

- §10 budgets on real mid-tier device (last measured 58KB gz / 150KB budget pre-ink modules);
  revisit Shantell `full.css` weight. A11y pass, SEO (meta/OG template/JSON-LD/sitemap),
  cross-browser, analytics.
- CI secrets (Cloudflare token) → auto-deploy + weekly cron live; DNS cutover gotefigure.com
  (GoDaddy transfer should have completed ~06-16/18 — verify); production test order + refund
  drill; launch checklist.

## Post-launch (ops rhythm)

Monthly drop cycle (adapt the researched T-14→T+7 sequence to a monthly rhythm), vault each drop
on close, newsletter ~monthly, price-anchor originals maintained, re-derive content cadence from
"busy owner, monthly drops" (the daily-video growth engine is dead; needs a replacement decision).

## Open questions for the owner (blocking marked ⛔)

1. ⛔ OG 2020 archive: sellable evergreen (MASTER-PLAN) vs not-for-sale vault (HANDOFF)? HANDOFF
   presumed to win — confirm, it shapes catalog + archive design.
2. ⛔ Fourthwall go-live: publish products, storefront token, checkout domain, token-commit
   decision, Cloudflare CI secrets.
3. ⛔ Monthly drop contract in writing: window length, real edition limits, the never-reprinted
   promise (only usable if actually enforced).
4. Originals fulfillment: 1-of-1 $300–500 pieces — Fourthwall ship-from-home? Waitlist vs sold?
5. New launch date (June 25 passed) — re-anchor countdown to a real date.
6. Owner asset list: monthly drop art, maker portrait + process footage/photos, hand-lettering
   (~6 words), .ai hunt, flat-lays, figure 1/3 PDFs, Web Hero 2 conversion.
7. Content strategy replacement for daily video (affects proof-of-work module: real pen footage
   source or clearly-labeled teaser).
8. Pricing confirmation vs live Fourthwall base costs ($32–35 tee / $55–65 hoodie targets).
9. Minor: v1-prototype git tag doesn't exist in this remote (REPORT claim); 404's --og-pink CTA
   outside reserved context; whether hats SKU class launches with zero assets.
