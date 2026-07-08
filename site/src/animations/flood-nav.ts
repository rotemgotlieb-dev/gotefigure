// Flood-to-navigate v3 — design timings (cover 620ms / reveal 720ms) + per-trigger ink color
// via [data-flood]. Wraps Astro's loader so ink COVERS → swap happens hidden → DRAINS on
// astro:page-load. Fail-safe by construction (try/catch + hard timeout — nav can never break).
// Reduced-motion: no flood, instant nav. Bound ONCE at import (global nav behavior); overlay
// persists in Layout via transition:persist="flood".
import { navigate } from 'astro:transitions/client';

const K = { COVER_MS: 620, REVEAL_MS: 720, EDGE_AMP: 26 };
const INK = '#16130F';

let fvW = 0, fvH = 0;
let origin = { x: 0, y: 0 }, rMax = 0, covered = false, raf = 0;
let pending: { x: number; y: number; color: string } | null = null;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

function refs() {
  const svg = document.querySelector<SVGSVGElement>('.gf-flood');
  const path = svg?.querySelector<SVGPathElement>('.gf-flood-path');
  return svg && path ? { svg, path } : null;
}
function size(svg: SVGSVGElement) { fvW = innerWidth; fvH = innerHeight; svg.setAttribute('viewBox', `0 0 ${fvW} ${fvH}`); }

function coverPath(e: number, now: number) {
  const R = e * rMax, amp = K.EDGE_AMP * Math.min(1, R / 40), et = now * 0.006, N = 56;
  let d = '';
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rr = R + amp * 0.7 * Math.sin(a * 5 + et) + amp * 0.4 * Math.sin(a * 9 - et * 1.3);
    d += (i ? ' L ' : 'M ') + (origin.x + rr * Math.cos(a)).toFixed(1) + ' ' + (origin.y + rr * Math.sin(a)).toFixed(1);
  }
  return d + ' Z';
}
function revealPath(e: number, now: number) {
  const amp = K.EDGE_AMP, N = 48, et = now * 0.001;
  const edge = (x: number) => amp * 0.6 * Math.sin(x * 0.012 + et * 4) + amp * 0.4 * Math.sin(x * 0.03 - et * 6);
  const wy = e * (fvH + amp * 2 + 30) - amp;
  if (wy >= fvH + amp + 5) return '';
  let d = `M 0 ${fvH} L ${fvW} ${fvH}`;
  for (let i = 0; i <= N; i++) { const x = fvW * (1 - i / N); d += ` L ${x.toFixed(1)} ${(wy + edge(x)).toFixed(1)}`; }
  return d + ' Z';
}

function playCover(svg: SVGSVGElement, path: SVGPathElement) {
  return new Promise<void>((resolve) => {
    const t0 = performance.now(); svg.style.opacity = '1';
    let done = false;
    const finish = () => { if (done) return; done = true; covered = true; path.setAttribute('d', `M 0 0 L ${fvW} 0 L ${fvW} ${fvH} L 0 ${fvH} Z`); resolve(); };
    const tick = (now: number) => {
      let p = (now - t0) / K.COVER_MS; if (p >= 1) p = 1;
      path.setAttribute('d', coverPath(easeInOut(p), now));
      if (p >= 1) { finish(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    setTimeout(finish, K.COVER_MS + 300);                 // hard fallback: never hang the loader
  });
}
function playReveal(svg: SVGSVGElement, path: SVGPathElement) {
  const t0 = performance.now();
  const tick = (now: number) => {
    let p = (now - t0) / K.REVEAL_MS; if (p >= 1) p = 1;
    const d = revealPath(easeInOut(p), now);
    path.setAttribute('d', d);
    if (p >= 1 || d === '') {
      svg.style.opacity = '0'; path.setAttribute('d', ''); path.setAttribute('fill', INK);
      covered = false; raf = 0; return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

/** Programmatic flood navigation — used by ink buttons (data-nav). Ink color from data-flood. */
export function floodNavigate(target: string, btn?: HTMLElement | null) {
  if (btn) {
    const b = btn.getBoundingClientRect();
    pending = {
      x: b.left + b.width / 2,
      y: b.top + b.height / 2,
      color: btn.getAttribute('data-flood') || INK,
    };
  }
  navigate(target);
}

export function initFloodNav() {
  addEventListener('resize', () => { const r = refs(); if (r) size(r.svg); }, { passive: true });

  document.addEventListener('astro:before-preparation', (e: Event) => {
    const ev = e as Event & { loader?: () => Promise<void>; sourceElement?: HTMLElement };
    const p = pending; pending = null;
    if (reduced() || typeof ev.loader !== 'function') return;
    const r = refs(); if (!r) return;
    size(r.svg);
    let ox = fvW / 2, oy = fvH / 2, color = INK;
    if (p) { ox = p.x; oy = p.y; color = p.color; }
    else {
      const src = ev.sourceElement;
      if (src && typeof src.getBoundingClientRect === 'function') {
        const b = src.getBoundingClientRect();
        if (b.width || b.height) { ox = b.left + b.width / 2; oy = b.top + b.height / 2; }
        color = src.closest<HTMLElement>('[data-flood]')?.getAttribute('data-flood') || INK;
      }
    }
    origin = { x: ox, y: oy };
    r.path.setAttribute('fill', color);
    rMax = Math.max(Math.hypot(ox, oy), Math.hypot(fvW - ox, oy), Math.hypot(ox, fvH - oy), Math.hypot(fvW - ox, fvH - oy)) + K.EDGE_AMP + 60;
    const orig = ev.loader.bind(ev);
    ev.loader = async () => {
      try { cancelAnimationFrame(raf); await playCover(r.svg, r.path); } catch { /* never block nav */ }
      await orig();
    };
  });

  document.addEventListener('astro:page-load', () => {
    if (reduced()) { covered = false; const r = refs(); if (r) { r.svg.style.opacity = '0'; r.path.setAttribute('d', ''); } return; }
    const r = refs(); if (!r) return;
    size(r.svg);
    if (covered) { cancelAnimationFrame(raf); playReveal(r.svg, r.path); }
  });
}
