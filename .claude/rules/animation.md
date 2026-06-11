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

## Imported from portfolio project (validated 2026-06, applies here)
7. Easing canon: traversal cubic-bezier(0.77,0,0.175,1); arrival (0.23,1,0.32,1); exits ease-in. Never linear/default.
8. Loops: viewport+tab gate every RAF/loop (IntersectionObserver + visibilitychange); 0%==100% keyframes GEOMETRICALLY identical (seam = geometry, not timing).
9. Coupled motion: ONE driver writes one CSS var; everything derives from it (desync impossible by construction).
10. iOS ≤17.3: never animate SVG r attr — transform:scale instead. Compositor-only always (+filter/clip-path ok).
11. Mobile width: min-width:0 on flex children ≤640px is NOT enough — unbreakable tokens need definite vw max-width caps; on column-stack breakpoints reset flex:1 1 0 children to flex:none;width:100%. Probe content width === viewport at 375 on EVERY page.
12. VERIFY: watch a frame series/video of every loop personally; zero console errors; element-scoped shots.
