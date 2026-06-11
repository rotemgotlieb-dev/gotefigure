// Scroll life (§7.2): glyph dust parallax, draw-on-enter wipes, velocity-reactive marquee.
// Native scroll only — everything reacts, nothing hijacks.
import { gsap, ScrollTrigger, defineModule, gateLoop } from './core';

defineModule('dust-parallax', ({ reduced }) => {
  if (reduced) return;
  const glyphs = document.querySelectorAll<HTMLElement>('[data-dust] .glyph');
  if (!glyphs.length) return;
  const tweens: gsap.core.Tween[] = [];
  glyphs.forEach((g) => {
    const speed = Number(g.dataset.speed ?? 0.25);
    tweens.push(gsap.to(g, {
      yPercent: -120 * speed * 4,
      ease: 'none',
      scrollTrigger: { trigger: g.closest('section, article') ?? g, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
    }));
  });
  return () => tweens.forEach((t) => t.kill());
});

defineModule('draw-on-enter', ({ reduced }) => {
  const els = document.querySelectorAll<HTMLElement>('[data-draw]');
  if (!els.length) return;
  if (reduced) { els.forEach((el) => el.classList.add('drawn')); return; }
  const triggers: ScrollTrigger[] = [];
  els.forEach((el) => {
    triggers.push(ScrollTrigger.create({
      trigger: el,
      start: 'top 82%',
      once: true,
      onEnter: () => el.classList.add('drawn'),
    }));
  });
  return () => triggers.forEach((t) => t.kill());
});

defineModule('marquee-velocity', ({ reduced }) => {
  if (reduced) return;
  const marquees = document.querySelectorAll<HTMLElement>('[data-marquee]');
  if (!marquees.length) return;
  const cleanups: (() => void)[] = [];
  marquees.forEach((m) => {
    const track = m.querySelector<HTMLElement>('.track');
    if (!track) return;
    track.style.animation = 'none'; // JS takes over from the CSS fallback
    const tween = gsap.to(track, { xPercent: -50, ease: 'none', duration: 36, repeat: -1, paused: true });
    const gate = gateLoop(m, () => tween.play(), () => tween.pause());
    const st = ScrollTrigger.create({
      onUpdate: (self) => {
        const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 900, 3.2);
        gsap.to(tween, { timeScale: boost, duration: 0.18, overwrite: true });
        gsap.to(tween, { timeScale: 1, duration: 1.1, delay: 0.2, overwrite: false });
      },
    });
    cleanups.push(() => { gate(); st.kill(); tween.kill(); track.style.animation = ''; });
  });
  return () => cleanups.forEach((c) => c());
});
