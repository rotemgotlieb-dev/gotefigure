// The Sketch (§7.1): the nine-head lineup draws itself across the front door.
// ≤2s, skippable on any input, sessionStorage-gated, never blocks paint (content
// is already painted beneath the overlay). Reduced motion: never shown.
import { gsap, defineModule } from './core';

const KEY = 'gf-intro-seen';

defineModule('intro-sketch', ({ reduced }) => {
  const overlay = document.getElementById('intro-overlay');
  if (!overlay) return; // only the homepage carries it
  if (reduced || sessionStorage.getItem(KEY)) { overlay.remove(); return; }

  sessionStorage.setItem(KEY, '1');
  overlay.hidden = false;

  const heads = overlay.querySelectorAll<SVGPathElement>('svg path');
  const tl = gsap.timeline({ onComplete: dismiss });

  // mask-wipe per head (filled trace, §4.1): clip sweeps upward like quick pen passes
  tl.set(heads, { clipPath: 'inset(0 0 100% 0)' })
    .to(heads, {
      clipPath: 'inset(0 0 0% 0)',
      duration: 0.42,
      ease: 'power2.out',
      stagger: 0.11,
    })
    .to(overlay, { opacity: 0, duration: 0.34, ease: 'power1.in' }, '+=0.25');

  let done = false;
  function dismiss() {
    if (done) return;
    done = true;
    tl.kill();
    overlay!.remove();
    window.removeEventListener('pointerdown', dismiss);
    window.removeEventListener('keydown', dismiss);
    window.removeEventListener('wheel', dismiss);
    window.removeEventListener('touchmove', dismiss);
  }
  window.addEventListener('pointerdown', dismiss, { passive: true });
  window.addEventListener('keydown', dismiss);
  window.addEventListener('wheel', dismiss, { passive: true });
  window.addEventListener('touchmove', dismiss, { passive: true });

  return dismiss;
});
