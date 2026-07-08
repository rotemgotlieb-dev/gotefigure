# GoteFigure site — working rules

Art-led storefront. **Spec = System_Architecture.md (law; §-refs below point there). Roadmap = docs/superpowers/plans/ROADMAP.md.**
Stack: Astro 6 (`site/`), GSAP, Fourthwall Storefront API, Vercel hosting (pre-commercial phase, §2). Node 22 (nvm; `.nvmrc` in site/).

## Commands (run in site/)
- dev: `npm run dev` · build: `npm run build` · test: `npm run verify` (build + smoke)
- deploy: Vercel (`npx vercel deploy --prod` or git integration). Cloudflare wrangler config retained for the commercial launch (§2)

## Trigger index — read BEFORE touching the matching area
| Before touching… | Read |
|---|---|
| GSAP / animations / view transitions | .claude/rules/animation.md |
| public/art/ / SVG tracing / image pipeline | .claude/rules/assets.md |
| src/lib/commerce / cart / products overlay | .claude/rules/commerce.md |

## Token economy (standing)
- Thorough reasoning, terse output. No preamble/restatement/closing fluff.
- Don't re-read unchanged files; no open-ended grep/glob; tail all command output.
- Screenshots element-scoped, ≤5 per verify cycle.
- Research → background workflow; builds/fixes → manual. Lookup subagents → haiku.
- Minimal thinking on mechanical tasks. Suggest /clear at task boundaries.
- On compaction: keep file paths, active plan, error trace; drop raw output + dead paths.
- Memory: lessons appended ≤10 lines to the matching rules/ file; failures one line to .claude/immune.md (read at review only).

## Non-negotiables (from spec)
- prefers-reduced-motion parity on every animation (§7.6.2). Animation is garnish, never a gate (§7.6.1).
- transform/opacity only; budgets: LCP <2s mid-tier, JS <150KB Brotli (§10).
- --og-pink is reserved for archive/OG-era contexts (§3.1).
- Hosting: Vercel Hobby is OK only while the site is non-commercial (owner decision 2026-07-02, §2). The day checkout goes live: Vercel Pro or move to Cloudflare — launch-checklist gate. Decisions change in the spec FIRST (§12).
