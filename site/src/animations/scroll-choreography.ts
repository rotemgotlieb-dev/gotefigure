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
      const settle = (cs: number[], target: number) => {
        animTarget = null;
        root.dataset.snapped = String(cs.indexOf(target)); // observable marker, both tiers
      };
      const assist = () => {
        const cs = centers();
        if (!cs.length) return;
        const p = window.scrollY + visibleCenter();
        const dir = pPrev === null || Math.abs(p - pPrev) < 4 ? 0 : Math.sign(p - pPrev);
        pPrev = p;
        if (animTarget !== null) {
          if (Math.abs(p - animTarget) <= 8) { settle(cs, animTarget); return; }
          animTarget = null; // user interrupted the ease; recompute from where they are
        }
        let ti = nearIdx(cs, p);
        const off = p - cs[ti];
        if (dir !== 0 && Math.sign(off) === dir && Math.abs(off) > Math.max(90, window.innerHeight * 0.1)) {
          const cand = ti + dir;
          if (cand >= 0 && cand < cs.length) ti = cand; // deliberate move past a center: advance
        }
        const target = cs[ti];
        if (Math.abs(p - target) <= 8) { settle(cs, target); return; }
        animTarget = target;
        if (lenis) lenis.scrollTo(target - visibleCenter(), { duration: 0.9 });
        else window.scrollBy({ top: target - p, behavior: 'smooth' });
      };
      let quiet: ReturnType<typeof setTimeout> | undefined;
      const queue = () => { if (quiet) clearTimeout(quiet); quiet = setTimeout(assist, 260); };
      window.addEventListener('scroll', queue, { passive: true });
      const assistOff = () => { if (quiet) clearTimeout(quiet); window.removeEventListener('scroll', queue); };
      // restCenter seeds lazily on the first assist (no init-time rAF: the scroll canary's
      // G1 rightly flags any requestAnimationFrame in this module as a competing-loop tell)

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
