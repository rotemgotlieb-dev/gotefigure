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
import Snap from 'lenis/snap';
import { defineModule, gsap, ScrollTrigger } from './core';

defineModule('scroll-choreography', () => {
  const root = document.querySelector<HTMLElement>('[data-lights-up]');
  if (!root) return; // no-op on every page except the Lights Up storefront

  const veil = root.querySelector<HTMLElement>('[data-veil]');
  const glow = root.querySelector<HTMLElement>('[data-glow]');
  const hero = root.querySelector<HTMLElement>('[data-hero]');

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
      let snap: Snap | undefined;
      if (desktop) {
        lenis = new Lenis({ autoRaf: false, duration: 1.05, smoothWheel: true });
        raf = (time: number) => lenis!.raf(time * 1000); // gsap ticker time is seconds
        gsap.ticker.add(raf);
        gsap.ticker.lagSmoothing(0);
        lenis.on('scroll', ScrollTrigger.update);

        // Snap-to-section-center (owner review 2026-07-18, fix 2). On this tier the SAME
        // engine that smooths the scroll owns the snap (lenis/snap), so momentum and snap
        // never fight; ScrollTrigger.snap would write scroll positions against the Lenis
        // lerp. Native CSS scroll-snap is disabled while this rig is live (the html
        // data-lu-lenis attribute; the page CSS keys off it) and owns the touch, narrow,
        // and reduced-motion tiers instead. Proximity + threshold + debounce = assist,
        // never trap: free scrolling between slides stays native-feeling.
        document.documentElement.setAttribute('data-lu-lenis', '');
        snap = new Snap(lenis, {
          type: 'proximity',
          duration: 0.9,
          // Slides are 100svh, so the farthest a rest point can sit from the nearest slide
          // center is half a viewport; 52% covers the exact-midpoint dead band a 35%
          // threshold left (measured: a 1280x1000 run settled 440px off-center, un-snapped).
          distanceThreshold: '52%',
          debounce: 400,
          onSnapComplete: (item) => {
            root.dataset.snapped = String(item.index ?? ''); // observable marker for verification
          },
        });
        root
          .querySelectorAll<HTMLElement>('[data-lu-snap]')
          .forEach((el) => snap!.addElement(el, { align: 'center' }));
      }

      // Touch and narrow tier center-assist (owner review fix 2 on the no-rig tier).
      // Native CSS proximity alone leaves real flick rests parked mid-gap (measured via
      // CDP touch gestures: 3 of 5 rests 286 to 359px off-center), so a JS assist eases
      // the rest to a slide center. Two designs measured and REJECTED as traps: CSS
      // mandatory (each discrete wheel notch snapped back to the hero; the page could not
      // be left) and a nearest-center scrollend assist (re-fired between slow wheel
      // notches and eased the user BACKWARD). This design cannot fight the user:
      // direction-aware (past an 18svh hysteresis it advances to the NEXT slide in the
      // travel direction, so a lone wheel notch progresses), quiet-gated (fires only
      // after 220ms of scroll silence, momentum included), defers to CSS proximity inside
      // 24px, and recognizes its own smooth animation so it settles instead of re-firing.
      let assistOff: (() => void) | undefined;
      if (!desktop) {
        const slideSel = () =>
          window.innerWidth < 720
            ? '.lu-hero, .lu-floor .lu-sub, .lu-trust .lu-sub, .lu-archive, .lu-foot'
            : '[data-lu-snap]';
        const centers = () => {
          const cs: number[] = [];
          root.querySelectorAll<HTMLElement>(slideSel()).forEach((el) => {
            const r = el.getBoundingClientRect();
            cs.push(window.scrollY + r.top + r.height / 2);
          });
          return cs.sort((a, b) => a - b);
        };
        const nearIdx = (cs: number[], v: number) =>
          cs.reduce((bi, c, i) => (Math.abs(c - v) < Math.abs(cs[bi] - v) ? i : bi), 0);
        let restCenter: number | null = null;
        let animTarget: number | null = null;
        const assist = () => {
          const cs = centers();
          if (!cs.length) return;
          const p = window.scrollY + window.innerHeight / 2;
          if (animTarget !== null) {
            if (Math.abs(p - animTarget) <= 8) { restCenter = animTarget; animTarget = null; return; }
            animTarget = null; // user interrupted the ease; recompute from where they are
          }
          let ti = nearIdx(cs, p);
          if (restCenter !== null) {
            const ri = nearIdx(cs, restCenter);
            const travel = p - cs[ri];
            if (ti === ri && Math.abs(travel) > window.innerHeight * 0.18) {
              const cand = ri + Math.sign(travel);
              if (cand >= 0 && cand < cs.length) ti = cand; // advance, never pull back
            }
          }
          // first pass (restCenter unseeded): plain nearest, no directional advance; the
          // hysteresis against a just-guessed rest would ease AGAINST the first gesture
          const target = cs[ti];
          if (Math.abs(p - target) <= 24) { restCenter = target; return; } // proximity's zone
          animTarget = target;
          window.scrollBy({ top: target - p, behavior: 'smooth' });
        };
        let quiet: ReturnType<typeof setTimeout> | undefined;
        const queue = () => { if (quiet) clearTimeout(quiet); quiet = setTimeout(assist, 220); };
        window.addEventListener('scroll', queue, { passive: true });
        assistOff = () => { if (quiet) clearTimeout(quiet); window.removeEventListener('scroll', queue); };
        // restCenter seeds lazily on the first assist (no init-time rAF: the scroll canary's
        // G1 rightly flags any requestAnimationFrame in this module as a competing-loop tell)
      }

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
        if (snap) snap.destroy();
        if (assistOff) assistOff();
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

  // Module teardown (core runs it on astro:before-swap): revert every media branch. Keeps
  // motion leak-free across Astro client-side nav.
  return () => mm.revert();
});
