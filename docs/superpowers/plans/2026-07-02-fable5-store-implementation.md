# Fable 5 store implementation — 1:1 port of `GoteFigure Store.dc.html`

> Source of truth: `research/design/GoteFigure Store.dc.html` (fetched 2026-07-02, etag 1783033137105694)
> + assets in `research/design/assets/` (29 files incl. rotem-portrait, signature, wordmark, gote, og/1-11).
> Owner mandate: copy 1:1 — layout, button UIs, screen-transfer animations, everything. No mistakes.
> Locked settings (= the file's own prop defaults): handDrawn=**level 2**, liveArt=**false**,
> dripStyle=**straight**, dropState=**live** (runtime-switchable), editionSize=50, dropLeft=31,
> nextDropDate=2026-07-31T17:00. Toggle machinery does NOT ship; drop state DOES (owner config).

## Design contents (complete inventory from full read)

**Palette v3:** paper `#F7F5F0` · ink `#16130F` · pink `#DA7285` · card `#FCFBF6` · muted
`#8A8478`/`#A29B8D`/`#C9C2B4`/`#5C564A`/`#3E3A31`/`#B5AE9F`. Fonts: Nanum Brush Script (display),
Kalam + Reenie Beanie (hand-drawn L2 skin), Space Mono (mono UI). Grain overlay div (fixed,
multiply, .3) + single feTurbulence #boil filter def (used ONLY on drawer "sealed" badge).

**Screens** (design lines): Arrival intro 44-52 · Header 54-69 · Home 71-327 (hero live 91-116 /
between 118-152; grid 157-267: sticker $6 rabbit-ink, print $28 kaleido, tee $34 trippy (+"N left"
badge), sweat $58 rabbit-pink, original $420 blob-maze dark card, next-drop teaser w/ countdown;
tabs wearables|prints&stickers → filter all/wear/paper (toggle off = all); Rotem section 271-277
(circle portrait 280px, statement, signature.png); Vault strip 279-301 (dark band, og1/4/5/8/11
polaroids, cream ink button "Enter the vault"); footer 303-326 (big signature, newsletter
"Knock →", data-ink-obstacle trust row, "© 2026 gotefigure — every line drawn by one hand")) ·
PDP 330-409 (art|worn|detail thumbs — worn = placeholder slot; placard; sizes XS-XL underline-pill
style; scarcity pulse line; CTA "Add to bag — $N"/"Claim the original — $420"; vaulted state;
measurements details; hand note + small signature) · Vault 411-444 (dark page, "sold out · never
reprinted · not for sale", 11 named pieces: OG Rabbit/hood, Twin Figs/tee, Street Walkers/tee,
Fly Agaric/tee, The Alien/hood, Signed Blank/hood, Golden Fig/tee, One-Line Face/tee, Walkers/hood,
Two Heads/tee, Azrieli Cat/tee — og1..11.jpg; "Back to the living →" cream button) · Satchel
drawer 446-513 (rows w/ qty ±/remove, subtotal + free US shipping + total, "Seal the order" ink
CTA, sealed state: pink boil-circle "sealed" + "it's yours.", empty: drifting alien "nothing yet —
the ink dries fast.", note "prototype — nothing is charged") · flood overlay svg 515-516.

**Products P{}** (line 536-552, verbatim copy incl. placard desc/meta/note fields — e.g. original:
"i can't make another. that's the point."). Cart: localStorage `gf3-cart`; intro session key
`gf3-intro`; seal clears cart → sealed.

**Motion inventory** (all must ship, in module lifecycle per .claude/rules/animation.md):
1. **Scroll brush-stroke** (lines 958-1366) — variable-width ribbon SVG over [data-home-main];
   path: header logo → curve → writes "Gote" (gote.png clip-rect reveal, 4-segment stepped LB
   easing) → underline → past filter chips → weaves [data-la=1..4] anchors alternating bow sides →
   color-INVERTS across [data-doodle-ink] dark band (ink ribbon + cream streaks ↔ cream ribbon2 in
   band, translated into #gf-vault-line-g) → rings #rotem-portrait 1.22 turns (wobbled ellipse) →
   ends at [data-nav=vault] button → vault splash (blob core + 16 satellites + 8 far dots, cream)
   when head ≥ total-6, line group fades. Head lerps 0.16 to scroll target (focus = scrollY +
   0.68vh; checkpoints Y↔len). Width: 4.4+4.4sin(s·.006+1.7)+2.4sin(s·.019+.4), ramp-in s/110,
   word zones narrow ×0.72/×0.66. Edge jitter ±1.3 per sample (STEP 7). Dry-brush streaks: SL/SR
   (off +hw·0.5, w (hw-4.6)·0.22) + SL2/SR2 (off −hw·0.36, w (hw-5.4)·0.24). Splats at data-la-splat
   anchors (blob + 6-9 satellites, axis-biased) pop scale .34s cubic-bezier(.2,1.55,.4,1) when head
   passes. Passive drips: at splats (±2) + every 400-720px; grow 5-14px/s to 46-142px, teardrop
   path, retract 300px/s when head recedes; skip inside dark band. Rebuild on RO (120ms debounce) +
   document.fonts.ready. RAF self-parks.
2. **Ink button v3** (lines 1575-1891) — K: FILL 880, SNAP 430/1.7, SPACING 24, MIN 3 MAX 15,
   MAX_LEN 118, GROW 44, HEAD 3.4, TOPW 7, RETRACT 400, MENISCUS 5, RIPPLE 2.4, FALL 185, SEG 40.
   vs live module adds: **bead** (meniscus overflow along bottom edge, gaussian bumps at run
   roots, amp ramps f 0.9→1); run length distribution 28% 13-37 / 42% 36-80 / 30% 84-118;
   **droplet release** (canRelease if len>74 & p<.55; holdT>0.3s → spawn falling circle, gravity
   1350, r.len×=.78; lands→microSplat 3 ellipses fade); mass-based head bulge (head grows w/ len,
   sin(uπ) swell), neck thinning (1−0.3·len/target), root flare (<10px ×1.9), sine width wobble;
   inset spawn zone (min(H/2,30)+4); tap = fill ×0.7 + drain at +900ms; focus/blur = enter/leave.
   dripStyle straight → obsList always empty (flow-mode routing/pools/gates exist in source but
   MUST NOT ship — strip; keep straight path only). **data-ink-color** (cream #F7F5F0 buttons on
   dark) drives fill/drips/bead + label colors swap. click: data-nav→flood, data-add→cart flow
   (sizeError guard), data-seal→seal, data-submit→form.
3. **Flood nav** (lines 801-859) — cover 620ms from button center → hold 140ms (swap + scrollTo 0
   (+optional data-sec scroll)) → reveal 720ms drain; **fill color from data-flood attr** (cream
   from dark contexts), reset to ink after; `flooding` re-entry guard; reduce → instant swap.
   56-seg wavy circle (amp 26, ramps R/40), reveal 48-seg trailing edge (same math as live module).
4. **Arrival intro** (lines 752-799) — session `gf3-intro`, skipped if reduce; ink dot (organic
   border-radius) falls .62s cubic-bezier(.5,.05,.85,.5) to 46vh; flood covers 760ms from that
   point; wordmark (invert .93 brightness 1.06) fades in 1560ms, out 2660ms; paper hidden; drain
   800ms at 3000ms; skip button always; every timer cleared on skip/unmount.
5. **Quick-add pool** (lines 685-743) — hover: pink pool rises to 140% over 5.2s
   cubic-bezier(.1,.62,.16,.99); at 5.25s: surface flattens (radius 26% 20%/12% 9%), button
   breathes scale 1.018 1150ms ∞, leak droplets every 950ms (fixed-pos spans, stretch+fall+fade);
   leave: drain .45s. Click `_qaFx`: burst pool 130% .3s, scale .93, label→"in the bag ✓",
   **tile splatter** (15-19 pink blobs, random organic border-radius, delay = dist×0.5+rand70ms,
   pop cubic-bezier(.18,.89,.32,1.2), auto-fade 1.5s+stagger), revert at 1050ms, re-pool if hover.
6. **Tile hover** (745-750) — art scale 1.045, pink underline draw (pathLength dashoffset 1→0
   .5s), 2 hanging drips scaleY 0→1 (.8s/.7s, delays .35/.6).
7. **Reveals** (data-rv fade|soak, data-rv-d delay; IO thresh .16 + manual pass at r.top<0.88vh;
   soak = hero art clip-path inset(100%→-3%) 1.5s cubic-bezier(.55,.05,.3,1)).
8. **hand-drawn L2 skin** (861-956) — ALWAYS ON: bake css1+css2 into real component styles (no
   [style*=] hacks needed in our own code): Kalam base + Reenie Beanie overlay fonts (Nanum stays),
   size bumps (10px→15/17, 12-13→16/18-19, 14→17/20 etc.), letter-spacing collapse (.3em→.09/.04em),
   muted colors darkened (#8A8478→#3E382C on paper, →#E6E1D4 on dark), buttons: 3px borders +
   4px 4px 0 currentColor shadow + sloppy radius 255px 22px 225px 28px/…, rotate -0.8deg; tiles:
   sloppy radius 18px 225px…, 2px ink border, 4px 5px 0 shadow, alternating ±0.7deg rotation,
   double-outline ::after ring (+L2 ink-btn ::after ring); header: brush-stroke bottom border
   (inline SVG data-uri) + rotate -0.25deg; inputs dashed bottom; portrait wobbly circle -1.8deg;
   quickadd solid ink pill radius 18px 8px 16px 9px. Keep exact values from source.
9. **Boil badge** (sealed circle) — design uses animated feTurbulence; per perf law implement as
   pre-generated displaced-circle variants stepped ~6fps (RoughFrame pattern), same look.
10. **Countdown** — 1s tick; between-hero (big dd:hh:mm:ss) + next-drop teaser tile (both from
    nextDropDate); label "Aug 1" style month+day. Runs only when a countdown is on screen.
11. **Live Art** (1368-1572) — OFF. Port `_genFace`/`_genBlob`/spawner into
    `site/src/animations/live-art.ts` but DO NOT import in index.ts (owner: "not refined yet";
    zero bundle cost; future flip = one import + config flag).

## Architecture mapping (design SPA → Astro)

- Routes: `/` = home; `/piece/[id]` = PDP (5 ids: sticker/print/tee/sweat/original);
  `/vault` = vault. Screen swaps in design = real navigations here; flood-nav wraps them
  (already the site's pattern) with design timings + per-link ink color.
- Persistent: header, satchel drawer (transition:persist), flood overlay, grain.
- **Drop config = owner control surface:** `site/src/content/drop.json`
  `{ dropState: 'live'|'between', editionSize, dropLeft, nextDropDate }` — build-time read,
  drives both states everywhere (hero, grid vaulted overlays, PDP buyable/vaulted, badges).
- **Catalog = owner allowlist:** `site/src/content/pieces.json` — the 5 P{} entries verbatim
  (id, name, kind, price, art, artW, sized, desc, meta, note) + `vault.json` (11 pieces).
  Only listed pieces render. (Commerce adapter mock keeps powering cart ops; fourthwall flip
  later maps piece.id ↔ FW slug via overlay.)
- Cart: reuse `cart-store.ts` + mock provider, key stays `gf-mock-cart` internally but UI/UX =
  design drawer exactly ("Seal the order" in mock = sealed ritual; when provider=fourthwall,
  seal → checkout redirect).
- Assets: copy design assets → `site/public/art/v3/` (wordmark, gote, signature,
  rotem-portrait, trippy, kaleido, rabbit-ink, rabbit-pink, blob-maze, alien, og/1..11).
  PDP "worn" slot → labeled placeholder panel (never invent; HANDOFF art rule).
- Fonts: @fontsource nanum-brush-script, kalam (300/400/700), reenie-beanie, space-mono
  (400/700). Subset/woff2 via Fontsource. font-display swap.
- Old V2 look retired from home/PDP: the-wink, boil.ts+RoughFrame, ink-trail, scroll-draw,
  scroll-life, micro (pupils/beam), GlyphDust, SectionDivider, YouTubeStrip, intro-sketch —
  removed from bundle (delete or leave unimported; prefer delete, git preserves). about/info
  pages keep old structure for now (design covers the store page only) — they inherit the new
  tokens; flagged for the next design file. 404 keeps rabbit but retoken.
- Reduced motion: global CSS kill (design line 28) + per-module static equivalents (intro
  skipped, fill instant, reveals visible, line static-complete? — design: reduce simply never
  animates; scroll-line = decorative → hidden under reduce like design's *{animation:none}
  wouldn't stop RAF: we explicitly no-op the module and show no line (design parity: line is
  JS-driven, reduce leaves it at zero → not drawn. Match: skip module entirely under reduce).

## Build order (each step = commit; verify before next)

- [ ] A1 tokens v3 + fonts + base (palette, grain, selection, ::selection, reduced-motion kill)
- [ ] A2 content: drop.json, pieces.json, vault.json + types + loader (owner control surface)
- [ ] B1 Layout v3: header (wordmark, The Drop, The Vault, Bag pill), flood svg, grain, drawer shell
- [ ] B2 Home live+between (hero, countdown, grid+tabs+tiles, Rotem, vault strip, footer)
- [ ] B3 PDP `/piece/[id]` (thumbs incl. worn placeholder, placard, sizes, scarcity, vaulted)
- [ ] B4 Vault `/vault` (dark, 11 pieces, back button)
- [ ] B5 Satchel drawer (rows/qty/totals, seal ritual + sealed boil badge, empty state)
- [ ] C1 ink-button v3 module (straight only, bead, droplet release, data-ink-color; binds to
      authored spans — InkButton.astro emits design markup verbatim)
- [ ] C2 flood-nav v3 (620/140/720, data-flood color, data-sec scroll target)
- [ ] C3 arrival-intro module (gf3-intro)
- [ ] C4 scroll-line module (the big one — port _buildLine/_startLineRaf faithfully)
- [ ] C5 reveals + tile-hover + quick-add modules
- [ ] C6 hand-drawn L2 styles baked in (compare against design screenshots)
- [ ] C7 countdown island; live-art.ts ported but unimported
- [ ] D1 cart wiring (adapter mock ↔ drawer UI, seal flow, count sync)
- [ ] D2 old-module/dead-code removal + daily-copy purge on touched surfaces
- [ ] E1 Playwright verification: side-by-side vs design serve_url @1440+375, frame series
      (ink fill/drips/release/snap; flood both colors; arrival; scroll-line milestones incl.
      band inversion + portrait ring + vault splash; quick-add pool/burst/splatter; tile hover),
      reduced-motion parity pass, 0 console errors, JS ≤150KB br
- [ ] E2 build + deploy Vercel + report (live at gotefigure.com)

## Verification ground truth

Design renders live via MCP `render_preview` (re-mint serve_url per hour). Screenshot the real
design + the local build with the ink-lab Playwright pattern (device_scale_factor=2, disable
grain for shots, seed `gf3-intro`), diff visually per section. The design file at locked props
IS the acceptance spec.

## Notes / owner flags

- Design catalog includes tee+sweat; owner says posters first, shirts later — pieces.json is
  the owner-curated allowlist, trivially editable. Ship the design's 5 pieces 1:1 for now
  (mock mode, nothing charged; matches "prototype — nothing is charged" note in drawer).
- `_qaPool` leak droplets use position:fixed spans appended to body — keep but ensure cleanup
  on navigation (module destroy).
- Design's flow-mode drip routing/pools = dead code at locked settings — NOT ported (bundle).
  Source is archived in research/design/ if dripStyle ever flips to flow.
- image-slot.js (drag-drop placeholder helper) is design-app-only — not ported; placeholders
  are static labeled panels.
