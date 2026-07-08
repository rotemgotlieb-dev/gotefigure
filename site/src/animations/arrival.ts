// Arrival — one drop of ink (design _runIntro, lines 752-799). Plays once per session on the
// home page: ink dot falls → flood covers BENEATH the paper layer → paper fades to black +
// inverted wordmark → flood drains to reveal the store. Pre-paint gate: html[data-arrival]
// (set in Layout head only when gf3-intro unseen + motion OK). Skippable at every moment.
import { defineModule } from './core';

const COVER_MS = 760, REVEAL_MS = 800;
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

defineModule('arrival', ({ reduced }) => {
  const root = document.querySelector<HTMLElement>('[data-arrival-root]');
  if (!root || !document.documentElement.dataset.arrival || reduced) { cleanup(root); return; }

  const dot = root.querySelector<HTMLElement>('[data-arrival-dot]');
  const wm = root.querySelector<HTMLElement>('[data-arrival-wm]');
  const paper = root.querySelector<HTMLElement>('[data-arrival-paper]');
  const skip = root.querySelector<HTMLElement>('[data-arrival-skip]');
  const floodSvg = document.querySelector<SVGSVGElement>('.gf-flood');
  const floodPath = floodSvg?.querySelector<SVGPathElement>('.gf-flood-path');
  if (!dot || !floodSvg || !floodPath) { end(); return; }

  const timers: ReturnType<typeof setTimeout>[] = [];
  let raf = 0, ended = false;
  const W = innerWidth, H = innerHeight;
  const cx = W / 2, cy = H * 0.46;
  const rMax = Math.max(Math.hypot(cx, cy), Math.hypot(W - cx, cy), Math.hypot(cx, H - cy), Math.hypot(W - cx, H - cy)) + 90;
  floodSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const coverPath = (e: number, now: number) => {
    const R = e * rMax, amp = 26 * Math.min(1, R / 40), et = now * 0.006, N = 56;
    let d = '';
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const rr = R + amp * 0.7 * Math.sin(a * 5 + et) + amp * 0.4 * Math.sin(a * 9 - et * 1.3);
      d += (i ? ' L ' : 'M ') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1);
    }
    return d + ' Z';
  };
  const revealPath = (e: number, now: number) => {
    const amp = 26, N = 48, et = now * 0.001;
    const edge = (x: number) => amp * 0.6 * Math.sin(x * 0.012 + et * 4) + amp * 0.4 * Math.sin(x * 0.03 - et * 6);
    const wy = e * (H + amp * 2 + 30) - amp;
    if (wy >= H + amp + 5) return '';
    let d = `M 0 ${H} L ${W} ${H}`;
    for (let i = 0; i <= N; i++) { const x = W * (1 - i / N); d += ` L ${x.toFixed(1)} ${(wy + edge(x)).toFixed(1)}`; }
    return d + ' Z';
  };

  function end() {
    if (ended) return; ended = true;
    timers.forEach(clearTimeout);
    cancelAnimationFrame(raf);
    if (floodSvg && floodPath) { floodSvg.style.opacity = '0'; floodPath.setAttribute('d', ''); }
    try { sessionStorage.setItem('gf3-intro', '1'); } catch { /* private mode */ }
    cleanup(root);
  }

  // ---- timeline (design timings)
  dot.style.opacity = '1';
  dot.style.transition = 'transform .62s cubic-bezier(.5,.05,.85,.5)';
  timers.push(setTimeout(() => { dot.style.transform = `translateY(${cy + H * 0.04}px) scaleY(1.25)`; }, 60));
  timers.push(setTimeout(() => {
    dot.style.opacity = '0';
    floodSvg.style.opacity = '1';
    const t0 = performance.now();
    const step = (now: number) => {
      if (ended) return;
      let p = (now - t0) / COVER_MS; if (p > 1) p = 1;
      floodPath.setAttribute('d', coverPath(easeInOut(p), now));
      if (p < 1) raf = requestAnimationFrame(step);
      else floodPath.setAttribute('d', `M 0 0 L ${W} 0 L ${W} ${H} L 0 ${H} Z`);
    };
    raf = requestAnimationFrame(step);
  }, 700));
  timers.push(setTimeout(() => { if (wm) wm.style.opacity = '1'; if (paper) paper.style.opacity = '0'; }, 1560));
  timers.push(setTimeout(() => { if (wm) wm.style.opacity = '0'; if (paper) paper.style.display = 'none'; }, 2660));
  timers.push(setTimeout(() => {
    const t0 = performance.now();
    const step = (now: number) => {
      if (ended) return;
      let p = (now - t0) / REVEAL_MS; if (p > 1) p = 1;
      floodPath.setAttribute('d', revealPath(easeInOut(p), now));
      if (p < 1) raf = requestAnimationFrame(step);
      else end();
    };
    raf = requestAnimationFrame(step);
  }, 3000));

  skip?.addEventListener('click', end, { once: true });

  return () => end();
});

function cleanup(root: HTMLElement | null) {
  delete document.documentElement.dataset.arrival;
  root?.remove();
}
