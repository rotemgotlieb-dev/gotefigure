# Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A branded-empty GoteFigure site that builds green, passes smoke tests, and deploys to Cloudflare Workers static assets — the skeleton every later phase hangs art and commerce on.

**Architecture:** Astro 6 static site in `site/` inside the existing repo (`/Users/rotemgotlieb/Desktop/GoteFigure_Site_Claude`). Zero framework JS; design tokens from spec §3.1; `Layout.astro` shell with ClientRouter view transitions; four routes; vitest smoke tests over built HTML; wrangler deploy + inert GitHub Actions CI.

**Tech Stack:** Astro 6 (Node 22), vanilla CSS tokens, @fontsource-variable/space-grotesk, vitest, wrangler.

**Spec:** `/Users/rotemgotlieb/Desktop/GoteFigure_Site_Claude/System_Architecture.md` (v1.1). All §-references point there. Working directory for all commands is the repo root unless a step says otherwise.

---

## Chunk 1: Decision record, scaffold, tokens, layout shell

### Task 1: Record the repo-layout and font decisions in the spec

The spec (§12) requires decisions to be recorded there first. Two Phase-1 decisions: site code lives in `site/`; the UI grotesque is **Space Grotesk** (variable, OFL-licensed, self-hosted — characterful but clean, strong numerals for prices).

**Files:**
- Modify: `System_Architecture.md` (§8.5 intro line; §13 font row)

- [ ] **Step 1: Amend §8.5**

In §8.5, directly under the `### 8.5 Repo structure` heading, add this paragraph before the tree:

```markdown
Layout decision (Phase 1): the repo root is this working folder (blueprint + asset sources + docs); the Astro project lives in **`site/`**. The tree below describes `site/`'s internals — except its first three entries (`System_Architecture.md`, `CLAUDE.md`, `.claude/rules/`), which live at the repo root so every sprint loads them regardless of cwd.
```

- [ ] **Step 2: Record the font decision in §13**

Replace the §13 row `| UI grotesque + handwriting fallback faces | build sprint | Phase 1 |` with:

```markdown
| UI grotesque | ✅ DECIDED Phase 1: Space Grotesk (variable, self-hosted via Fontsource) | done |
| Handwriting display | traced owner lettering (Phase 2/5); NO interim handwriting font — grotesque carries display until then | Phase 2 |
```

- [ ] **Step 3: Verify both edits landed**

Run: `grep -c "DECIDED Phase 1" System_Architecture.md && grep -c "Layout decision (Phase 1)" System_Architecture.md`
Expected: `1` and `1`.

- [ ] **Step 4: Commit**

```bash
git add System_Architecture.md
git commit -m "spec: record Phase-1 decisions — site/ layout, Space Grotesk, no interim handwriting face"
```

### Task 2: Scaffold Astro 6 in `site/`

**Files:**
- Create: `site/` (scaffold), `site/.nvmrc`
- Modify: `.gitignore` (root)

- [ ] **Step 1: Verify Node version**

Run: `node --version`
Expected: v22.12+ (Astro 6 requirement, §8.1). If lower: `nvm install 22 && nvm use 22`.

- [ ] **Step 2: Scaffold**

```bash
npm create astro@latest site -- --template minimal --no-git --install --yes
```

Expected: `site/` created with `package.json` (`astro` ^6.x), `src/pages/index.astro`, `astro.config.mjs`. Verify the major version:

Run: `node -e "console.log(require('./site/package.json').dependencies.astro)"`
Expected: a `^6.x` range. If the template pinned something else: `cd site && npm install astro@^6`.

- [ ] **Step 3: Pin Node + ignore artifacts**

```bash
echo "22" > site/.nvmrc
printf '\nsite/node_modules/\nsite/dist/\nsite/.astro/\n' >> .gitignore
```

- [ ] **Step 4: Verify dev server**

Run: `(cd site && timeout 15 npx astro dev) & sleep 8 && curl -s http://localhost:4321 | head -c 200`
Expected: HTML output (any 200 response is a pass). The server self-terminates via `timeout`.

- [ ] **Step 5: Commit**

```bash
git add site .gitignore
git commit -m "feat: scaffold Astro 6 in site/ (minimal template, Node 22 pinned)"
```

### Task 3: Design tokens + base styles

**Files:**
- Create: `site/src/styles/tokens.css` (one responsibility: the §3.1 design vocabulary)
- Create: `site/src/styles/base.css` (one responsibility: reset, typography defaults, focus/a11y)

- [ ] **Step 1: Write `site/src/styles/tokens.css`**

```css
/* Design tokens — §3.1 colors verbatim + Phase-1 type/space/motion vocabulary.
   The ONLY place colors and scale are defined. */
:root {
  /* color */
  --paper: #F2F1EA;
  --ink: #111111;
  --amber: #F0A028;
  --teal: #2AA79B;
  --og-pink: #F27C8D;   /* RESERVED: archive/OG-era only (§3.1 rule) */
  --sunset: #E8836B;
  --paper-dim: #E5E2D8;

  /* type */
  --font-ui: 'Space Grotesk Variable', system-ui, sans-serif;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.25rem;
  --text-xl: clamp(1.5rem, 1.1rem + 2vw, 2.25rem);
  --text-display: clamp(2.25rem, 1.5rem + 4vw, 4.5rem);

  /* space (4px base) */
  --s-1: 0.25rem; --s-2: 0.5rem; --s-3: 0.75rem; --s-4: 1rem;
  --s-6: 1.5rem; --s-8: 2rem; --s-12: 3rem; --s-16: 4rem; --s-24: 6rem;

  /* shape & motion */
  --oval: 50% / 42%;           /* cameo mask ratio (§3.3) */
  --ease-ink: cubic-bezier(0.33, 1, 0.68, 1);
  --dur-quick: 180ms;
  --dur-moment: 420ms;
}
```

- [ ] **Step 2: Write `site/src/styles/base.css`**

```css
/* Base — reset, defaults, a11y. No component styles here. */
*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; }

html { color-scheme: light; }
body {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-ui);
  font-size: var(--text-base);
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  min-height: 100svh;
}

img, picture, svg, video { display: block; max-width: 100%; }
button { font: inherit; cursor: pointer; }
a { color: inherit; }

h1, h2, h3 { line-height: 1.15; text-wrap: balance; }
h1 { font-size: var(--text-display); font-weight: 700; }
h2 { font-size: var(--text-xl); }

:focus-visible {
  outline: 3px solid var(--amber);
  outline-offset: 3px;
  border-radius: 2px;
}

.skip-link {
  position: absolute; left: var(--s-4); top: var(--s-4);
  background: var(--ink); color: var(--paper);
  padding: var(--s-2) var(--s-4);
  transform: translateY(-200%);
}
.skip-link:focus { transform: none; z-index: 100; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Install the font**

```bash
cd site && npm install @fontsource-variable/space-grotesk && cd ..
```

Expected: dependency added without errors.

- [ ] **Step 4: Commit**

```bash
git add site/src/styles site/package.json site/package-lock.json
git commit -m "feat: design tokens (§3.1), base styles, Space Grotesk"
```

### Task 4: Layout shell — Header, Footer, Layout

**Files:**
- Create: `site/src/components/Header.astro` (nav only)
- Create: `site/src/components/Footer.astro` (socials/legal only)
- Create: `site/src/layouts/Layout.astro` (HTML shell, head, ClientRouter)

- [ ] **Step 1: Write `site/src/components/Header.astro`**

```astro
---
// Site nav (§6): logo → home, Shop, About, cart placeholder (functional in Phase 3).
const { pathname } = Astro.url;
const isActive = (p: string) => pathname === p || pathname.startsWith(p + '/');
---
<header class="site-header">
  <nav aria-label="Main">
    <a href="/" class="logo" aria-label="GoteFigure home">GoteFigure</a>
    <div class="links">
      <a href="/shop" aria-current={isActive('/shop') ? 'page' : undefined}>Shop</a>
      <a href="/about" aria-current={isActive('/about') ? 'page' : undefined}>About</a>
      <button type="button" class="cart-btn" aria-label="Cart, 0 items" disabled>
        Cart <span class="cart-count" aria-hidden="true">0</span>
      </button>
    </div>
  </nav>
</header>

<style>
  .site-header { padding: var(--s-4) var(--s-6); border-bottom: 2px solid var(--ink); }
  nav { display: flex; align-items: center; justify-content: space-between; gap: var(--s-4); }
  .logo { font-weight: 700; font-size: var(--text-lg); text-decoration: none; }
  .links { display: flex; align-items: center; gap: var(--s-6); }
  .links a { text-decoration: none; }
  .links a[aria-current='page'] { text-decoration: underline 2px var(--amber); text-underline-offset: 6px; }
  .cart-btn { background: none; border: 2px solid var(--ink); padding: var(--s-1) var(--s-3); border-radius: 999px; }
  .cart-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .cart-count { font-variant-numeric: tabular-nums; }
</style>
```

- [ ] **Step 2: Write `site/src/components/Footer.astro`**

```astro
---
// Footer (§6 Home): socials + minimum legal. X link added when handle confirmed (§10).
const year = new Date().getFullYear();
---
<footer class="site-footer">
  <ul class="socials">
    <li><a href="https://www.youtube.com/@gotefigure" rel="me noopener" target="_blank">YouTube</a></li>
    <li><a href="https://www.instagram.com/gotefigure/" rel="me noopener" target="_blank">Instagram</a></li>
  </ul>
  <p class="legal">© {year} GoteFigure · unique wearable art, California</p>
</footer>

<style>
  .site-footer {
    margin-top: var(--s-24);
    padding: var(--s-8) var(--s-6);
    border-top: 2px solid var(--ink);
    display: flex; flex-wrap: wrap; gap: var(--s-4);
    align-items: center; justify-content: space-between;
  }
  .socials { display: flex; gap: var(--s-6); list-style: none; padding: 0; }
  .legal { font-size: var(--text-sm); color: color-mix(in srgb, var(--ink) 70%, var(--paper)); }
</style>
```

- [ ] **Step 3: Write `site/src/layouts/Layout.astro`**

```astro
---
// HTML shell for every page. Head/meta, ClientRouter (view transitions, §7.3), header/footer.
import { ClientRouter } from 'astro:transitions';
import '@fontsource-variable/space-grotesk';
import '../styles/tokens.css';
import '../styles/base.css';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';

interface Props { title: string; description: string; }
const { title, description } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <meta name="theme-color" content="#F2F1EA" />
    <ClientRouter />
  </head>
  <body>
    <a href="#main" class="skip-link">Skip to content</a>
    <Header />
    <main id="main">
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 4: Point the scaffold index at the layout (temporary content)**

Replace `site/src/pages/index.astro` entirely with:

```astro
---
import Layout from '../layouts/Layout.astro';
---
<Layout
  title="GoteFigure — unique wearable art"
  description="Hand-drawn art on tees, hoodies, posters and stickers. An art-based clothing brand from California, founded 2020, reborn 2026."
>
  <section class="hero">
    <h1>GoteFigure</h1>
    <p>Unique wearable art. Hand-drawn in California.</p>
  </section>
</Layout>

<style>
  .hero { padding: var(--s-24) var(--s-6); max-width: 60ch; }
  .hero p { font-size: var(--text-lg); margin-top: var(--s-4); }
</style>
```

- [ ] **Step 5: Verify build**

Run: `cd site && npx astro build && cd ..`
Expected: build completes, `site/dist/index.html` exists, no errors.

- [ ] **Step 6: Commit**

```bash
git add site/src
git commit -m "feat: Layout shell — Header/Footer/Layout with ClientRouter, branded index"
```

## Chunk 2: Routes with smoke tests, deploy pipeline, CLAUDE.md

### Task 5: Smoke tests first, then the remaining routes

TDD at the page level: the tests describe all four routes; they fail until the routes exist.

**Files:**
- Create: `site/tests/smoke.test.ts`, `site/vitest.config.ts`
- Create: `site/src/pages/shop/index.astro`, `site/src/pages/about.astro`, `site/src/pages/404.astro`
- Modify: `site/package.json` (scripts)

- [ ] **Step 1: Add scripts**

```bash
cd site && npm install -D vitest && \
npm pkg set scripts.build="astro build" scripts.test="vitest run" scripts.verify="astro build && vitest run" && cd ..
```

- [ ] **Step 2: Write `site/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
```

- [ ] **Step 3: Write the failing smoke tests — `site/tests/smoke.test.ts`**

```ts
// Smoke tests over BUILT html (run `npm run verify`). Guards: routes exist,
// landmarks present, nav wired, tokens loaded. Not a substitute for browser testing.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(__dirname, '..', 'dist');
const page = (p: string) => readFileSync(join(dist, p), 'utf8');

describe('built routes', () => {
  it.each(['index.html', 'shop/index.html', 'about/index.html', '404.html'])(
    '%s exists', (p) => expect(existsSync(join(dist, p))).toBe(true),
  );
});

describe('page contract', () => {
  it.each([
    ['index.html', 'GoteFigure'],
    ['shop/index.html', 'Shop'],
    ['about/index.html', 'About'],
    ['404.html', 'Nothing here'],
  ])('%s has <main> and its h1', (p, h1) => {
    const html = page(p);
    expect(html).toContain('<main id="main"');
    expect(html).toMatch(new RegExp(`<h1[^>]*>[^<]*${h1}`));
  });

  it('nav links to shop and about on every page', () => {
    for (const p of ['index.html', 'shop/index.html', 'about/index.html']) {
      const html = page(p);
      expect(html).toContain('href="/shop"');
      expect(html).toContain('href="/about"');
    }
  });

  it('skip link and lang attribute present (a11y baseline)', () => {
    const html = page('index.html');
    expect(html).toContain('class="skip-link"');
    expect(html).toContain('<html lang="en"');
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd site && npm run verify; cd ..`
Expected: FAIL — `shop/index.html`, `about/index.html`, `404.html` do not exist yet.

- [ ] **Step 5: Write `site/src/pages/shop/index.astro`**

```astro
---
import Layout from '../../layouts/Layout.astro';
---
<Layout title="Shop — GoteFigure" description="Tees, hoodies, posters and stickers — hand-drawn GoteFigure art.">
  <section class="placeholder">
    <h1>Shop</h1>
    <p>The grid lands in Phase 3 — apparel, posters, stickers.</p>
  </section>
</Layout>

<style>
  .placeholder { padding: var(--s-16) var(--s-6); max-width: 60ch; }
  .placeholder p { margin-top: var(--s-4); }
</style>
```

- [ ] **Step 6: Write `site/src/pages/about.astro`**

```astro
---
import Layout from '../layouts/Layout.astro';
---
<Layout title="About — GoteFigure" description="An art-based clothing brand from California. Founded in 2020, reborn in 2026.">
  <section class="placeholder">
    <h1>About</h1>
    <p>Founded 2020. Dormant for a while. Back — the story arrives in Phase 5.</p>
  </section>
</Layout>

<style>
  .placeholder { padding: var(--s-16) var(--s-6); max-width: 60ch; }
  .placeholder p { margin-top: var(--s-4); }
</style>
```

- [ ] **Step 7: Write `site/src/pages/404.astro`**

```astro
---
// Placeholder until Phase 4 brings the full googly-eyed OG Rabbit (§6.6).
import Layout from '../layouts/Layout.astro';
---
<Layout title="404 — GoteFigure" description="Nothing here, man.">
  <section class="placeholder">
    <h1>Nothing here, man</h1>
    <p><a href="/">Back to the art →</a></p>
  </section>
</Layout>

<style>
  .placeholder { padding: var(--s-16) var(--s-6); max-width: 60ch; }
  .placeholder p { margin-top: var(--s-4); }
</style>
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd site && npm run verify; cd ..`
Expected: PASS — all smoke tests green.

- [ ] **Step 9: Commit**

```bash
git add site/tests site/vitest.config.ts site/src/pages site/package.json site/package-lock.json
git commit -m "feat: shop/about/404 routes with smoke tests (TDD at page level)"
```

### Task 6: Wrangler deploy (Workers static assets)

**Files:**
- Create: `site/wrangler.jsonc`
- Modify: `site/package.json` (deploy script)

- [ ] **Step 1: Write `site/wrangler.jsonc`**

```jsonc
// Cloudflare Workers static assets (§8.1 — Pages is maintenance-mode; Workers is the chosen rail).
{
  "name": "gotefigure",
  "compatibility_date": "2026-06-01",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "404-page"
  }
}
```

- [ ] **Step 2: Add deploy script + dev dependency**

```bash
cd site && npm install -D wrangler && npm pkg set scripts.deploy="astro build && wrangler deploy" && cd ..
```

- [ ] **Step 3: Validate config without deploying**

Run: `cd site && npx astro build && npx wrangler deploy --dry-run; cd ..`
Expected: ends with `--dry-run: exiting now` (no upload performed; no credentials needed). The build step makes this self-sufficient from a clean checkout — wrangler errors if `dist/` is missing.

- [ ] **Step 4 (BLOCKED-ON-OWNER — Cloudflare account):** first real deploy

When Rotem supplies Cloudflare access: `cd site && npx wrangler login && npm run deploy`
Expected: a live `https://gotefigure.<subdomain>.workers.dev` preview URL — the Phase 1 exit artifact. If credentials are not yet available, leave this step unchecked and proceed; everything else in Phase 1 is independent.

- [ ] **Step 5: Commit**

```bash
git add site/wrangler.jsonc site/package.json site/package-lock.json
git commit -m "feat: wrangler config for Workers static assets, deploy script"
```

### Task 7: CI workflow (inert until GitHub remote + secrets exist)

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
# Deploys on push + weekly rebuild (§8.2: keeps Fourthwall stock + YouTube strip fresh).
# Until secrets CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID are set, the deploy step
# SKIPS (secrets-gated below) — build+tests still run green, no red runs, no failure emails.
name: deploy
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1' # Mondays 06:00 UTC — the §8.2 weekly rebuild
  workflow_dispatch: {}  # the owner's "rebuild now" button (GitHub UI → Actions → deploy → Run)

jobs:
  deploy:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: site } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: site/package-lock.json }
      - run: npm ci
      - run: npm run verify   # build + smoke tests; a failed product fetch fails loudly here (§8.2)
      - run: npx wrangler deploy
        if: ${{ secrets.CLOUDFLARE_API_TOKEN != '' }}  # secrets context is valid in step-level if
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 2: Record the rebuild-mechanism refinement in the spec (§12: spec changes first)**

§8.2 names "a Cloudflare deploy hook" + bookmarkable URL; with Workers static assets the concrete mechanism is GitHub Actions. In §8.2, replace the sentence beginning `Rebuild mechanics:` up to `(optionally wired to Fourthwall` with:

```markdown
Rebuild mechanics: CI builds on git push; a **GitHub Actions weekly cron** runs build+deploy; the owner's "rebuild now" control is the same workflow's **manual Run button** (GitHub → Actions → deploy) after Fourthwall dashboard edits (optionally wired to Fourthwall
```

Also append one sentence to §11 Phase 1's exit line: ` (the preview-URL deploy may trail the rest of Phase 1 if Cloudflare credentials arrive late — it must exist before Phase 2 ends).`

- [ ] **Step 3: Commit**

```bash
git add .github System_Architecture.md
git commit -m "ci: secrets-gated build+deploy, weekly cron, rebuild-now dispatch; spec: record mechanism"
```

### Task 8: CLAUDE.md + rules files (the §12 token protocol, made real)

**Files:**
- Create: `CLAUDE.md` (repo root)
- Create: `.claude/rules/animation.md`, `.claude/rules/assets.md`, `.claude/rules/commerce.md`

- [ ] **Step 1: Write `CLAUDE.md`**

```markdown
# GoteFigure site — working rules

Art-led storefront. **Spec = System_Architecture.md (law; §-refs below point there). Roadmap = docs/superpowers/plans/ROADMAP.md.**
Stack: Astro 6 (`site/`), GSAP, Fourthwall Storefront API, Cloudflare Workers static assets. Node 22.

## Commands (run in site/)
- dev: `npm run dev` · build: `npm run build` · test: `npm run verify` (build + smoke)
- deploy: `npm run deploy` (wrangler; needs Cloudflare login)

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
- Never deploy to Vercel (ToS, §2). Decisions change in the spec FIRST (§12).
```

- [ ] **Step 2: Write `.claude/rules/animation.md`**

```markdown
# Animation rules (load-bearing — spec §7)

1. ClientRouter runs module scripts ONCE per session. Every module in src/animations/
   exports init()/destroy(). Bind init on `astro:page-load`. Kill ALL ScrollTriggers,
   listeners, and gsap.matchMedia contexts on `astro:before-swap`. Violations work on
   first load and silently die/duplicate on second navigation (§7.6.6).
2. Reduced motion: wrap every effect in gsap.matchMedia('(prefers-reduced-motion: no-preference)');
   provide the static equivalent, not nothing (§7.6.2).
3. transform/opacity only. No layout-thrashing properties in loops (§7.6.3).
4. CSS scroll-driven animations: progressive enhancement behind @supports only — Firefox
   still flag-gated 2026-06 (§7.6.4).
5. Intro (§7.1): ≤2s, skippable on any input, sessionStorage key `gf-intro-seen`, never
   blocks paint. Loaders = waiting rabbit (§7.4); loading ≠ failure UI (§8.2).
6. Stroke-draw needs STROKED paths; auto-traced fills need mask-wipe instead (§4.1).
```

- [ ] **Step 3: Write `.claude/rules/assets.md`**

```markdown
# Asset pipeline rules (spec §4)

- Source art lives in `for NEW site/` + root files; NEVER lift art from IG screenshots (§4.3).
- Techniques (§4.1): line art (nine-head lineup, stipple-rabbit contour) → centerline/stroke
  trace → true DrawSVG. Filled art (silhouette, alien, doodle-camo, mandala) → vtracer/potrace
  filled trace → mask-wipe fake-draw. SVGO every production SVG.
- Known cleanups: OG Rabbit 02 = stray gold scribble top-left + black bar bottom; Web Hero 3 =
  EXIF rotation; alien logo = baked shadow (light bg only); booty.png = skip (redundant twin).
- Photos: AVIF/WebP responsive via Astro assets. Hero candidates: profile pic.jpg, Web Hero 3 (fixed).
- Phase 2 exit = each asset ANIMATES as §7 specifies, not merely "SVG exists".
- Handoff formats from owner: SVG > PNG/JPG ~1500–2000px > PDF (§4.4).
```

- [ ] **Step 4: Write `.claude/rules/commerce.md`**

```markdown
# Commerce rules (spec §8.3, §8.2, §5)

- ALL commerce via src/lib/commerce/ adapter: getProducts(), getProduct(handle), createCart(),
  getCart(token), addToCart(token, variantId, qty), updateItem(token, lineId, qty) [qty 0 = remove],
  getCheckoutUrl(token). Neutral types Product/Variant/Cart/LineItem. No Fourthwall types
  escape the directory.
- Fourthwall reality: NO list-all-products endpoint — getProducts = List Collections →
  Get Collection Products; PDP = Get Product by Slug; auth = storefront_token query param.
- Cart token: localStorage; validate via getCart() on island init; discard on 4xx; clear when
  checkout CTA fires. API failures → honest inline retry, not the loading rabbit (§8.2).
- Overlay (src/content/overlay/products.json): keyed by Fourthwall slug; required type
  (apparel|poster|sticker) + era (og|new); build FAILS LOUDLY on unmatched key (§5).
- Checkout is Fourthwall-hosted. Card data never touches our code (§9).
```

- [ ] **Step 5: Create the (initially empty) immune file and commit**

```bash
touch .claude/immune.md
git add CLAUDE.md .claude/rules .claude/immune.md
git commit -m "docs: CLAUDE.md (token protocol + trigger index) and load-bearing rules files"
```

### Task 9: Phase exit verification

- [ ] **Step 1: Full verify from clean state**

Run: `cd site && rm -rf dist && npm run verify; cd ..`
Expected: build green, all smoke tests PASS.

- [ ] **Step 2: Manual browser check (webapp-testing skill)**

Start `npm run dev`; verify on a 375px-wide viewport and desktop: nav readable and thumb-reachable, focus ring visible when tabbing, skip-link appears on first Tab, /shop and /about navigate (view transitions active), unknown URL shows the 404 page. Element-scoped screenshots only, ≤5.

- [ ] **Step 3: Check off the completed Phase-1 boxes in ROADMAP.md, commit**

Check every Phase-1 checkbox that is actually done; leave the deploy box unchecked if Task 6 Step 4 is still owner-blocked (the roadmap already words it as credential-dependent).

```bash
git add docs/superpowers/plans/ROADMAP.md
git commit -m "chore: Phase 1 foundation complete"
```

**Phase 1 exit criteria (§11):** branded-empty site builds green; smoke tests pass; deployable via `npm run deploy` the moment Cloudflare credentials exist (Task 6 Step 4 may trail without blocking Phase 2).
