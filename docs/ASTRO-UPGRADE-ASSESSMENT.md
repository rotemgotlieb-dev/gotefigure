# Astro semver-major security upgrade: assessment (REPORT-ONLY, no code changed)

Written 2026-07-29 (W2 lane). Re-derived tonight from a fresh `npm ci` + `npm audit` on
`origin/main` (16ee26a), not quoted from the 7/23 guard report.

## The numbers, observed 2026-07-29

- `npm audit`: **10 vulnerabilities (8 high, 1 moderate, 1 low)**; prod-only
  (`--omit=dev`): 6 (5 high, 1 low).
- Installed today: astro **6.4.6**, @astrojs/cloudflare **13.7.0**, wrangler 4.110.0,
  sharp 0.34.5, js-yaml 4.2.0, svgo 4.0.1.

## What is actually exposed

The three Astro high advisories are XSS sinks (unescaped view-transition animation props,
spread attribute names, `transition:*` directive values on hydrated islands). They fire when
ATTACKER-CONTROLLED VALUES reach those sinks. On this site every page is owner-authored,
dynamic routes are gated, and no user-generated content flows into templates, so the 7/23
guard's AMBER-not-RED read still holds. The exposure grows the day any user-supplied string
renders (reviews, notes, order-status pages fed by webhook data). Treat the upgrade as owed,
not urgent.

## The two-tier fix

**Tier 1, cheap and non-breaking (can ride any normal PR):**
```
npm audit fix          # js-yaml, svgo, postcss ranges; no semver-major
npm run verify         # 94/94 + lints must stay green
```
Also worth bumping in the same window: wrangler to the latest 4.x (the 4.16-4.113 range is
flagged only through its bundled miniflare/sharp; current 4.110.0).

**Tier 2, the semver-major window (its own branch + its own verify + browser pass):**
- astro 6.4.6 -> 7.x (audit suggests 7.1.6) AND @astrojs/cloudflare 13.7.0 -> 14.x in the
  SAME commit: 14.x peers Astro ^7 (the banked 2026-07-09 lesson pinned 13.7.0 exactly
  because this repo was on Astro 6; check the adapter's peer range against the INSTALLED
  package before pinning, never a web summary).
- Known seams to re-verify from the installed dist, not memory: the `cloudflare:workers`
  env import pattern (Astro 6 already removed `locals.runtime.env`; confirm v7 keeps the
  same shape), `assets.run_worker_first` emission in the built wrangler.json (dist-lint
  pins it), prerender behavior of the gated pages, and the Vite env file precedence that
  catalog-lint mirrors.
- Acceptance: `npm run verify` green; dist-lint gated-route pins green; the S6/S4 walk-around
  probes on the BUILT worker (no-cookie 302s, gated assets 302, /_image worker-first);
  a real-browser pass on / and /store at both widths.
- Sizing: half-day to a day including the browser pass. Not tonight's scope; drop-1 work
  outranks it while the store is sealed and no untrusted content renders.

## Recommendation

Do Tier 1 opportunistically this week. Schedule Tier 2 as its own window BEFORE the store
unseals to the public (the XSS class matters more once strangers browse gated-turned-public
pages), and definitely before any feature renders user-supplied strings.
