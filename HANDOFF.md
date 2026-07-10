# GoteFigure — HANDOFF / current context (read this first)

> ⚠️ The dated status block directly below is the CURRENT truth. The narrative under
> "GoteFigure — HANDOFF / current context" further down is the older 2026-07-02 context
> (it still says Vercel/Astro-6/V2-redesign; the live stack is Cloudflare Workers). Read
> the status block first.

---

## W1 status — 2026-07-10 (Opus 3-window sprint, GoteFigure backend)

**Branch:** committed on a feature branch; `main` stays at the seal reference `15120d5`.
**Seal:** UNCHANGED. Nothing was deployed this session. The live worker is still the sealed
build; the store gate (signed-cookie + client bounce + `run_worker_first`) is intact
(dist-lint PASS). This work is source-only, ready for Rotem's review/merge/deploy — per the
Safe Backend Doctrine, nothing auto-deploys.

### Shipped this sprint (all verified by observation)
1. **Payments/orders are REAL + proven.** Researched + VERIFIED Fourthwall's webhook contract
   against the live docs (header `X-Fourthwall-Hmac-SHA256`, HMAC-SHA256, base64, over the raw
   body; envelope `{id=EVENT id, type, data=<order>}`, order id = `data.id`, `data.friendlyId`).
   Fixed a real correctness bug in `site/src/lib/orders.ts`: `extractOrder` was keying an order
   on the per-delivery EVENT id when `data.id` was absent, which would break cross-event
   idempotency; now it keys strictly on the order id and rejects keyless events. Locked by a new
   test in `site/tests/orders.test.ts` (RED->GREEN). Applied migration `0003_orders` to a local
   D1 and ran the full webhook battery against the BUILT worker: signed -> 1 D1 row; replay ->
   still 1; ORDER_UPDATED (different event id, same order) -> still 1, shipping pending->shipped;
   unsigned + wrong-secret -> 401 no row; signed-but-keyless -> 400 no row (`event_id_rows=0`).
   Evidence: `docs/evidence/r2-s6-orders/webhook-e2e-proof.md`.
   **Rotem's remaining console steps** (only Rotem can do these): `docs/SECURITY-CLOSEOUT.md` §6,
   now a complete verified 5-step runbook (remote migrate, create the FW webhook subscribing
   ORDER_PLACED/ORDER_UPDATED, `wrangler secret put FW_WEBHOOK_SECRET`, redeploy, send a signed
   test + read the row back). No code change needed at cutover.
2. **Inventory flow verified + made easier.** E2E-proved runbook scenario 3 (price change) behind
   the REAL gate: edited `tee.price` 34->39, built, authenticated via `POST /api/gate`, observed
   `$39` render on `/store` + `/piece/tee` at 1280x800 and 390x844 with zero console errors,
   reverted to 34 and re-observed. Added local-preview-through-the-gate recipes to
   `docs/INVENTORY-RUNBOOK.md` so future catalog edits are easy to verify before deploy.
3. **Performance pass (public After Hours page).** Mobile Lighthouse 70 -> **94**, LCP 5.6s ->
   **2.7s**, page 876 KiB -> **401 KiB**; desktop held 99, LCP 0.9s -> 0.6s. Fixes: PNG->WebP via
   sharp (9 images; `overthinking`+`twins` stay PNG, they were larger as WebP), `fetchpriority=high`
   on the LCP ghost image, `loading=lazy` on the gallery art (safe: the salon starts dark, art is
   torch-revealed). Verified 0 broken images / 0 failed requests at both widths + a screenshot;
   zero visual regression. Evidence: `docs/evidence/perf/after-hours-lighthouse.md`.
4. **Store copy voice-lint.** Removed every user-facing em/en dash (53 fixes across content JSON +
   astro pages), zero banned words, zero AI-voice/brand-truth issues (an adversarial audit workflow
   confirmed the copy already reads in Rotem's voice; the only work was dashes). Remaining dashes
   are code comments / CSS separators / a non-rendered mock annotation.

Full verify green after all changes: build + dist-lint + 60 tests.

**Verification / agent-integration pass (honest tiers):**
- The payments change is verified by OBSERVATION (the strongest tier): RED->GREEN tests plus
  the full webhook battery run against the built worker (see the evidence doc). The perf change
  is verified by 0-broken/0-failed browser checks + a screenshot. Copy by voice-lint + build.
- Security backstop (self-run, standing in for the guard's deterministic battery): no `.dev.vars`
  secret value appears in `dist/client`; no `.env`/`.dev.vars`/secret file is in the change set;
  the local FW/gate secret values appear in NO tracked file (src or docs); the gitleaks pre-commit
  hook is in place; `dist-lint` PASS confirms the gate `run_worker_first` list + ASSETS binding +
  no vault-gallery leak (config-drift + gate-integrity intact). Result: **PASS**.
- `gotefigure-backend-guard` returned **GREEN** (full battery: gitleaks on the commit range + working
  tree clean; no secret values in `dist/client`; the 9 new `.webp` are valid RIFF/WebP art with no
  embedded data class; `dist-lint` 6/6; built-worker no-cookie navigations to /store,/vault,/admin
  all 302, gated og bytes 302 — seal holds; orders change confirmed as idempotency hardening with
  fail-closed intact; npm audit high=0 critical=0). §4 live-domain checks SKIPPED (nothing deployed).
- **The guard earned its keep (agent-integration payoff):** it flagged user-facing em dashes still
  in SHIPPED prose from SHARED COMPONENTS that the first commit's page-only sweep missed
  (`SatchelDrawer` empty-note + proto line, `ProductTile` aria-label — all render via `Layout` on
  about/store/piece/vault/404/info; `CartDrawer`/`ProductCard` are the dormant commerce seam that
  ships at cutover; `Footer` is orphaned). Fixed in the follow-up commit and re-verified at the
  BUILT-OUTPUT layer: dist/client static HTML + the worker bundle now carry zero user-facing em/en
  dashes (old-dash SatchelDrawer strings in the bundle = 0). 60 tests still green.
- BANKED LEARNING (FOR W3 to fold into voice-lint tooling / Learnings): *a "no-X-in-shipped-prose"
  guarantee must be verified against the BUILT OUTPUT (dist HTML + worker bundle), never just source
  page files, because layouts/components inject prose a page-file sweep misses. Scope any copy/voice
  audit to the shipped surface, not a hand-picked page list.* Same class as the doctrine's
  artifact-grep lens; applied this session after the guard caught the gap.
- BRAND-TRUTH FLAG (FOR ROTEM / gotefigure-brand): `Footer.astro:10` reads "drawn every day, really,
  every day" — at odds with the MONTHLY-cadence brand model. Footer is currently orphaned (not
  shipped), so I only removed its em dash; if it is ever wired in, reword the daily claim first.
- Two independent review-agent dispatches (a code-reviewer + a general reviewer) both no-op'd this
  session (0 tool uses; derailed by IDE/MCP context injections at startup). Verification leaned on
  the empirical proofs above + the guard. A fresh reviewer should still give `site/src/lib/orders.ts`
  a second read at merge time.

### FOR W3 / ROTEM — brain-dump handoff (do NOT let this drop; W1 cannot write the vault)
Rotem brain-dumped (2026-07-10, mid-sprint) the KEY to the agent-integration dream, and asked it
be captured durably. It belongs in the vault `[[Backlog]]` §Systems + memory
`[[agent-integration-auto-routing]]` (W3's flagship). W1 is isolation-bound from vault writes, so
it is parked here verbatim for W3/Rotem to fold in:

> On complex freelance projects (esp. TiDB, with more engagements coming), when working across
> several fronts at a high level, use the purpose-built agents/skills for what they're for to reach
> a higher polish + better end result. Candidate agents for a project like the DB one: design-shipper,
> ui-design-master, video-master, sound-engineer (design); brainstorm + straight-talk (planning).
> Constantly develop the workflow where weak points show. Keep track of every scope of work so
> nothing loses context (split into two terminal windows only if needed; prefer one).
> THE DREAM (his words, "probably the key"): take ALL the skills + agents and naturally, organically
> integrate them so that when Rotem asks something, the model recognizes which skills/agents would
> yield a better output and triggers them automatically/unprompted in the workflow. He wants Fable 5
> to build exactly this auto-routing. "This is how I want to integrate the agents... extremely
> important and actionable."

W1 applied the principle in-sprint: invoked the copy-audit workflow, the `gotefigure-backend-guard`
sentinel, and a code-review pass rather than shipping unreviewed (verdicts below).

---


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
