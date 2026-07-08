# GoteFigure — HANDOFF / current context (read this first)

_Written 2026-07-02 to bring a fresh agent up to speed. This captures decisions and status that
were previously only in a prior session's memory. For the immutable spec see `System_Architecture.md`;
for working rules see `CLAUDE.md` + `.claude/rules/`; for the plan see `research/MASTER-PLAN.md` and
`docs/superpowers/plans/ROADMAP.md`._

## What GoteFigure is
The art label of **Rotem** — hand-drawn ink art. Launched 2020, vanished, relaunching now ("back
from 2020, five years later"). Every drawing is made by **one human hand** (Rotem) — that human
craft is the soul of the brand. It's an art **store that is also an experience**: wow-factor,
interactive, makes people want to click/explore — and buy. Stack: Astro 6 (`site/`), GSAP,
Fourthwall Storefront API. Node 22. Hosting: **Vercel Hobby while non-commercial** (owner
decision 2026-07-02); at commercialization → Vercel Pro or back to Cloudflare (config retained).

## Current phase (IMPORTANT)
A **full V2 redesign is underway in Claude Design (Fable 5)** — reimagining the whole storefront
from a blank canvas, going all out. It's going well. This repo is where the redesign gets **built
for real** once the look is settled.

**Division of labor (do not violate):**
- **Claude Design (Fable 5)** = the visual/UX design (look, layout, content).
- **Claude Code (this repo)** = the motion/interaction system + the real store build + commerce.
- Motion must be built/verified in **code**, never in Design — Design cannot film/verify motion and
  has repeatedly shipped broken/blind versions. Design mocks motion statically; code makes it real.

## Signature interactions already built + LIVE in code — KEEP + reuse these
- **Ink-fill button** — `site/src/animations/ink-button.ts`. The crown-jewel CTA: fills with wet
  ink on hover, label flips to paper at the waterline, drips run down and auto-weave around real
  elements beneath. Progressive-enhancement (opt-in via `data-ink`). Live on the PDP add-to-cart
  and newsletter. Standalone prototype + Playwright verification harness in `ink-lab/`.
- **Flood-to-navigate** — `site/src/animations/flood-nav.ts` + a persistent overlay in
  `Layout.astro`. Every page nav becomes an ink spill (cover → swap → drain). Fail-safe.
- Both verified: reduced-motion parity, touch, keyboard, nav never breaks.

## Brand model — corrections that MUST hold
- **Cadence is MONTHLY, not daily.** Owner is busy; daily was too much. Kill every "drawn daily" /
  "DAY 1,847" / live-streaming claim. Frame **rarity** (one drop a month, limited, never reprinted,
  vaulted forever) as the selling point — it's honest AND the biggest conversion lever.
- The **artwork** is genuinely human-made (no AI in the art) — keep it honest, nothing over-claimed.
  (The website being designed with AI is fine; the drawings are Rotem's.)
- The **maker is a person** — Rotem should be visible (face/first-person/signature), not just a mascot.

## Products
Apparel (tees, sweats, hats), **posters & prints**, **stickers**, occasional 1-of-1 originals, plus a
**vaulted 2020 archive** (11 pieces — not for sale; brand depth). Price range: cheap sticker →
pricey original. Make the cheap thing an easy yes and the rare thing feel precious.

## Where everything lives (in this repo)
- **The store code:** `site/` — Astro pages in `site/src/pages/`, components in `site/src/components/`,
  animations in `site/src/animations/`, commerce adapter in `site/src/lib/commerce/` (Fourthwall).
- **Motion prototype + verification:** `ink-lab/` (open `ink-fill-button.html` in a browser; verify
  with the `*.py` Playwright scripts via `/usr/local/bin/python3`).
- **Vision / plan / research:** `research/` (start with `MASTER-PLAN.md`, `DESIGN-BRIEF.md`,
  `DESIGN-VISION-PROMPT.md`, `INK-BUTTON-DESIGN-PROMPT.md`; deep competitor/social/AI research in the
  numbered subfolders; brand voice in `research/_scratch/brand-context.md`).
- **Spec & rules:** `System_Architecture.md` (law), `CLAUDE.md` + `.claude/rules/` (animation, assets,
  commerce), `.claude/immune.md` (past failures), `docs/superpowers/plans/ROADMAP.md`.
- **ART:** `for NEW site/` (designs, marketing photos, IG posts), `assets-source/` (logo, wordmark,
  ink signature — source files), `site/public/art/` + `site/src/assets/photos/` (site-ready art),
  `.storefront_research/` (competitor screenshots for reference).

## Art status — MORE IS COMING
The art currently in the repo is the **2020 archive + core marks + some marketing photos**. The owner
has **a lot more artwork to upload** — new monthly drops, posters, stickers, and on-model/lifestyle
product photography. Anywhere a real product/photo is missing, expect a clean labeled placeholder
until the owner drops the real asset in. Do not invent stand-ins for real products.

## Not in this repo (so you won't have it, and don't need to chase it)
- The Claude Design prototype files (`GoteFigure.dc.html`, `Ink-Fill Button.dc.html`) live in the
  Claude Design app — they are the OLD design and are being superseded by the Fable 5 redesign.
- The perfected ink-button + flood motion is here in **code** (above), not in those Design files.

## First moves for a fresh agent
1. Read this file, then `System_Architecture.md`, `CLAUDE.md` + `.claude/rules/`, and
   `research/MASTER-PLAN.md`.
2. `cd site && npm install && npm run dev` to run the store; open a product page and hover the
   ink add-to-cart to see the signature interaction live.
3. Skim `ink-lab/` to understand the motion engine you'll reuse.
4. Then produce an **updated, high-level plan** for the V2 build that keeps the ink-button + flood
   motion, honors the monthly-cadence + rarity model, and is ready to receive the Fable 5 design.
