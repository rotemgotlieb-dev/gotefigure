// Lights Up scroll choreography (storefront Direction A): the salon lights come up as you
// scroll. Extends the shipped After Hours look (torch veil + warm glow) but drives the
// dark-to-lit transition by SCROLL instead of the cord. Lenis smooth-scroll shares ONE RAF
// loop with GSAP (2d-scroll gate 1). transform/opacity only. Reduced-motion renders the lit
// end-state statically (no Lenis, no scrub), which is the readable resolved state.
// All branches run through gsap.matchMedia (2d-scroll gate 6): reduced-motion and the
// device tier are LIVE media branches, re-resolved on a mid-session flip, not an init-time
// snapshot. Small or coarse-pointer devices skip the Lenis rig entirely (ScrollTrigger
// reads native scroll directly) so the weakest devices do the least main-thread work.
import Lenis from 'lenis';
import { defineModule, gsap, ScrollTrigger } from './core';

defineModule('scroll-choreography', () => {
  const root = document.querySelector<HTMLElement>('[data-lights-up]');
  if (!root) return; // no-op on every page except the Lights Up storefront

  const veil = root.querySelector<HTMLElement>('[data-veil]');
  const glow = root.querySelector<HTMLElement>('[data-glow]');
  const hero = root.querySelector<HTMLElement>('[data-hero]');

  // The sticky site header eats the top of the snapport: center slides in the VISIBLE
  // area below it, or a tall slide's own heading rests hidden underneath (fresh-hand
  // refute 2026-07-18: the phone archive's kicker was 100 percent hidden at rest).
  // scroll-padding-top gives the CSS-snap tiers the same corrected snapport.
  const headerH = () =>
    document.querySelector<HTMLElement>('.gf-header')?.offsetHeight ?? 0;
  document.documentElement.style.scrollPaddingTop = `${headerH()}px`;

  const mm = gsap.matchMedia();

  // Reduced-motion: lights already up (the readable, resolved state), archive on its own
  // dark panel. No Lenis, no scrub. Reveals fall to the shared reveals module + page CSS.
  mm.add('(prefers-reduced-motion: reduce)', () => {
    if (veil) veil.style.opacity = '0.06';
    if (glow) glow.style.opacity = '1';
    root.dataset.lit = 'static';
    return () => {
      if (veil) veil.style.opacity = '';
      if (glow) glow.style.opacity = '';
    };
  });

  mm.add(
    {
      motionOK: '(prefers-reduced-motion: no-preference)',
      desktop: '(min-width: 720px) and (hover: hover) and (pointer: fine)',
    },
    (ctx) => {
      const { motionOK, desktop } = ctx.conditions as { motionOK: boolean; desktop: boolean };
      if (!motionOK) return; // the reduced branch above owns this state
      root.dataset.tier = desktop ? 'desktop' : 'touch'; // observable tier marker for verification

      // Desktop tier: Lenis + GSAP on one shared ticker (never two loops). Mobile/coarse
      // tier: native scroll drives the same scrub, no smooth-scroll rig at all.
      let lenis: Lenis | undefined;
      let raf: ((time: number) => void) | undefined;
      if (desktop) {
        lenis = new Lenis({ autoRaf: false, duration: 1.05, smoothWheel: true });
        raf = (time: number) => lenis!.raf(time * 1000); // gsap ticker time is seconds
        gsap.ticker.add(raf);
        gsap.ticker.lagSmoothing(0);
        lenis.on('scroll', ScrollTrigger.update);
        // Native CSS snap would fight the animated scroll; the page CSS keys off this
        // attribute to disable it while the rig is live. The assist below owns snapping.
        document.documentElement.setAttribute('data-lu-lenis', '');
      }

      // Snap-to-section-center, ONE assist for both tiers (owner review fix 2).
      // Why not the off-the-shelf paths, each measured and rejected on this page:
      // CSS mandatory trapped a discrete wheel (every notch snapped back to the hero);
      // plain CSS proximity left real flick rests 286 to 359px off-center; lenis/snap
      // proximity at a coverage threshold was a SOFT trap (fresh-hand refute: 14 slow
      // single notches net zero progress in both directions, it also auto-scrolled the
      // page at load, skipped a section on a hard flick, and never saw keyboard scroll).
      // This design: quiet-gated (fires 260ms after the last scroll event, so momentum,
      // Lenis lerp, and keyboard repeats all finish first), direction-aware with a
      // ~100px hysteresis (a lone wheel notch ADVANCES one slide, never pulls back),
      // targets the position the gesture actually reached (no velocity projection, no
      // section skip), never fires without a user scroll (no load motion), eases through
      // the tier's own engine (lenis.scrollTo on desktop, smooth scrollBy on touch), and
      // centers in the visible area below the sticky header.
      const slideSel = () =>
        window.innerWidth < 720
          ? '.lu-hero, .lu-floor .lu-sub, .lu-trust .lu-sub, .lu-archive, .lu-foot'
          : '[data-lu-snap]';
      const visibleCenter = () => (window.innerHeight + headerH()) / 2;
      // Below this height (landscape phones) slides exceed the visible area and ANY
      // snap makes the cut-off content unreachable (re-verify: 4 of 5 landscape units
      // overflowed a 314px budget); short viewports scroll free. Mirrors the page CSS.
      const MIN_VH = 560;
      const SECTIONS = '.lu-hero, .lu-floor, .lu-trust, .lu-archive, .lu-foot';
      const unitList = () =>
        [...root.querySelectorAll<HTMLElement>(slideSel())]
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { el, c: window.scrollY + r.top + r.height / 2 };
          })
          .sort((a, b) => a.c - b.c);
      const nearIdx = (cs: { c: number }[], v: number) =>
        cs.reduce((bi, u, i) => (Math.abs(u.c - v) < Math.abs(cs[bi].c - v) ? i : bi), 0);
      // Target selection is STATELESS except for the previous assist position (pPrev),
      // which supplies the travel direction. An earlier design keyed the advance on the
      // last SETTLED slide; when a notch arrived before the prior ease's settle, the
      // stale state made the assist undo alternate notches (measured: advance, advance,
      // pull-back, advance). Rules, each covering a measured case:
      // - rest within ADVANCE_MIN of the nearest center: ease to it (micro-nudge undo);
      // - rest PAST the nearest center in the travel direction by more than ADVANCE_MIN:
      //   advance to the next center that way (a lone wheel notch = one slide, forward
      //   AND backward);
      // - rest short of the nearest center with travel toward it: ease forward to it
      //   (a flick that died mid-gap is helped onward, never pulled back).
      let pPrev: number | null = null;
      let animTarget: number | null = null;
      const settle = (list: { el: HTMLElement; c: number }[], i: number) => {
        animTarget = null;
        root.dataset.snapped = String(i); // observable marker, both tiers
        // remember the resting SECTION (stable across breakpoints, unlike unit indexes)
        // so a resize or rotation can restore the reading position
        const sec = list[i].el.matches(SECTIONS)
          ? list[i].el
          : list[i].el.closest<HTMLElement>(SECTIONS);
        if (sec) root.dataset.luSection = sec.className.split(' ')[0];
      };
      const assist = () => {
        if (window.innerHeight < MIN_VH) return; // short viewport: free scroll, no snap
        const list = unitList();
        if (!list.length) return;
        const p = window.scrollY + visibleCenter();
        const dir = pPrev === null || Math.abs(p - pPrev) < 4 ? 0 : Math.sign(p - pPrev);
        pPrev = p;
        if (animTarget !== null) {
          if (Math.abs(p - animTarget) <= 8) { settle(list, nearIdx(list, animTarget)); return; }
          animTarget = null; // user interrupted the ease; recompute from where they are
        }
        let ti = nearIdx(list, p);
        const off = p - list[ti].c;
        if (dir !== 0 && Math.sign(off) === dir && Math.abs(off) > Math.max(90, window.innerHeight * 0.1)) {
          const cand = ti + dir;
          if (cand >= 0 && cand < list.length) ti = cand; // deliberate move past a center: advance
        }
        const target = list[ti].c;
        if (Math.abs(p - target) <= 8) { settle(list, ti); return; }
        animTarget = target;
        if (lenis) lenis.scrollTo(target - visibleCenter(), { duration: 0.9 });
        else window.scrollBy({ top: target - p, behavior: 'smooth' });
      };
      // ARMED gate: the assist acts only after real user input. The browser's own
      // pre-paint CSS snap emits scroll events at load; reacting to those made the page
      // ease itself 38px with zero input (re-verify refute). Wheel, touch, key, or
      // pointer arms it; plain scroll events never do.
      let armed = false;
      const arm = () => {
        armed = true;
        // seed the direction baseline at the moment of first input, BEFORE its scroll
        // events land: an unseeded pPrev made the first wheel notch read as directionless
        // and get undone by plain-nearest (measured: rests 38, 38, 938 on a fresh load)
        if (pPrev === null) pPrev = window.scrollY + visibleCenter();
      };
      window.addEventListener('wheel', arm, { passive: true });
      window.addEventListener('touchstart', arm, { passive: true });
      window.addEventListener('keydown', arm);
      window.addEventListener('pointerdown', arm, { passive: true });
      let quiet: ReturnType<typeof setTimeout> | undefined;
      const queue = () => {
        if (!armed) return;
        if (quiet) clearTimeout(quiet);
        quiet = setTimeout(assist, 260);
      };
      window.addEventListener('scroll', queue, { passive: true });
      // Breakpoint crossing loses the reading position (re-verify: a rotation landed the
      // rest on the FOOTER from mid-page): restore the remembered section's first unit,
      // INSTANTLY (a relayout restore, not motion), after a resize settles. Also runs at
      // branch re-init, which is what a 720px crossing triggers on a fine-pointer device.
      const reCenter = () => {
        const sec = root.dataset.luSection;
        if (!sec || window.innerHeight < MIN_VH) return;
        const list = unitList();
        const hit = list.findIndex((u) => u.el.classList.contains(sec) || !!u.el.closest('.' + sec));
        if (hit < 0) return;
        pPrev = null;
        animTarget = null;
        const target = list[hit].c - visibleCenter();
        if (lenis) lenis.scrollTo(target, { immediate: true });
        else window.scrollTo(0, target);
        root.dataset.snapped = String(hit);
      };
      let resizeT: ReturnType<typeof setTimeout> | undefined;
      const onResize = () => { if (resizeT) clearTimeout(resizeT); resizeT = setTimeout(reCenter, 300); };
      window.addEventListener('resize', onResize);
      // Restore across a matchMedia re-init (a 720px crossing tears down and rebuilds this
      // branch). DEFERRED like a resize, never synchronous: at re-init the new layout has
      // not settled and an immediate restore computes stale centers (measured: the kept
      // section rested off-screen). No-op on first load: no section stamped yet.
      if (root.dataset.luSection) { resizeT = setTimeout(reCenter, 300); }
      const assistOff = () => {
        if (quiet) clearTimeout(quiet);
        if (resizeT) clearTimeout(resizeT);
        window.removeEventListener('scroll', queue);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('wheel', arm);
        window.removeEventListener('touchstart', arm);
        window.removeEventListener('keydown', arm);
        window.removeEventListener('pointerdown', arm);
      };

      // Lights up: across the hero, torch veil 1 -> 0 and warm glow 0 -> 1. Scrub-driven,
      // never a timer: progress is owned by the scroll position alone.
      let tl: gsap.core.Timeline | undefined;
      if (hero && veil && glow) {
        tl = gsap.timeline({
          scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.4 },
        });
        tl.fromTo(veil, { opacity: 1 }, { opacity: 0, ease: 'none' }, 0)
          .fromTo(glow, { opacity: 0 }, { opacity: 1, ease: 'none' }, 0);
        root.dataset.lit = 'rising';
      }
      // The archive dims via its own dark panel in CSS (reliable in reduced-motion too), so
      // the veil only handles the lights-up. One expensive scroll motion, no second trigger.

      // Tier teardown (matchMedia re-runs this branch on a media flip): pull our RAF driver,
      // destroy Lenis, restore the ticker's lag-smoothing default we suppressed (a global;
      // it must not outlive this page), kill our trigger.
      return () => {
        assistOff();
        document.documentElement.removeAttribute('data-lu-lenis'); // native CSS snap resumes
        if (raf) gsap.ticker.remove(raf);
        if (lenis) {
          lenis.destroy();
          gsap.ticker.lagSmoothing(500, 33); // the GSAP default
        }
        if (tl) {
          tl.scrollTrigger?.kill();
          tl.kill();
        }
      };
    },
  );

  ScrollTrigger.refresh(); // exactly once, after all triggers are created

  // Module teardown (core runs it on astro:before-swap): revert every media branch and
  // clear the snapport padding we set on <html> (a global; it must not outlive this page).
  return () => {
    mm.revert();
    document.documentElement.style.scrollPaddingTop = '';
  };
});
