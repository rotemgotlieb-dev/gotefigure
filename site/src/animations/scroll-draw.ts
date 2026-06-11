// Scroll-draw line (owner request #2): a hand-drawn ink line draws itself down the
// page margin as you scroll — the page is being penned as you read. Research-validated
// pattern: per-section SVG paths (page-length paths desync), DrawSVG + ScrollTrigger
// scrub, vector-effect non-scaling-stroke. Desktop only; reduced-motion: static full line.
import { gsap, ScrollTrigger, defineModule } from './core';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(DrawSVGPlugin);

defineModule('scroll-draw', ({ reduced }) => {
  const paths = document.querySelectorAll<SVGPathElement>('[data-scroll-draw] path');
  if (!paths.length) return;
  if (window.innerWidth < 900) return; // margin doesn't exist on mobile
  if (reduced) { paths.forEach((p) => gsap.set(p, { drawSVG: '100%' })); return; }

  const tweens: gsap.core.Tween[] = [];
  paths.forEach((path) => {
    gsap.set(path, { drawSVG: '0%' });
    tweens.push(gsap.to(path, {
      drawSVG: '100%',
      ease: 'none',
      scrollTrigger: {
        trigger: path.closest('[data-scroll-draw]'),
        start: 'top 75%',
        end: 'bottom 35%',
        scrub: 0.7,
      },
    }));
  });
  return () => tweens.forEach((t) => t.kill());
});
