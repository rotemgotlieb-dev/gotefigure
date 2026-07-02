// Ink trail (owner request): the cursor leaves a fading pen scribble behind it.
// One full-viewport canvas, single RAF, velocity-based stroke width (slow = press harder),
// quadratic smoothing through midpoints. Fine pointers only; reduced-motion: off;
// idle RAF stops when the trail is empty (portfolio canon: no always-running loops).
import { defineModule } from './core';

const LIFE = 650;        // ms a stroke point lives
const MAX_POINTS = 90;
const INK = '17, 17, 17'; // --ink

defineModule('ink-trail', ({ reduced }) => {
  if (reduced) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:70;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  let dpr = Math.min(devicePixelRatio || 1, 2);
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  }
  resize();
  addEventListener('resize', resize);

  type Pt = { x: number; y: number; t: number; v: number };
  const pts: Pt[] = [];
  let raf = 0;
  let last: { x: number; y: number; t: number } | null = null;

  function onMove(e: PointerEvent) {
    const t = performance.now();
    let v = 0;
    if (last) {
      const dt = Math.max(t - last.t, 1);
      v = Math.hypot(e.clientX - last.x, e.clientY - last.y) / dt; // px per ms
    }
    last = { x: e.clientX, y: e.clientY, t };
    pts.push({ x: e.clientX, y: e.clientY, t, v });
    if (pts.length > MAX_POINTS) pts.splice(0, pts.length - MAX_POINTS);
    if (!raf) raf = requestAnimationFrame(draw);
  }

  function draw() {
    raf = 0;
    const now = performance.now();
    while (pts.length && now - pts[0].t > LIFE) pts.shift();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (pts.length > 2) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < pts.length - 1; i++) {
        const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
        const age = (now - p1.t) / LIFE;                  // 0 fresh → 1 dead
        const alpha = Math.max(0, 0.55 * (1 - age) ** 1.6);
        // pen pressure: slow movement = thick ink, fast flicks = thin
        const w = Math.max(0.7, 3.4 - Math.min(p1.v * 2.2, 2.9)) * (1 - age * 0.5);
        ctx.strokeStyle = `rgba(${INK}, ${alpha.toFixed(3)})`;
        ctx.lineWidth = w * dpr;
        ctx.beginPath();
        ctx.moveTo(((p0.x + p1.x) / 2) * dpr, ((p0.y + p1.y) / 2) * dpr);
        ctx.quadraticCurveTo(p1.x * dpr, p1.y * dpr, ((p1.x + p2.x) / 2) * dpr, ((p1.y + p2.y) / 2) * dpr);
        ctx.stroke();
      }
    }
    if (pts.length) raf = requestAnimationFrame(draw);
  }

  const onVis = () => { if (document.hidden) { pts.length = 0; ctx.clearRect(0, 0, canvas.width, canvas.height); } };
  addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('visibilitychange', onVis);

  return () => {
    removeEventListener('pointermove', onMove);
    removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVis);
    if (raf) cancelAnimationFrame(raf);
    canvas.remove();
  };
});
