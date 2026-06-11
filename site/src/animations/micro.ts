// Micro-layer (§7.5): cursor-tracked pupils (one eye lags — the deranged charm),
// magnetic CTA, beam-up on add-to-cart, logo-click easter egg.
import { gsap, defineModule } from './core';

defineModule('pupils', ({ reduced }) => {
  if (reduced) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;
  const sets = document.querySelectorAll<SVGSVGElement>('svg[data-pupils]');
  if (!sets.length) return;

  let mx = innerWidth / 2, my = innerHeight / 2;
  let raf = 0;
  const state = new Map<Element, { x: number; y: number; lx: number; ly: number }>();
  sets.forEach((s) => state.set(s, { x: 0, y: 0, lx: 0, ly: 0 }));

  const onMove = (e: PointerEvent) => { mx = e.clientX; my = e.clientY; if (!raf) raf = requestAnimationFrame(tick); };

  function tick() {
    raf = 0;
    let active = false;
    sets.forEach((svg) => {
      const r = svg.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = mx - cx, dy = my - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(dist / 60, 1) * 7; // clamped pupil travel in viewBox units
      const tx = (dx / dist) * reach, ty = (dy / dist) * reach;
      const s = state.get(svg)!;
      s.x += (tx - s.x) * 0.22; s.y += (ty - s.y) * 0.22;        // leading eye
      s.lx += (tx - s.lx) * 0.09; s.ly += (ty - s.ly) * 0.09;    // lagging eye (~80ms behind)
      const l = svg.querySelector<SVGElement>('#pupil-l');
      const rr = svg.querySelector<SVGElement>('#pupil-r');
      if (l) l.style.transform = `translate(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px)`;
      if (rr) rr.style.transform = `translate(${s.lx.toFixed(2)}px, ${s.ly.toFixed(2)}px)`;
      if (Math.abs(tx - s.x) > 0.05 || Math.abs(tx - s.lx) > 0.05) active = true;
    });
    if (active) raf = requestAnimationFrame(tick);
  }

  window.addEventListener('pointermove', onMove, { passive: true });
  return () => { window.removeEventListener('pointermove', onMove); if (raf) cancelAnimationFrame(raf); };
});

defineModule('magnetic', ({ reduced }) => {
  if (reduced || !window.matchMedia('(pointer: fine)').matches) return;
  const els = document.querySelectorAll<HTMLElement>('[data-magnetic]');
  if (!els.length) return;
  const cleanups: (() => void)[] = [];
  els.forEach((el) => {
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      gsap.to(el, { x: dx * 0.18, y: dy * 0.18, duration: 0.3, ease: 'power2.out' });
    };
    const onLeave = () => gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.45)' });
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    cleanups.push(() => { el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerleave', onLeave); });
  });
  return () => cleanups.forEach((c) => c());
});

defineModule('beam-up', ({ reduced }) => {
  const onAdded = ((e: CustomEvent<{ from?: HTMLElement }>) => {
    const cartBtn = document.getElementById('cart-open');
    if (!cartBtn) return;
    const count = cartBtn.querySelector('[data-cart-count]');
    if (reduced) { return; }
    const from = e.detail?.from;
    if (from) {
      const a = document.createElement('img');
      a.src = '/favicon.svg';
      a.alt = '';
      a.style.cssText = 'position:fixed;width:40px;height:34px;z-index:99;pointer-events:none;';
      const fr = from.getBoundingClientRect();
      const tr = cartBtn.getBoundingClientRect();
      a.style.left = `${fr.left + fr.width / 2 - 20}px`;
      a.style.top = `${fr.top - 10}px`;
      document.body.appendChild(a);
      gsap.timeline({ onComplete: () => a.remove() })
        .to(a, { y: -46, rotate: -10, duration: 0.22, ease: 'power1.out' })
        .to(a, {
          x: tr.left + tr.width / 2 - (fr.left + fr.width / 2),
          y: tr.top - fr.top + 6,
          scale: 0.25, rotate: 14,
          duration: 0.55, ease: 'power3.in',
        })
        .to(a, { opacity: 0, duration: 0.12 });
    }
    if (count) {
      gsap.fromTo(count, { scale: 1.6, background: '#F0A028' }, { scale: 1, clearProps: 'background', duration: 0.5, ease: 'elastic.out(1.2, 0.5)', delay: reduced ? 0 : 0.7 });
    }
  }) as EventListener;
  document.addEventListener('gf:added', onAdded);
  return () => document.removeEventListener('gf:added', onAdded);
});

defineModule('easter-egg', () => {
  const logo = document.getElementById('logo-mark');
  if (!logo) return;
  let clicks = 0, timer = 0;
  const onClick = (e: MouseEvent) => {
    clicks++;
    if (clicks >= 5) {
      e.preventDefault();
      clicks = 0;
      document.body.classList.add('gf-eyes-spin');
      setTimeout(() => document.body.classList.remove('gf-eyes-spin'), 3200);
    }
    clearTimeout(timer);
    timer = window.setTimeout(() => { clicks = 0; }, 1800);
    if (clicks >= 2) e.preventDefault(); // committed to the secret — don't navigate away mid-combo
  };
  logo.addEventListener('click', onClick);
  return () => logo.removeEventListener('click', onClick);
});
