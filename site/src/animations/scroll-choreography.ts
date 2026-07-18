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
