// The Wink (§7.1 V2, owner request 2026-06-11): the pink OG Rabbit loads the store with
// one slow googly wink, then hands the page over. Eye geometry measured from pixels:
// right eye center (450, 945), rim 50×68 in the 800×1600 viewBox. ≤1.8s, skippable,
// sessionStorage-gated, reduced-motion: never shown.
import { gsap, defineModule } from './core';

const KEY = 'gf-intro-seen';

defineModule('the-wink', ({ reduced }) => {
  const overlay = document.getElementById('intro-overlay');
  if (!overlay) return;
  if (reduced || sessionStorage.getItem(KEY)) { overlay.remove(); return; }
  sessionStorage.setItem(KEY, '1');

  const stage = overlay.querySelector<HTMLElement>('.wink-stage')!;
  const lid = overlay.querySelector<SVGEllipseElement>('#wink-lid')!;
  const lash = overlay.querySelector<SVGPathElement>('#wink-lash')!;

  // lid geometry: slides from above the eye (hidden by clip) down over it
  const LID_OPEN = { cy: 875, ry: 4 };     // tucked above the eyeball, inside clip
  const LID_CLOSED = { cy: 947, ry: 66 };  // covers the eyeball

  gsap.set(lid, { attr: LID_OPEN });
  gsap.set(lash, { opacity: 0 });
  gsap.set(stage, { scale: 0.965, opacity: 0, transformOrigin: '50% 80%' });

  const tl = gsap.timeline({ onComplete: dismiss });
  tl.to(stage, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' })
    .to(stage, { rotate: -2.2, duration: 0.16, ease: 'power1.inOut' }, '+=0.22')
    .to(lid, { attr: LID_CLOSED, duration: 0.13, ease: 'power2.in' }, '<')
    .to(lash, { opacity: 1, duration: 0.06 }, '<+=0.09')
    .to(lash, { opacity: 0, duration: 0.08 }, '+=0.17')
    .to(lid, { attr: LID_OPEN, duration: 0.18, ease: 'back.out(1.6)' }, '<')
    .to(stage, { rotate: 0, duration: 0.2, ease: 'power1.inOut' }, '<')
    .to(overlay, { opacity: 0, duration: 0.3, ease: 'power1.in' }, '+=0.18')
    .to(stage, { scale: 0.92, y: -16, duration: 0.3, ease: 'power2.in' }, '<');

  let done = false;
  function dismiss() {
    if (done) return;
    done = true;
    tl.kill();
    overlay!.remove();
    for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchmove'] as const)
      window.removeEventListener(ev, dismiss);
  }
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchmove'] as const)
    window.addEventListener(ev, dismiss, { passive: true });

  return dismiss;
});
