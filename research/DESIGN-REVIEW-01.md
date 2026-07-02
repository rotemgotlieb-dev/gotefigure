# GoteFigure — Design Build Review 01
*Review of the Claude Design build (GoteFigure.dc.html) + the Design chat's plan + ambitious next-level ideas. 2026-06-13.*
*Source bundle read in full: /tmp/gfdesign/gotefigure/ (README, 624-line HTML, logic, recovered OG assets).*

## Verdict: this is genuinely good — push it, don't restart
The brand world is fully committed and rare: the write-on wordmark intro, Nanum Brush vs Space Mono, the "boil" wobble, paper grain, pen-trail cursor, ink-blot drips + click splat, the Satchel, the placard PDP. The recovered OG 2020 archive is wired in with real metadata. Most AI stores feel generic; this has a point of view. Everything below is about making it **trustworthy, complete, and performant** — not reinventing it.

## On the Design chat's plan — I largely endorse it
It's a sharp, honest review. Agreements + my refinements:

**P0 cart drawer** — In the *current* file the structure actually looks correct: the `<aside>` is a fixed direct child of `<x-dc>` (outside the `z-index:3` wrapper), and `drawerX` binds `0` (open) / `100%` (closed). So it may already be fixed, OR the remaining cause is the classic gotcha: a `transform`/`filter`/`will-change` on an **ancestor** creates a containing block that traps `position:fixed`. Verify the drawer has zero transformed/filtered ancestors. If state flips but it still won't show, it's a re-render/timing issue, not CSS.

**Boil-filter performance — agree hardest, and it's a spec violation.** ~20+ continuously-animated `feTurbulence`/`feDisplacementMap` instances are expensive (NOT compositor-only) — they'll stutter on mid phones, drain battery, and blow the spec's budget (LCP <2s, transform/opacity only). **The fix is already in your real codebase: rough.js.** The production site uses rough.js for exactly this boiling-frame look at a fraction of the cost. So in the real build: replace `feTurbulence` boil → rough.js frames, and reserve any true `feTurbulence` for 1–2 hero elements only. This is the single most important production change.

**Dead nav** (Manifestos/Originals/The daily drawing → home) — agree: build or trim. Don't promise rooms that 404.

**Catalog question — I'll answer the fork for you (it's in the master plan):** GoteFigure is **neither a single drop nor a big grid**. It's a *small curated catalog*: a few evergreen core pieces + the current Era drop + 2–3 shoppable originals + the 11-piece vaulted archive. So: build a real (small) product grid and 2–3 more PDPs, but keep it tight and gallery-like, never a marketplace wall.

**Archive lightbox + lore** — agree, high priority. The 11 OG pieces are your origin myth; each deserves click-to-expand with its 2020 story.

**Originals shoppable / waitlist** — agree. The available original needs a buy path; the SOLD one needs a "notify/waitlist."

**Proof-of-work fake live indicator** — agree, and it matters *most* for this brand. "LIVE INK / DAY 1,847 / STREAMING" reads as deceptive when it's a mock — and the whole brand pitch is honesty ("no AI, one human hand"). Either wire a real clip or label it unmistakably as a teaser. Don't fake the one thing you're selling.

**Hero CTA contrast / mobile / a11y** — agree, minor polish. Test ink-black primary vs amber; pressure-test header wrap + PDP sticky gallery at 375px; add focus states; the reduced-motion handling is already good — keep it.

### My reprioritized order of attack
1. Cart drawer works (verify containing-block) · 2. Decide catalog = small curated (done — see above) · 3. Swap boil → rough.js for perf · 4. Build/trim dead nav · 5. Archive lightbox + lore · 6. Originals buy/waitlist · 7. Real or clearly-teaser proof-of-work · 8. Mobile + a11y pass.

---

## Ambitious ideas — taking it from "beautiful store" to "people screenshot this"
Tiered. Each tied to the brand or the research (not random spectacle).

### Tier 1 — Signature moves (pick 1–2 and go deep; this is where "wow" lives)
1. **The living hero — a rotating wall of drawings.** The hero rotates through a small curated pool of real drawings (swaps per visit/day). *Owner decision 2026-06-13: NO daily-drawing obligation* — the pool is topped up whenever Rotem feels like it, not on a deadline. Keeps the site feeling alive and never-the-same without chaining the artist to a daily draw. Still fuses the art, the brand, and retention — just without the burnout risk.
2. **Scroll is the pen.** Formalize the through-line: every section's frame *draws itself on* (DrawSVG) as it enters, and the ink "re-wets" on scroll-back. You've started this in the hero — make it the spine of the whole page so the entire site reads as one continuous act of drawing.
3. **You can leave ink.** The pen-trail already exists — let visitors leave a real mark on a shared "wall" / ink guestbook that persists. Co-creation is the ultimate parasocial + shareable hook ("I drew on the GoteFigure site"). Moderated, simple canvas.

### Tier 2 — On-brand mechanics (delight + conversion)
4. **The ink dries as it sells.** Render scarcity *as ink*: a live drop's art looks wet/glossy on release and visibly dries/sets as it sells through; sold-out = fully dried, then it cracks into the archive. Turns "SOLD" into an on-brand event, not a stamp. Pairs perfectly with "It's all still wet."
5. **Provenance PDP.** Each piece shows the date of the daily drawing it came from + the clip of it being drawn + the sketchbook page. Buying a shirt = owning a documented artifact. This is the research's "digital bridge" (content → product) made literal, and it's a trust moat against AI/fast-fashion.
6. **Shareable "ink card."** One-tap generate a beautiful share image (piece + placard + "from the GoteFigure archive") sized for IG Stories. Directly serves the #1 2026 algorithm signal (sends-per-reach / shares). Low effort, high leverage.

### Tier 3 — Texture (only after the above)
7. **Generative ink identity.** Each drop gets a unique boil seed so no two frames wobble alike; optionally a subtle per-visitor ink signature. Tasteful generative touch that still feels hand-made.
8. **Opt-in sound.** Faint pen-scratch on the write-on, ink-dip on add-to-cart. Muted by default, respects reduced-motion. Multisensory — but easy to overdo, so opt-in only.

## The production bridge (when this comes back to the real site)
- Prototype tech → real tech: feTurbulence boil → **rough.js** (already in repo); reveal/scroll-draw → **GSAP + ScrollTrigger + DrawSVG**; every effect needs the **init()/destroy() lifecycle** (spec §7.6.6) or it dies on second navigation.
- Keep the spec non-negotiables: transform/opacity, reduced-motion parity everywhere, LCP <2s, JS <150KB Brotli. The prototype's filter-heaviness is the main thing that must change to hit these.
- The recovered assets (`assets-source/`) and this review live in the repo so nothing is lost between Design-chat resets.
