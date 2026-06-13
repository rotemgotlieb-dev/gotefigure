# GoteFigure — Master Plan
*Synthesis of all six Gemini deep-research reports + Report 3 (AI automation), tailored to your situation. 2026-06-13.*
*Source reports live in `01-competitor-stores/gemini-source/` and `02-social-growth/gemini-source/`. This doc is the decision layer on top of them.*

---

## The one-sentence strategy
**Sell the artist and the process, not the shirt** — build parasocial trust through daily ink-drawing video, route it to a site that feels like a gallery (not a store), price like an artisan with original-art anchors, and release in limited thematic "Era" drops so a tiny audience converts hard instead of a large one converting weakly.

All six reports independently converge on this. It is the highest-confidence finding in the whole package.

---

## The 7 load-bearing decisions

### 1. Positioning: premium artisanal, never commodity
- Tees **$32–35** (not $20). Hoodies ~$55–65. The ~$22–25 margin/unit is what makes a micro-audience viable — you cannot win on volume, so win on margin.
- **Price anchoring is mandatory:** list 3–5 *original physical ink drawings* at **$300–500** on the site. Even if they never sell, they reframe a $35 tee as the accessible entry point. This single tactic appears in every store the reports admired (Peter Draws, James Jean, José Roda).
- Product descriptions = **museum placards**, not fabric specs: *"Drawn with a 0.5mm Micron pen and India ink over 14 hours."* The story justifies the price.

### 2. Catalog model: evergreen core + quarterly "Era" drops
- **Evergreen tier** (always available, zero Fourthwall inventory risk): a few classic designs — logo tee, a silhouette piece, the OG-2020 archive pieces. Frictionless buy for anyone who discovers you.
- **Era drops** (every ~3 months): one thematic capsule, limited 72h–1 week window, then **vaulted into a permanent visible "Sold Out" archive**. The graveyard of sold-out work is social proof and FOMO — keep it on the site forever.
- The "Eras" framework (distinct visual theme per quarter, e.g. "Nocturnal Ink Series") is also your anti-fatigue mechanism: it gives the audience a reason to re-engage and prevents the feed from feeling like a merch table.

### 3. The site must *be* art (this is your unfair advantage)
Your headless Astro + Fourthwall Storefront API architecture is exactly what the design report says premium artist sites require — you already have the hard part. Lean into it:
- **Ink micro-animations** on hover (blot expansions, jittery hand-drawn underlines) instead of generic CSS states.
- **Esoteric navigation** instead of Shop/About/Cart — e.g. "The Archive / Ink & Artifacts / Manifestos." (Already partly there with The Wink intro + category wall.)
- **Proof-of-work module**: embed a looping clip of pen-on-paper on the homepage/about. With ~47 subs, *the daily drawing habit is the trust signal* — subscriber count is irrelevant, the visible human hand is everything.
- **Museum-placard PDPs** + a macro shot of the raw ink texture + **granular sizing tables** (exact chest/HPS measurements, not just S/M/L — fit anxiety is the #1 conversion killer).
- **Microcopy as performance art**: empty cart = *"The canvas is blank. The ink has dried."*; purchase = *"The ink is set. The artifact is yours."*

### 4. Platform hierarchy (don't spread thin — you have ≤1hr/day)
- **PRIMARY — YouTube (Shorts + long-form).** Shorts seed ~70% to non-followers = best cold-acquisition engine on the internet. **Target: 500 subscribers** → unlocks the native Fourthwall Merch Shelf under every video. Long-form is evergreen SEO that sells for years.
- **SECONDARY — Instagram.** Use **Trial Reels** to bypass your dormant 2021 audience (do NOT mass-delete old followers — it flags spam). Stories link-sticker works at any follower count → immediate store traffic. 8–12 slide carousels drive saves.
- **TERTIARY — TikTok.** Treat as zero-effort syndication of the same clean export. Strongly consider a **fresh account** to catch the new-account discovery boost; the dead account has no value. Stay on Creator (not Business) account to keep trending audio.
- **THE RETENTION NET — Newsletter, from day one.** Algorithm-proof owned audience. Hook = free hi-res wallpaper of a flagship drawing. Email sparingly (~monthly). This is priority-one capture for your first real followers.

### 5. Content: 85–90% pure value / 10–15% promo
- The hook geometry that the data demands: **finished artwork/garment in the first 1.5 seconds** (not a blank page), then a curiosity-gap line, then rhythmic process with hard cuts every 3–4s. Shorts 30–45s; TikTok 60–180s (needs 70% completion now).
- One batch-film session → 3 short videos + 1 long-form/grid, syndicated all week. (Full 7-day blueprint is in `R2b-platform-playbooks.md`.)
- When you do promote (the 10%), frame it as a milestone, never "buy now": *"The drawing I spent 40 hours on is finally a hoodie."*

### 6. Evolve "Drawing Every Day: Day N" into a countdown
Your current format is good for discipline but fatigues as pure numbering. Make it **teleological**: *"Drawing every day until GoteFigure relaunches."* This converts passive viewers into a countdown audience that peaks exactly at launch day. Then show the **digital bridge** on camera: a daily drawing that gets love → you scan it → it becomes a mockup → it's in the drop. That visible provenance IS the ad.

### 7. Timeline expectation: 12 months to inflection (set this now)
The verified case studies are blunt: daily posting from ~50 followers means months 1–3 are the void, 4–11 the "desert of despair" while a content backlog builds, and the inflection event typically lands around month 12 — often *triggered by* a vulnerability-driven relaunch video. So treat the June relaunch as a **narrative event and a beginning**, not a finish line. The launch validates the brand; the income compounds after.

---

## Sequenced roadmap

**Phase 0 — now → launch (the prototype + relaunch runway)**
1. **Design prototype in Claude Design** (next action — see `DESIGN-BRIEF.md`). Refine the V2 site against the research: placard PDPs, original-art price anchors, sold-out archive, proof-of-work module, esoteric nav, ink micro-animations.
2. Stand up the **newsletter** (stub adapter already exists per the sprint) + wallpaper lead magnet.
3. Reframe daily videos as the **relaunch countdown**; start the finished-product-first hook geometry.
4. Pick the **flagship relaunch drop** (1 hero design + a couple evergreen pieces). Run a "help me decide" poll between two ink variants to pre-validate buyers.

**Phase 1 — launch month**
5. Relaunch as a documented narrative event (the "back from 2020 after 5 years" vulnerability video is your highest-potential single piece of content).
6. Run the structured drop sequence (T-14 inception → T-7 co-creation → T-3 reveal → T-0 → T+3 packing/social proof → T+7 vault). Full timeline in `R1c-social-sales-funnel.md`.

**Phase 2 — months 2–12 (the grind that actually decides it)**
7. Quarterly Era drops. Newsletter monthly. Reply to every comment/DM (high-touch is a small-account superpower).
8. Layer AI automation *now that the habit exists* (Report 3): caption drafting in brand voice, cross-platform reformatting, scheduling via Postiz — keep the drawing and the community replies human.

---

## What I'd push back on / verify before acting
- The reports occasionally describe the site as "built on Fourthwall's animated builder." It isn't — you're headless (custom Astro + Storefront API), which is *better* and matches their own top recommendation. No change needed, just don't get talked into the template path.
- A few cited brands are graded INFERRED or lean on thin sources. The **strategy** above rests only on the claims that recur across multiple reports with solid sourcing — those are safe. Treat individual price points as directional, not gospel; confirm against live Fourthwall base costs when you set real prices.
- "Drawing until relaunch" countdown only works if the relaunch date is real and near. If launch slips, switch the countdown to a different concrete milestone (first drop, 500 subs) rather than letting it become open-ended again.

---
*Next: `DESIGN-BRIEF.md` — the concrete spec to build the Claude Design prototype.*
