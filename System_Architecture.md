# GoteFigure — System Architecture (Master Blueprint)

**Version 1.1 — 2026-06-11 (post-review) · Status: pending owner sign-off · Target launch: ~2026-06-25 (2-week window)**

This is the global context document for all GoteFigure build sprints. Every coding session starts from the decisions recorded here. Sections are numbered so sprints can reference and load only what they need (token discipline — see §12).

---

## 1. Project overview

**GoteFigure** (gotefigure.com) is an art-based clothing brand founded in California during COVID (2020), dormant since ~late 2021, relaunching in 2026. The owner (Rotem) is an artist with a young YouTube channel (@gotefigure, ~47 subs, channel ID `UCPyn9ALLFF4Z37Tc64ujd1Q`) posting art content. The site is a passion project and a real storefront.

**Mission:** a storefront that *feels like art* — hand-drawn, alive, shareable ("oh my god, this is so cool") — while remaining a clean, fast, friction-free shop on both mobile and desktop.

**Success criteria, in priority order:**
1. Selling works flawlessly: browse → product → cart → checkout with zero confusion, on a phone.
2. The site is visibly *his art, moving* — distinctive enough that people share it.
3. ~$0/month fixed running cost (hard ceiling $5); owner can operate it alone.
4. Feeds the YouTube ↔ store flywheel.

**Anti-goal:** a generic template with art pasted on (the old site was Shopify's stock "Debut" theme — its layout is explicitly NOT an influence; its *content* — product names, about copy, logo — is reused).

## 2. Hard constraints

| Constraint | Value |
|---|---|
| Fixed monthly cost | ~$0, ceiling $5/mo (Fourthwall $0/mo + Cloudflare free tier) |
| Fulfillment | Mixed, undecided per-line: apparel leans POD; posters + stickers printed locally (poster shop near owner) and self-shipped. Architecture must keep fulfillment **swappable per product** |
| Payment security | Card data must never touch our code (hosted checkout only) |
| Mobile | First-class; all signature moments work on mid-range phones |
| Accessibility | `prefers-reduced-motion` fully honored; shopping never requires interaction tricks |
| Timeline | ~2 weeks of sprints |
| Token economy | The standing Token Optimization Protocol applies to every sprint (§12) |
| Hosting ToS | Vercel free tier prohibits commercial use (verified 2026-06) — **do not deploy there**. Cloudflare free tier (Workers static assets) allows commerce |

## 3. Brand & design language — "Ink on paper, alive"

The site is a sheet of sketchbook paper; the art on it behaves like wet ink.

### 3.1 Color tokens

```css
--paper:      #F2F1EA;  /* base background — cream, never sterile white */
--ink:        #111111;  /* linework, text, dominant graphic voice */
--amber:      #F0A028;  /* 2026 accent — CTAs, highlights */
--teal:       #2AA79B;  /* 2026 accent — secondary, pattern fills */
--og-pink:    #F27C8D;  /* RESERVED: 2020-era products & archive only — pink means history */
--sunset:     #E8836B;  /* photographic bridge (from lake/sunset shots) — gradients, warm moments */
--paper-dim:  #E5E2D8;  /* cards, wells, dividers */
```

Rule: 2020-era pink/bubblegum world appears *only* inside archive moments and OG-era product theming. Section backgrounds may flood with `--teal`/`--amber` for contrast moments; body stays paper.

### 3.2 Typography

- **UI voice (functional):** one clean characterful grotesque (free, e.g. Fontshare class — final pick in build sprint) for prices, buttons, body, sizes. Buying never gets hard to read.
- **Hand voice (display):** traced from the owner's hand: the handwritten **"Gote" signature** (visible in `marketing/pullover-hoodie-mockup-…png`, bottom-right) becomes the logotype. Owner hand-letters ~6 key words (SHOP, ABOUT, CART, drop names) on paper → photographed → traced to SVG.
- **Margin notes:** small handwritten annotations beside products/photos ("printed 10 min from my house", "the OG — back from 2020"). Implemented as SVG/lettering or a high-quality handwriting face; never used for functional text.

### 3.3 Texture & ornament system

- **Stitch glyphs** (`+ = #` — from the rabbit art's plush crosshatch): list bullets, link-hover underlines, sparse parallax dust layer behind grids (drifts at ~0.3× scroll).
- **Paper grain:** subtle, on backgrounds (CSS/SVG noise, near-free).
- **Oval/cameo mask** (from *OG rabbit pink backround*): the image-mask system for photos & product cards.
- **Doodle-camo** (root screenshot 12.31.56): `background-clip: text` fill inside big display headlines; product-card hover accents.
- **Mirrored rabbit silhouette** (*double pink fig reflection*): marquee divider strip between sections, recolorable per section.
- **Hand-drawn squiggle underlines** on hover/active links.

### 3.4 Voice & microcopy

Friend-group energy of the 2020 captions, tuned for 2026: playful, unfiltered, sincere. Personality lives in cheap durable places (Arhoj pattern): collection names, filter labels, badges ("NEW", "BACK FROM 2020"), empty-cart copy, sold-out states ("gone — for now"), newsletter ask. Owner's old about copy is canon source material: *"unique wearable art… high quality goods for people who love the niche."*

### 3.5 The era system

Catalog mixes **OG era (2020–21)** and **New era (2026)**. Eras are a first-class product attribute: filterable in shop, badged on cards, pink-themed for OG. The archive (old IG posts as a lo-fi faux-feed in About) makes brand history a feature, not baggage.

## 4. Asset inventory (ground truth from 2026-06-11 analysis)

All paths relative to project root. Quality caveats are load-bearing — respect them in build sprints.

### 4.1 Art (designs folder + root) — the soul

| Asset | Use | Caveats |
|---|---|---|
| `for NEW site/designs/double pink fig reflection.png` | Most web-ready: single-color mirrored silhouette → SVG (auto-trace, zero loss). Marquee divider, watermark, load animation (halves slide in & snap) | None. Transparent bg, 2709×2586 |
| `for NEW site/designs/alien LOGO.profile-01.png` | THE logo: favicon, nav mark; visor band = natural progress bar | Baked black drop shadow (light bg only); simplify scribble fill at small sizes. Transparent bg, 5334×4267 |
| `for NEW site/designs/OG rabbit pink backround.png` | Cameo-frame device; cursor-tracking googly eyes; hero/about art | Rabbit baked into oval; isolating = redraw (flat fills, feasible). 2795×5588 |
| `for NEW site/designs/OG Rabbit 02.png` | Soul piece: stipple ink rabbit. 404 page, story page, stroke-draw contour + raster stipple fade-in | Stray gold scribble top-left + thin black bar bottom edge — clean before use. 2265×5173 |
| `Screenshot …12.32.28 AM.png` | **Hero animation source**: nine ink heads, small→large lineup, auto-traces cleanly | ~960px screenshot; right ear slightly cropped; re-export from .ai when found |
| `Screenshot …12.32.20 AM.png` | Spot illustrations / avatar set (Illustrator session, dozens of heads) | UI chrome to crop; overlapping heads need .ai source for clean cuts |
| `figure 2.pdf` | Flagship vector poster art (3 melted figures + teal monogram pattern field). Hero/parallax layers; the teal tile extracts as standalone brand texture; **a poster-print SKU candidate itself** | Single page; figure 1/3 may exist — ask owner |
| `Screenshot …12.31.14 AM.png` | 4-fold mandala creature → loading spinner (90° rotation steps map onto itself) | Low-res screenshot (~230px) — needs re-export/trace |
| `Screenshot …12.31.48 AM.png` | Wiggle-line sticker blob — hover-jitter element; **sticker SKU candidate** | Low-res (~220px) — re-export/trace |
| `Screenshot …12.31.56 AM.png` | Doodle-camo texture (headline fills, hover accents) | Low-res; not seamless — needs tile work or .ai source |

**Animation-readiness (Phase 2 contract):** auto-tracing yields *filled* paths, but GSAP DrawSVG animates *stroked* paths — the technique must match the asset. Line art (nine-head lineup, squiggle underlines, stipple-rabbit contour) → centerline/stroke trace, true stroke-draw. Filled art (silhouette, alien, doodle-camo, mandala) → filled trace (vtracer/potrace) + mask-wipe reveal that fakes the drawing motion. Phase 2's exit criterion is not "SVGs exist" but "each asset animates as §7 specifies."

### 4.2 Photography (marketing folder)

**Hero-grade:** `profile pic.jpg` (nine-eyes tee at sunset — best image in set, 4032×3024); `Web Hero 3.jpg` (sunset marina — **fix EXIF rotation**, lift shadow, crop marina clutter).
**Strong product-in-context:** `post 2.jpg` (alien tee front+back in one frame), `Alien tee-2.jpg`, `trippy tee 01.jpg` (swirl tee), `mushroom tee 02.jpg` (only mushroom-tee view).
**Atmosphere only:** `boat 1-3.jpg`, `boat 2-2.jpg`, `IMG_3126-2.jpg` (crop above waist for general use; `booty.png` is its redundant lower-res twin — skip).
**Not website-grade:** the two mirror selfies, the stock hoodie mockup (but extract its "Gote" signature + pink sneaker-legs art recolor proof).
**Gap:** no clean flat-lays exist for any product — placeholder strategy: art-on-garment-color cards (see §6 Shop) until owner shoots flat-lays.

### 4.3 IG posts folder

Phone screenshots with IG chrome — **never lift art from these**; they are archive-content material (About page faux-feed) and design-language reference (colorway triptych, drop-announcement voice). All original art must come from source files.

### 4.4 Owner asset to-dos (non-blocking for the architecture; the .ai hunt is blocking per-SKU — see §5 fallback policy)

1. Locate .ai source files (Illustrator session screenshots prove they exist) + possible *figure 1/3* PDFs.
2. Hand-letter ~6 display words on paper, photograph straight-on.
3. Eventually: flat-lay or clean product shots per SKU; confirm crochet bucket hat as SKU or not.
4. Process material, when convenient: photos of paper sketches / WIP shots of pieces that became products (feeds the §6 About "process moments"). Format guidance for ALL future art handoffs: **SVG exports from Illustrator are the ideal format** (text-based — costs Claude almost nothing to read AND is production-ready); otherwise PNG/JPG at ~1500–2000px; avoid PDFs where an export exists.

## 5. Catalog model

Three product types × two eras. Reconstructed candidates with their **art source** — the honest per-SKU status (final picks = owner decision in Fourthwall setup):

| Candidate | Type / era | Art source for site |
|---|---|---|
| Alien/UFO tee (front & back) | apparel / og | ✅ `alien LOGO.profile-01.png` |
| OG Rabbit pink hoodie | apparel / og | ✅ OG Rabbit PNGs |
| Stipple rabbit poster | poster / new | ✅ `OG Rabbit 02.png` (after §4.1 cleanup) |
| *figure 2* poster | poster / new | ✅ `figure 2.pdf` (print-ready vector) |
| Stickers (alien, wiggle-blob, glyphs, mandala) | sticker / new | ✅ traceable; better from re-export |
| Nine-eyes tee, swirl tee, mushroom tee, goggle-bunny hoodie | apparel / og | ⚠️ photos only — needs .ai hunt |
| Sneaker-legs tee/hoodie | apparel / og | ⚠️ mockup-visible only — needs .ai hunt |
| Strut Walk, Astro Kitty, Masked Faces, Double Headed Figure, Triple Figure | apparel / og | ⚠️ IG screenshots only (lifting forbidden, §4.3) — needs .ai hunt |

**Fallback policy for ⚠️ SKUs (closes the circular fallback):** the .ai hunt is *non-blocking for the architecture but blocking per-SKU*. Any SKU without site-grade art at Phase 3 either (a) uses its Fourthwall mockup render as card face — an explicit, owner-approved exception to the art-first rule — or (b) defers from launch. Owner decides per SKU during Fourthwall setup. Old price anchors: tees $20–22, hoodies $40.

Product data is **build-time content** (Astro Content Layer) hydrated from the Fourthwall Storefront API + a local overlay file for site-only fields.

**Overlay contract** (`src/content/overlay/products.json`): keyed by **Fourthwall product slug/handle**. Required fields: `type` (`apparel | poster | sticker` — drives §6.2 filters, card sizing, the cart sticker row, and the PDP provenance line) and `era` (`og | new`). Optional: `marginNote`, `artSvg` (path in `public/art/`), `lifestylePhoto`. The build **fails loudly** on an overlay key with no matching Fourthwall product (a renamed handle must never silently drop a product's era/art/type).

## 6. Information architecture — six surfaces

**Nav (all viewports):** alien logo (→ home) · Shop · About · cart icon (drawer). No hamburger mazes; thumb-reachable on mobile.

1. **HOME — the gallery door.** Intro animation (§7.1) → full-bleed hero (`profile pic.jpg` or rotated `Web Hero 3`, page background continues the photo's sky as a sampled CSS gradient) → featured products (3–4) → "two eras" teaser strip → latest 3 YouTube videos (build-time RSS) → email/drops signup → footer (socials, the stitch-glyph dust settles here).
2. **SHOP — the core.** Filter: type (Apparel / Posters / Stickers) × era (OG '20 / New '26), with personality labels. **Product art, not photography, is the card face** — art on a flat garment-color swatch inside the oval mask; hover/long-press crossfades to the mapped lifestyle photo (Online Ceramics motion pattern, near-zero JS). Poster/sticker cards sized differently than apparel — salon wall, not warehouse grid. Sold-out: "gone — for now"; its CTA is the §8.4 newsletter signup with the product name attached as a tag/note — there is no per-product restock backend, and none is needed.
3. **PRODUCT (PDP) — the signature moment.** Ink Bloom entry (§7.3). Art front-and-center; garment-color/size variants; honest sizing note; one unmissable add-to-cart (alien beam-up micro-animation on add, §7.5); lifestyle photo where one exists; margin-note annotation; posters get the local-print provenance line; related items strip.
4. **ABOUT — the story.** Founded-in-COVID origin → dormant years owned, not hidden → archive: old IG posts as a lo-fi faux-feed (drawn phone bezel, captions/comments preserved verbatim — "This is hella sick") → the 2026 chapter: YouTube embed + subscribe hook + latest videos. Stipple rabbit stroke-draws on scroll-enter. **Process moments (owner request, content-permitting):** the art is made paper → ink → Illustrator vector; show that as small "evolution strips" (sketch / ink / final) beside featured pieces — the nine-head small-to-large lineup already speaks this language.
5. **CART — slide-out drawer**, never a page-leave. Ink-styled; sticker impulse row; clear shipping expectations (POD items ship separately from posters — say so honestly); single CTA → Fourthwall hosted checkout. Waiting rabbit (§7.4) during cart API calls.
6. **404 — the shareable easter egg.** Full-bleed OG Rabbit 02, spiral-spinning googly eyes, chattering buck teeth, handwritten "nothing here, man" + link home.

Secondary: shipping/returns + contact (simple paper pages, Fourthwall handles POD support); legal minimum (privacy — no tracking beyond privacy-friendly analytics, §10).

## 7. Motion system

### 7.1 The Sketch (first load)
Nine-head lineup draws itself L→R, small→large (GSAP DrawSVG, staggered ~120ms). **≤2s, skippable on any input, `sessionStorage`-gated to once per session.** The static site is already painted beneath — theater, not a loading gate. Never blocks LCP.

### 7.2 Scroll life
Stitch-glyph dust parallax (~0.3×); artworks stroke-draw on viewport entry (ScrollTrigger); silhouette marquee dividers; era strip color-floods on scroll. Native scrolling — **no scroll hijack**. Lenis smooth-scroll is *optional polish only*, desktop-only if used, disabled under reduced-motion.

### 7.3 Ink Bloom (product view)
Card oval expands to fill viewport (View Transition) while the product's art rapidly re-draws in scratchy strokes (DrawSVG fast pass); details slide up beneath. Fallback (no view-transition support / reduced motion): clean crossfade.

### 7.4 The waiting rabbit (system loading language)
Any genuine async wait (cart sync, checkout handoff): compact OG Rabbit, googly eyes spinning. Same character full-size on 404. One language everywhere the system breathes.

### 7.5 Micro-layer
Cursor-tracked googly pupils (one eye lags ~80ms — the deranged charm; clamped radius); add-to-cart = alien beams item to cart icon (cone-of-light gradient + fly-to-cart); hand-drawn squiggle hover underlines; eye-blink on hover over rabbit art.

### 7.6 Motion rules (non-negotiable)
1. Animation is garnish, never a gate — every purchase path works with zero tricks.
2. `prefers-reduced-motion`: all of §7.1–7.5 replaced by static/instant equivalents (gsap.matchMedia).
3. GPU-cheap properties only (transform/opacity); 60fps on mid-range mobile.
4. CSS scroll-driven animations (`animation-timeline`) = progressive enhancement behind `@supports` only (Firefox still flag-gated as of 2026-06).
5. Intro ≤2s, once per session, skippable. No animation ever delays content paint.
6. **View-transition lifecycle (load-bearing):** with ClientRouter, module scripts execute once per session — not per page. Every module in `src/animations/` exposes `init()`/`destroy()`: `init()` binds on `astro:page-load`; all ScrollTriggers, event listeners, and `gsap.matchMedia` contexts are reverted/killed on `astro:before-swap`. Violations work on first load and silently die or duplicate on the second navigation (stale ScrollTriggers on swapped-out DOM also leak memory). The §7.1 sessionStorage gate protects only the intro; this rule protects everything else.

## 8. Technical architecture

### 8.1 Stack (versions verified 2026-06)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Astro 6** (6.4.x, stable since 2026-03) | Static-first, zero default JS — JS budget goes to art; Content Layer for catalog; islands for cart; ClientRouter view transitions |
| Animation | **GSAP** (Webflow acquired GSAP 2024-10; everything incl. ScrollTrigger, DrawSVG, MorphSVG, SplitText free since 2025-04; license forbids only competing no-code animation tools) | The exact toolset for hand-drawn SVG motion |
| Commerce | **Fourthwall** ($0/mo, 0% platform fee on physical, ~2.9%+30¢ processing pass-through) via **Storefront API** (free, all creators; read products/collections, cart create/manage; checkout = hosted redirect via cart token) | Mixed fulfillment per-product (POD + ship-from-home + 3PL coexist); creator/YouTube-native; MIT reference template exists (FourthwallHQ/vercel-commerce) |
| Hosting | **Cloudflare Workers static assets** free tier (commercial allowed; static requests unlimited; the 100k/day cap applies only to Worker/Function invocations, which this site doesn't use). Conscious choice: Cloudflare Pages has been in maintenance mode since 2025-04 — Workers static assets is the recommended successor and Astro 6's Cloudflare adapter is Workers-first; Pages remains an acceptable fallback | Vercel Hobby prohibits commerce; Netlify free is credit-metered |
| Styling | Vanilla CSS with design tokens (§3.1) + scoped Astro styles | No framework tax; tokens are the theme |
| Cart island | One hydrated island (vanilla TS or preact-class tiny lib — build-sprint pick), localStorage-persisted Fourthwall cart token | Single point of interactivity |
| Analytics | Cloudflare Web Analytics (free, cookieless) | Privacy-friendly, zero config |

### 8.2 Data flow

Rebuild mechanics: CI builds on git push; a **GitHub Actions weekly cron** runs build+deploy; the owner's "rebuild now" control is the same workflow's **manual Run button** (GitHub → Actions → deploy) after Fourthwall dashboard edits (optionally wired to Fourthwall `PRODUCT_UPDATED`/`COLLECTION_UPDATED` webhooks later). Build quota: if CI builds run in GitHub Actions with `wrangler deploy`, Cloudflare imposes no build cap at all (Workers Builds' own free tier meters ~3,000 build minutes/mo; legacy Pages allowed 500 builds/mo) — any of these fits this cadence with enormous margin. Build policy: a failed Fourthwall product fetch **fails the build loudly** (never ship an empty shop); a failed YouTube RSS fetch falls back to the last committed snapshot.

```
BUILD TIME (git push · weekly cron → deploy hook · owner "rebuild now" hook)
  Fourthwall Storefront API ──> products/variants/prices/stock ──┐
  src/content/overlay/*.json ──> era, margin notes, art refs ────┼──> Astro Content Layer ──> static pages
  YouTube RSS (videos.xml?channel_id=UCPyn9ALLFF4Z37Tc64ujd1Q) ──┘     (no API key, no quota)

RUNTIME (browser only — there is no server of ours)
  Cart island ──> Fourthwall Cart API (public storefront token)
  Checkout CTA ──> redirect to Fourthwall-hosted checkout (cart token)
  Newsletter form ──> email provider endpoint (adapter, §8.4)

OPERATIONS (owner)
  Orders/refunds/support/POD config ──> Fourthwall dashboard (single pane)
  Posters/stickers ──> "ship from home" orders arrive by email/dashboard
```

Stock display note: static pages cache availability at build time; the cart API is the runtime truth — sold-out races resolve at checkout (acceptable at this volume; the weekly cron plus owner-triggered rebuilds keep drift small, and keep §10's JSON-LD price/availability honest).

Cart-token hygiene: the cart island validates the stored token via `getCart()` on init and **discards it on a 4xx** (expired/invalid); the token is cleared when the checkout CTA fires — Fourthwall owns the cart from there, so returning buyers never see a stale cart of already-purchased items. Cart API *failures* show an honest inline retry message; the waiting rabbit (§7.4) covers loading, not failure.

### 8.3 Commerce adapter (the swap seam)

All commerce calls go through `src/lib/commerce/` exposing exactly: `getProducts()`, `getProduct(handle)`, `createCart()`, `getCart(token)`, `addToCart(token, variantId, qty)`, `updateItem(token, lineId, qty)` (qty 0 = remove), `getCheckoutUrl(token)`. The directory defines the neutral domain types — `Product`, `Variant`, `Cart`, `LineItem` — and **no Fourthwall types leak outside it**. Fourthwall is implementation #1; a future move to Shopify/Stripe = new implementation file + re-point; pages and islands never change.

Fourthwall reality notes for the build sprint: there is **no list-all-products endpoint** — `getProducts()` = List Collections → Get Collection Products; PDPs use Get Product by Slug; auth is the `storefront_token` passed as a query parameter.

### 8.4 Newsletter adapter

`NewsletterForm` island posts through a one-function provider adapter. Provider = build-sprint decision (free-tier candidates: Buttondown / MailerLite / Kit); zero architectural risk. Drop-announcement bar (old caption voice: "ALL NEW DESIGNS DROPPING [date] 8AM" + countdown) reads from a single `drops.json` — no backend.

### 8.5 Repo structure

Layout decision (Phase 1): the repo root is this working folder (blueprint + asset sources + docs); the Astro project lives in **`site/`**. The tree below describes `site/`'s internals — except its first three entries (`System_Architecture.md`, `CLAUDE.md`, `.claude/rules/`), which live at the repo root so every sprint loads them regardless of cwd.

```
gotefigure-site/
├── System_Architecture.md      # this document (canonical copy lives in repo)
├── CLAUDE.md                   # ≤150 lines: token protocol + trigger index (§12)
├── .claude/rules/              # on-demand topical rules (animation, assets, commerce…)
├── src/
│   ├── content/                # products overlay, drops.json, copy
│   ├── lib/commerce/           # adapter (§8.3) — Fourthwall impl
│   ├── lib/youtube.ts          # build-time RSS fetch
│   ├── components/             # Astro components; islands clearly suffixed *.island.*
│   ├── animations/             # GSAP modules per signature moment (§7.1–7.5)
│   ├── pages/                  # index, shop, product/[handle], about, 404, info pages
│   └── styles/                 # tokens.css, base.css
├── public/art/                 # production SVGs/rasters (traced, cleaned)
└── assets-source/              # originals + tracing workbench (gitignored if heavy)
```

## 9. Security model

1. **Card data never exists in our system** — checkout is Fourthwall-hosted (PCI-DSS theirs). A compromise of our site cannot leak payment data.
2. **No server, no database, no auth, no stored PII** — static files on Cloudflare's edge. Attack surface ≈ a poster.
3. Browser-visible token = Fourthwall *storefront* token: **public-by-design, scoped to storefront reads plus anonymous cart operations** (create/mutate carts) — no order, customer, or admin access. Worst-case abuse is cart spam, which lands on Fourthwall's infrastructure, not ours. Secrets (if any ever) live in CI env vars only — never in the repo.
4. HTTPS enforced + security headers (CSP, frame-ancestors, referrer-policy) via Cloudflare/Astro config.
5. Newsletter form: provider-side double-opt-in; no emails stored by us.
6. Dependencies pinned via lockfile; Dependabot/`npm audit` in CI.

## 10. Performance, accessibility, SEO budgets

- **Performance:** LCP < 2.0s mid-range mobile; total JS < 150KB **compressed (Brotli) transfer** — the basis matters: GSAP's compressed reality is core ~27KB + ScrollTrigger ~18KB + DrawSVG ~2KB ≈ 47KB, leaving ~100KB for the cart island, ClientRouter, and animation modules (raw-minified numbers would falsely show the budget blown). Budgets are measured on a fixed mid-tier profile: Chrome DevTools 4× CPU throttle + Fast 4G, or a physical Moto-G-class device. Images AVIF/WebP responsive via Astro assets; fonts ≤2 families, subset, `font-display: swap`; intro never delays paint (§7.1).
- **Accessibility:** WCAG 2.1 AA contrast on paper/ink palette; full keyboard path through shop→cart→checkout CTA; focus states in the squiggle language; reduced-motion parity (§7.6); alt text written in brand voice but descriptive; cart drawer focus-trapped + ESC.
- **SEO/launch:** DNS cutover after the GoDaddy transfer completes (~2026-06-16/18): at GoDaddy set nameservers → Cloudflare, add the zone in Cloudflare, attach gotefigure.com as the Worker's custom domain (kills the dead-Shopify expired-cert 403); per-page meta + OG images (static art-led template composed with each product's art, generated at build); JSON-LD Product schema (price/availability kept honest by the §8.2 rebuild hooks); sitemap; cross-link YouTube/IG/X profiles (the brand currently has zero search footprint — uncontested name, easy wins). Owner: fix YouTube description typo ("entertaning"), confirm/claim X handle (@gotefigure returned 404 on 2026-06-11).

## 11. Build phases (2-week shape; detail lives in the implementation plan)

1. **Foundation** — repo, Astro 6 scaffold, tokens, fonts, layout shell, Cloudflare deploy pipeline. *Exit: empty-but-branded site live on a preview URL.* (The preview-URL deploy may trail the rest of Phase 1 if Cloudflare credentials arrive late — it must exist before Phase 2 ends.)
2. **Asset pipeline** — trace/clean priority art (nine-head lineup, silhouette, alien, rabbit eyes, glyphs); rotation/cleanup fixes; production SVG set. *Exit: `public/art/` populated AND each asset animates as §7 specifies (the §4.1 contract).*
3. **Commerce spine** — Fourthwall store setup (owner) + adapter + content layer + shop/PDP/cart-drawer functional with placeholder styling. *Exit: a real test purchase completes.*
4. **The art layer** — §7 signature moments + micro-layer + 404. *Exit: motion system on-budget on a mid-range phone.*
5. **Story & layers** — Home assembly, About/archive, YouTube strip, newsletter, info pages. *Exit: content-complete.*
6. **Hardening & launch** — §10 budgets audited (Lighthouse + real device), copy pass, OG images, DNS repoint, launch checklist. *Exit: live on gotefigure.com.*

Owner-parallel tasks: Fourthwall account + garment picks; .ai hunt (per-SKU blocking — see §5 fallback policy); hand-lettering; poster-shop test print; (Gemini research: POD comparison, relaunch playbook — feeds Fourthwall config and marketing, blocks nothing).

**Hard owner dependencies (status as of 2026-06-11):**
1. ✅ Cloudflare account created. Remaining: one-time `wrangler login` (or API token) for the first deploy + GitHub Actions secrets.
2. ✅ Fourthwall account created. Remaining: storefront token (dashboard → Settings → For Developers → Headless) — needed Phase 3 day 1.
3. ✅ RESOLVED (better than feared): domain was at Network Solutions; transfer to **GoDaddy** initiated 2026-06-11 (5-yr registration paid), completes in ~5–7 days. Registrar = GoDaddy permanently; no Network Solutions steps anywhere. Constraint: nameservers cannot change mid-transfer → the Phase 6 DNS cutover waits for transfer completion (~2026-06-16/18), which fits the timeline. Cutover = set nameservers at GoDaddy to Cloudflare's pair (one-time); thereafter DNS records are managed in the Cloudflare dashboard (required for Workers custom domains on the free tier) while GoDaddy remains the registrar (ownership/renewals).
4. ✅ GitHub: `gh` CLI authenticated as rotemgotlieb-dev; repo + CI secrets managed from the build session.

## 12. Working agreements (token & process protocol)

The owner's Token Optimization Protocol (2026-06-10) is standing law for this repo:

- `CLAUDE.md` ≤150 lines: behavioral directives + facts the model can't infer + **trigger index** pointing to `.claude/rules/*.md` (≤700 tokens each, loaded only when matching work happens). No session-start monolith reads.
- Research & parallel sweeps → background workflows; **builds, fixes, visual fine-tuning → manual** (validated quality lesson, not just cost).
- Terse output, outcome-first; no re-reading unchanged files; tail all command output; element-scoped screenshots ≤5/cycle; haiku for lookup subagents.
- Lessons append ≤10 lines to topical rules files; failures one line to `immune.md` (read at review time only).
- This document is the single source of architectural truth. Sprints cite sections (e.g. "per §7.3") instead of re-deriving decisions. Changes to decisions get recorded here first.

## 13. Open decisions (deliberately deferred, none blocking)

| Decision | Owner | When |
|---|---|---|
| Final apparel fulfillment (Fourthwall POD vs self-ship) — per product | Rotem | Fourthwall setup (Phase 3); architecture indifferent |
| Final SKU list & pricing | Rotem | Phase 3 |
| UI grotesque | ✅ DECIDED Phase 1: Space Grotesk (variable, self-hosted via Fontsource) | done |
| Handwriting display | traced owner lettering (Phase 2/5); NO interim handwriting font — grotesque carries display until then | Phase 2 |
| Newsletter provider | build sprint | Phase 5 |
| Lenis smooth-scroll (desktop polish) | build sprint | Phase 4 — default NO unless it demonstrably helps |
| Cart-island implementation (vanilla TS vs tiny lib) | build sprint | Phase 3 |
| Per-SKU art fallback (mockup render vs defer) for §5 ⚠️ rows | Rotem | Phase 3, at Fourthwall setup |
| OG-image template design | build sprint | Phase 6 |
| Crochet bucket hat SKU | Rotem | whenever |
| Process-moments content (sketch photos available vs skip at launch) | Rotem | Phase 5 |

## 14. Reference library (validated 2026-06)

**The creative brief in one line:** do to your garment art what Build in Amsterdam did to Crazy About Eggs' package illustrations — animate what the brand already owns.

- *Crazy About Eggs* (Awwwards SOTD) — animate existing brand art, 3-color discipline, microcopy as product.
- *Studio Arhoj* — personality via taxonomy/microcopy at zero perf cost. The small-team-feasible gold standard.
- *Online Ceramics* — GIF/loop product cards, lo-fi voice. | *Real Fun Wow* — artist-run, art-backed category cards, voice-driven UX copy.
- *Brain Dead* — systematic naming makes a small catalog a universe; size-select on card.
- *KidSuper World* — dual-track lesson: expressive front, boring commerce behind (theirs is Shopify under WebGL).
- Cautionary: *KOOX / Wildwood Bakery / Anagram Paris* — bespoke award-winners, all dead by 2026: keep the showpiece on swappable boring rails. *Lucas Beaufort's* default Big Cartel — the anti-pattern this whole project exists to avoid.
- Old GoteFigure site (Wayback 2021-12-27): content canon (names, copy, $20–40 price anchors); layout = explicitly not an influence.
