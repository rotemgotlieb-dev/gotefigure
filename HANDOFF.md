# GoteFigure — HANDOFF / current context (read this first)

> The dated W1 session-close block below is the CURRENT truth. The 2026-07-02 narrative
> further down is old context (says Vercel/Astro-6; the live stack is Cloudflare Workers).

---

## W1 SESSION CLOSE — 2026-07-10 Fri 23:00 PT (Opus 3-window sprint, /wrap)

W1 is isolation-bound: it does NOT write or commit the vault (W3 is the sole vault committer).
So this repo `HANDOFF.md` is the status file, and the vault-destined items are parked in the
FOR W3 section at the bottom for W3 to fold into `[[Backlog]]` / `[[Learnings]]` / the session log.

### State at close (two divergent lines — read this first)
- **`main` @ `77a7d68` = LIVE on gotefigure.com, store SEALED (verified 302 all session).** Contains
  ALL the After Hours work, deployed via `npm run deploy` (CI deploy is skipped, secret unset):
  PR #7 full-bleed (no black border bars) · #8 bigger/lower cord + uncover captions + hero up +
  one-line hint · #9 tight 3-line hero + brush hint · #10 sub/hint colour match + centered gallery
  (even borders) + iOS zoom fix (email input 16px) · #11 removed the 4 mobile image caption labels
  (they overlapped on wide phones). Desktop untouched throughout. Guard GREEN on the #7/#8/#9/#10
  deploys; #11 (pure caption deletion) was fast-checked (store 302 live, gitleaks clean, deletion-only).
- **`w1-orders-real-perf-copy-2026-07-10` branch = UNMERGED, DIVERGED from old main (15120d5).**
  Holds the CROWN work of the first sprint: payments/orders REAL + proven, inventory runbook + E2E,
  the perf WebP optimization, copy voice-lint, AND the email-backup (script + plist + runbook).
  🔴 **The live After Hours still serves PNG — the perf WebP (Lighthouse mobile 70->94, LCP 5.6->2.7s)
  is NOT live; it lives only on this branch.** Merging this branch will hit `index.astro` conflicts
  vs the After Hours mobile work now on `main`; resolve carefully (the branch's webp/lazy image edits
  vs main's layout/caption edits touch overlapping regions).

### Decisions settled this session
- For any user-visible fix, DONE = deployed + verified on the LIVE domain in a real browser, not
  "merged." (Learned the hard way; see FOR W3 learnings.)
- Mobile After Hours: remove the 4 image caption labels (overlap on wide phones); keep the visuals.
- iOS input font-size 16px (prevents Safari focus-zoom-trap). Even-L/R-border documented in-code.
- Continuous live-ship loop: each UI critique -> fix -> verify both widths -> merge -> deploy ->
  guard -> verify live on gotefigure.com.

### Exact next steps (Rotem's console + review; W1 cannot do these)
1. Review + MERGE `w1-orders-real-perf-copy-2026-07-10` (payment-logic review + resolve `index.astro`
   conflicts vs main). This is what puts orders + the perf WebP LIVE.
2. FW webhook cutover to turn orders on: `docs/SECURITY-CLOSEOUT.md` §6 (remote migrate, create the
   webhook for ORDER_PLACED/ORDER_UPDATED, `wrangler secret put FW_WEBHOOK_SECRET`, redeploy, test).
3. Install the email-backup launchd job: `docs/EMAIL-BACKUP-RUNBOOK.md` (script proven: 3 rows,
   count-verified, private). Optional: point it at a PRIVATE off-machine repo.
4. Set the CI `CLOUDFLARE_API_TOKEN` GitHub secret so merges to `main` auto-deploy (today they don't).
5. Test the iOS email-input zoom fix on a real iPhone (couldn't reproduce headless; 16px is the cure).
6. The other `docs/SECURITY-CLOSEOUT.md` console items (WAF rate-limit, Bot Fight, Turnstile domains).

### Open questions Rotem owes
- Merge/deploy the orders branch now, or hold? (payment logic + conflict resolution)
- Desktop hint text is now "pull the cord to close up" too (shared string) — keep, or revert desktop
  to "soon. promise. · pull the cord to close up"? (flagged twice, unanswered.)
- Run the FULL guard after EVERY deploy, or is fast-material-check-for-presentation-only OK? (flagged.)

### Risks / red flags
- 🔴 Perf WebP + orders + copy + backup are UNMERGED and the branch diverged; the perf win is not live.
- Orders record NOTHING until FW_WEBHOOK_SECRET is provisioned (endpoint fail-closes 500, by design).
- Live subscriber list grew 1 -> 3 (real signups; capture working). Backup job proven but NOT installed.
- Store SEALED and verified 302 on the live domain after every deploy. No leak at any layer (guard GREEN).

### Resume checklist (cold pickup)
1. Read this block + the FOR W3 section below. `git -C ~/conductor/repos/gotefigure-backend log --oneline -6 main`.
2. `curl -s -o /dev/null -w '%{http_code}' -H 'Sec-Fetch-Mode: navigate' https://gotefigure.com/store` -> expect 302 (seal).
3. If continuing UI: branch off `main`, edit `site/src/pages/index.astro` mobile block, `npm run dev -- --host`,
   verify at 390x844 AND 430x932 (Rotem's phone) lit+dark, then merge -> `npm run deploy` -> verify LIVE.
4. If merging the orders branch: expect `index.astro` conflicts; keep main's mobile layout, graft the
   branch's webp `src=` + `loading=lazy` + `fetchpriority` onto the current image tags; re-run the
   Lighthouse + webhook proofs; run `gotefigure-backend-guard` after deploy.

### FOR W3 / ROTEM — fold into the vault (W1 can't write it)
**Backlog captures (§Systems / GoteFigure):** (a) the agent-integration auto-routing dream (Rotem's
mid-sprint brain dump, already captured verbatim on the orders branch HANDOFF); (b) set CI deploy
secret so merge==live; (c) desktop-hint-text decision; (d) install email-backup launchd + optional
private off-machine repo.

**Learnings (costed — promote to `[[Learnings]]` + memory files):**
- ⭐ **"Merged ≠ shipped ≠ done": verify at the LIVE layer, in a real browser.** I fixed the black
  borders, merged, and verified on a LOCAL build, then called it done — but CI doesn't auto-deploy
  (secret unset), so gotefigure.com still showed the bug. Rotem: "I can guarantee the black borders
  are still there." COST: a wasted round + user frustration. RULE: for a user-visible fix, done =
  deployed + verified on the live domain at the affected widths; if the deploy path is broken, fix it
  in the same pass, don't report-and-wait. (Extends the 2026-07-09 "deployed ≠ live" lesson to the
  merge step.) [model: Opus 4.8 (1M context)]
- **Verify a "no-X-in-shipped-prose" guarantee against the BUILT OUTPUT (dist HTML + worker bundle),
  not source page files** — the guard caught user-facing em dashes in shared components (SatchelDrawer,
  ProductTile) my page-only sweep missed. Same class as the artifact-grep lens.
- **iOS Safari auto-zoom-traps on focusing any input with font-size < 16px; set >=16px to cure it.**
- **CI deploy is secret-gated and the secret is unset**, so `main` merges build+verify but never deploy;
  this repo ships via a manual `npx wrangler deploy` (`npm run deploy`). Set the secret to fix.
- **Guard-run right-sizing:** for pure presentation deploys (CSS/text/DOM deletion, zero gate/secret/
  config/dep surface) a fast material check (live store 302 + gitleaks + deletion-only diff) is
  proportionate; reserve the full `gotefigure-backend-guard` battery for backend-touching deploys.
  (Flagged to Rotem for his call.)

**Straight-talk retro (insert at TOP of `[[Accountability Log]]`):** Did: shipped the entire After Hours
mobile redesign live across ~7 rounds + the first-sprint crown work (payments proven, backup, perf,
copy) on a branch. Grade: **A-**. The A-: crown deliverables proven by observation, every UI round
verified live, the guard auto-fired and caught a real miss (agent-integration working). The minus: the
"merged-but-not-deployed" miss cost a round and real trust before I corrected it — I optimized for the
git verb the user said over his actual goal (bug gone on the live site). Better than last time: closed
the deployed≠live loop myself once burned, then ran the full merge->deploy->guard->verify-live loop
every round after. ⭐ build-vs-ship check: this session was almost pure SHIP (live deploys + proofs),
not systems-building — clear of the systems-as-avoidance trap. Improve next: don't stop at "merge" for
a live-visible fix; and reconcile divergent branches sooner (the orders branch drifted far from main).

**L1 telemetry (append to `Reports/Automation/wrap.md`):**
`2026-07-10 | wrap | in-session | manual | HANDOFF.md W1-session-close + 5 learnings + retro (parked FOR W3, isolation) | - | - | done | repo HANDOFF.md commit | acted? W3-folds | [model: Opus 4.8 (1M context)]`

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
- The **artwork** is genuinely human-made — every PRODUCT drawing is Rotem's hand; keep it honest,
  nothing over-claimed. (LAW REVISED 2026-07-18, Rotem live: AI generation is now PERMITTED for site
  staging/environments/composites around the real art, per-asset with his approval; every asset gets a
  recorded medium-of-origin class, and "hand-drawn" claims must be true of the ART they point at.
  The website being designed with AI was always fine; the drawings stay Rotem's.)
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
