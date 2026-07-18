#!/usr/bin/env node
// scroll-canary - the standing 2d-scroll seven-gate detector (ux-visuals lane, hardened
// 2026-07-18). Runs at the SOURCE layer against the scroll choreography module + the
// storefront page, wired into build / verify so a regression cannot reach a deploy.
// Each check maps to a numbered gate in ~/.claude/skills/ux-visuals/lanes/2d-scroll.md.
// Planted-defect proven: deleting any one wire below must flip exactly its own gate red
// (drill log in the session wrap). Zero dependencies.
//
// Fails (exit 1) naming the gate on:
//   G1  the shared-RAF wiring missing (autoRaf:false / gsap.ticker.add / lenis.on scroll
//       -> ScrollTrigger.update), or a hand-rolled requestAnimationFrame loop inside the
//       scroll module (a second competing loop)
//   G2  a gsap tween on a layout property (top/left/width/height/margin/padding) in the
//       scroll module - compositor-only is the law
//   G3  no prefers-reduced-motion branch in the module, or none in the storefront page CSS
//   G4  ScrollTrigger.refresh() called != 1 time across src/animations (multiple calls
//       thrash layout; zero means triggers measure before layout settles)
//   G5  teardown wiring missing (lenis.destroy / mm.revert in the module, or the core
//       lifecycle's astro:before-swap listener)
//   G6  no device-tier branch (gsap.matchMedia + a width/pointer heuristic)
//   G7  a shipped storefront raster over the hard ceiling (1.5 MB)

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = dirname(fileURLToPath(import.meta.url)) + '/..'; // site/
const ANIM = join(SITE, 'src/animations');
const MODULE = join(ANIM, 'scroll-choreography.ts');
const CORE = join(ANIM, 'core.ts');
const PAGE = join(SITE, 'src/pages/store-lights-up.astro');
const ART = join(SITE, 'public/art/lights-up');
const HARD_BYTES = 1.5 * 1024 * 1024;
const WARN_BYTES = 400 * 1024;

const failures = [];
const pass = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg) => { failures.push(msg); console.error(`  FAIL  ${msg}`); };
const warn = (msg) => console.warn(`  WARN  ${msg}`);

for (const [p, label] of [[MODULE, 'scroll module'], [CORE, 'animation core'], [PAGE, 'storefront page']]) {
  if (!existsSync(p)) { fail(`[layout] ${label} missing at ${p} - the canary must read real files`); }
}
if (failures.length) { console.error('\nscroll-canary: FAIL'); process.exit(1); }

const mod = readFileSync(MODULE, 'utf8');
const core = readFileSync(CORE, 'utf8');
const page = readFileSync(PAGE, 'utf8');

// G1 - one shared RAF loop
if (!/autoRaf:\s*false/.test(mod)) fail('[G1] Lenis autoRaf:false missing - Lenis would run its own RAF beside gsap.ticker');
else if (!/gsap\.ticker\.add\(/.test(mod)) fail('[G1] gsap.ticker.add(raf) missing - Lenis raf is not driven by the shared ticker');
else if (!/lenis\.on\(\s*['"]scroll['"]\s*,\s*ScrollTrigger\.update\s*\)/.test(mod)) fail("[G1] lenis.on('scroll', ScrollTrigger.update) missing - triggers go stale under smooth scroll");
else if (/requestAnimationFrame\(/.test(mod)) fail('[G1] hand-rolled requestAnimationFrame inside the scroll module - a second competing loop');
else pass('[G1] one shared RAF loop (autoRaf:false + ticker.add + scroll->update, no hand-rolled rAF)');

// G2 - compositor-only tween properties. A bounded window after every tween-call token
// (chained calls included; a trailing-char matcher missed the second call in a chain).
const tweenCalls = [...mod.matchAll(/\.(?:fromTo|to|from|set)\(/g)].map((m) => mod.slice(m.index, m.index + 220));
const layoutProp = /\b(top|left|right|bottom|width|height|margin\w*|padding\w*)\s*:/;
const dirty = tweenCalls.filter((c) => layoutProp.test(c));
if (dirty.length) fail(`[G2] layout property inside a gsap tween (${dirty.length} hit${dirty.length > 1 ? 's' : ''}: ${dirty[0].slice(0, 60).replace(/\s+/g, ' ')}...) - transform/opacity only`);
else pass(`[G2] ${tweenCalls.length} gsap tween call(s), zero layout-property targets`);

// G3 - reduced-motion parity in BOTH layers (JS branch + page CSS)
if (!/prefers-reduced-motion/.test(mod)) fail('[G3] no prefers-reduced-motion branch in the scroll module');
else if (!/prefers-reduced-motion/.test(page)) fail('[G3] no prefers-reduced-motion block in the storefront page CSS');
else pass('[G3] reduced-motion branch present in module AND page CSS');

// G4 - ScrollTrigger.refresh() exactly once across all animation modules
const refreshCount = readdirSync(ANIM)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => (readFileSync(join(ANIM, f), 'utf8').match(/ScrollTrigger\.refresh\(/g) || []).length)
  .reduce((a, b) => a + b, 0);
if (refreshCount !== 1) fail(`[G4] ScrollTrigger.refresh() called ${refreshCount} time(s) across src/animations - must be exactly 1, after all triggers init`);
else pass('[G4] ScrollTrigger.refresh() exactly once across src/animations');

// G5 - teardown wiring (module cleanup + core lifecycle)
if (!/lenis\.destroy\(\)/.test(mod)) fail('[G5] lenis.destroy() missing from teardown - Lenis leaks across client-side nav');
else if (!/mm\.revert\(\)/.test(mod)) fail('[G5] mm.revert() missing - matchMedia branches (triggers included) leak across nav');
else if (!/astro:before-swap/.test(core)) fail('[G5] core lifecycle has no astro:before-swap teardown listener');
else pass('[G5] teardown wired (lenis.destroy + mm.revert + core astro:before-swap)');

// G6 - device-tier branch
if (!/gsap\.matchMedia\(/.test(mod)) fail('[G6] no gsap.matchMedia device/motion branching in the scroll module');
else if (!/(min-width|pointer:\s*fine|hover:\s*hover)/.test(mod)) fail('[G6] gsap.matchMedia present but no width/pointer tier heuristic');
else pass('[G6] device-tier branch (gsap.matchMedia + width/pointer heuristic)');

// G7 - shipped raster ceiling
if (existsSync(ART)) {
  let heavy = 0;
  for (const f of readdirSync(ART)) {
    const st = statSync(join(ART, f));
    if (!st.isFile()) continue;
    if (st.size > HARD_BYTES) { heavy++; fail(`[G7] ${f} is ${(st.size / 1048576).toFixed(2)} MB (> 1.5 MB hard ceiling) - compress before shipping`); }
    else if (st.size > WARN_BYTES) warn(`[G7] ${f} is ${(st.size / 1024).toFixed(0)} KB (> 400 KB) - candidate for compression`);
  }
  if (!heavy) pass('[G7] all lights-up rasters under the 1.5 MB hard ceiling');
} else {
  warn('[G7] public/art/lights-up missing - raster check skipped');
}

if (failures.length) { console.error(`\nscroll-canary: FAIL (${failures.length})`); process.exit(1); }
console.log('\nscroll-canary: PASS');
