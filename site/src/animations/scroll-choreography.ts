// Lights Up scroll choreography (storefront Direction A): the salon lights come up as you
// scroll. Extends the shipped After Hours look (torch veil + warm glow) but drives the
// dark-to-lit transition by SCROLL instead of the cord. Lenis smooth-scroll shares ONE RAF
// loop with GSAP (2d-scroll gate 1). transform/opacity only. Reduced-motion renders the lit
// end-state statically (no Lenis, no scrub), which is the readable resolved state.
import Lenis from 'lenis';
import { defineModule, gsap, ScrollTrigger } from './core';

defineModule('scroll-choreography', ({ reduced }) => {
  const root = document.querySelector<HTMLElement>('[data-lights-up]');
  if (!root) return; // no-op on every page except the Lights Up storefront

  const veil = root.querySelector<HTMLElement>('[data-veil]');
  const glow = root.querySelector<HTMLElement>('[data-glow]');
  const hero = root.querySelector<HTMLElement>('[data-hero]');

  // Reduced-motion: lights already up (the readable, resolved state), archive gently dimmed.
  // No Lenis, no scrub. Reveals fall to the shared reveals module, which also honors reduced.
  if (reduced) {
    if (veil) veil.style.opacity = '0.06';
    if (glow) glow.style.opacity = '1';
    root.dataset.lit = 'static';
    return;
  }

  // Lenis + GSAP on one shared ticker (never two loops).
  const lenis = new Lenis({ autoRaf: false, duration: 1.05, smoothWheel: true });
  const raf = (time: number) => lenis.raf(time * 1000); // gsap ticker time is seconds
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);
  lenis.on('scroll', ScrollTrigger.update);

  const triggers: ScrollTrigger[] = [];
  const track = (tl: gsap.core.Timeline) => { if (tl.scrollTrigger) triggers.push(tl.scrollTrigger); };

  // Lights up: across the hero, torch veil 1 -> 0 and warm glow 0 -> 1.
  if (hero && veil && glow) {
    const tl = gsap.timeline({
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.4 },
    });
    tl.fromTo(veil, { opacity: 1 }, { opacity: 0, ease: 'none' }, 0)
      .fromTo(glow, { opacity: 0 }, { opacity: 1, ease: 'none' }, 0);
    track(tl);
    root.dataset.lit = 'rising';
  }
  // The archive dims via its own dark panel in CSS (reliable in reduced-motion too), so the
  // veil only handles the lights-up. One expensive scroll motion, no second trigger.

  ScrollTrigger.refresh(); // exactly once, after all triggers are created

  // Teardown: pull our RAF driver, destroy Lenis, kill our triggers (core also kills all STs
  // on before-swap, but we own ours). Keeps motion leak-free across Astro client-side nav.
  return () => {
    gsap.ticker.remove(raf);
    lenis.destroy();
    triggers.forEach((t) => t.kill());
  };
});
