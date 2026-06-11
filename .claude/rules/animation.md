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
