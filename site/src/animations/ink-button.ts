// Ink-Fill button (§7 / research/INK-BUTTON-DESIGN-PROMPT.md): GoteFigure's signature CTA.
// Progressive enhancement — any element with [data-ink] gets the wet-ink fill + waterline-tracked
// label flip + attached drips that auto-weave around real elements beneath it. The module INJECTS
// its own SVG layers + inline styles and restores everything on destroy (no markup/logic changes to
// the host button — the buy form/label/submit stay intact). Reduced-motion: instant fill, no drips/snap.
// Lifecycle is owned by core.ts (init on astro:page-load, destroy on astro:before-swap) — §7.6.6.
import { defineModule } from './core';

const SVGNS = 'http://www.w3.org/2000/svg';
const INK = '#111111';
const PAPER = '#F2F1EA';

const K = {
  FILL_MS: 920, SNAP_MS: 430, SNAP_OVERSHOOT: 1.7,
  DRIP_SPACING: 26, DRIP_MIN: 3, DRIP_MAX: 16,
  DRIP_MAX_LEN: 80, DRIP_GROW_PXPS: 46, DRIP_HEAD_R: 3.6, DRIP_TOPW: 7, DRIP_RETRACT_MS: 360,
  DRIP_AVOID: true, DRIP_REACH: 320, DRIP_OBSTACLE_GAP: 9, DRIP_SOFT: 14, DRIP_LEAD: 18, DRIP_WOBBLE: 2,
  MENISCUS_H: 5, RIPPLE_AMP: 2.4, SEG: 40,
};

const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
const so = K.SNAP_OVERSHOOT, c3 = so + 1;
const easeOutBack = (p: number) => 1 + c3 * Math.pow(p - 1, 3) + so * Math.pow(p - 1, 2);
const SMOOTH01 = (p: number) => (p <= 0 ? 0 : p >= 1 ? 1 : p * p * (3 - 2 * p));
const smin = (a: number, b: number, k: number) => { const h = Math.max(0, k - Math.abs(a - b)) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

type Obstacle = { left: number; right: number; top: number; bottom: number; w: number; h: number; cx: number; cy: number; r: number; cr: number; circle: boolean };
type Run = { x0: number; topW: number; headR: number; grow: number; dense: { x: number; y: number; s: number }[]; fullLen: number; len: number; retracting: boolean; retractFrom: number; retractStart: number; el: SVGPathElement };

defineModule('ink-button', ({ reduced }) => {
  const targets = [...document.querySelectorAll<HTMLElement>('[data-ink]')];
  if (!targets.length) return;
  const canHover = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const controllers = targets.map((el) => enhance(el, reduced, canHover));
  return () => controllers.forEach((c) => c.destroy());
});

function enhance(btn: HTMLElement, reduced: boolean, canHover: boolean) {
  const prevInline = btn.getAttribute('style');                       // restore verbatim on destroy
  const cs = getComputedStyle(btn);
  const radius = cs.borderRadius && cs.borderRadius !== '0px' ? cs.borderRadius : '12px';
  // ---- restyle host to the clear ink-fill idle state (inline = reversible)
  // Respect the host's authored idle look (amber buy button stays amber; a CTA authored "clear"
  // stays clear). The ink simply floods over whatever background is there, on hover.
  btn.style.position = (cs.position === 'static' ? 'relative' : cs.position);
  btn.style.overflow = 'visible';
  btn.style.isolation = 'isolate';
  // label colour left as authored: dark labels flip to paper under the waterline; light (paper) labels
  // stay paper — readable on both the idle colour and the ink. The paper clone below covers either case.

  // ---- inject layers
  const wrap = document.createElement('span');
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.cssText = `position:absolute;inset:0;border-radius:${radius};overflow:hidden;z-index:0;pointer-events:none`;
  const fillSvg = document.createElementNS(SVGNS, 'svg');
  fillSvg.setAttribute('preserveAspectRatio', 'none');
  fillSvg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  const fillPath = document.createElementNS(SVGNS, 'path');
  fillPath.setAttribute('fill', INK);
  fillSvg.appendChild(fillPath); wrap.appendChild(fillSvg);

  const paper = document.createElement('span');                       // paper-colour label clone, masked by the waterline
  paper.setAttribute('aria-hidden', 'true');
  paper.textContent = (btn.textContent || '').trim();
  paper.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:3;color:${PAPER};pointer-events:none;font:inherit;letter-spacing:inherit;text-shadow:0 0 1px rgba(17,17,17,.35);padding:inherit`;

  const dripSvg = document.createElementNS(SVGNS, 'svg');
  dripSvg.setAttribute('aria-hidden', 'true');
  dripSvg.setAttribute('preserveAspectRatio', 'none');
  dripSvg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;z-index:1;pointer-events:none';
  const dripG = document.createElementNS(SVGNS, 'g');
  dripSvg.appendChild(dripG);

  btn.prepend(wrap);                  // fill sits behind the existing (now ink-coloured) label
  btn.appendChild(paper);
  btn.appendChild(dripSvg);

  let W = 0, H = 0; const FALL = K.DRIP_REACH;
  let f = 0, anim: { from: number; to: number; start: number; dur: number; ease: (p: number) => number } | null = null;
  let hovering = false, phase = 0;
  let runs: Run[] = [], lastT = 0, running = false, rafId = 0, drainAt = 0, pendingSnapAt = 0;
  let obs: Obstacle[] = [];

  const measure = () => {
    W = btn.clientWidth; H = btn.clientHeight;
    fillSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    dripSvg.setAttribute('width', String(W)); dripSvg.setAttribute('height', String(H + FALL));
    dripSvg.setAttribute('viewBox', `0 0 ${W} ${H + FALL}`);
  };
  measure();
  const ro = new ResizeObserver(measure); ro.observe(btn);

  const waterY = (x: number, base: number) => {
    const men = K.MENISCUS_H * Math.sin((Math.PI * x) / W);
    const rip = K.RIPPLE_AMP * (Math.sin(x * 0.045 + phase * 2.1) + 0.5 * Math.sin(x * 0.105 - phase * 3.0));
    return base + men + rip;
  };
  const buildFill = () => {
    if (f <= 0.002) { fillPath.setAttribute('d', ''); return; }
    const base = f * H; let d = `M 0 0 L ${W} 0`;
    for (let i = K.SEG; i >= 0; i--) { const x = (i / K.SEG) * W; d += ` L ${x.toFixed(1)} ${waterY(x, base).toFixed(1)}`; }
    fillPath.setAttribute('d', d + ' Z');
  };
  const buildLabel = () => {
    const wY = f * H + K.MENISCUS_H;
    const m = `linear-gradient(to bottom, #000 ${(wY - 1.2).toFixed(1)}px, rgba(0,0,0,0) ${(wY + 1.2).toFixed(1)}px)`;
    (paper.style as any).webkitMaskImage = m; paper.style.maskImage = m;
  };

  // ---- global flow-around: auto-detect solid boxes beneath the button, route drips around them
  const scanObstacles = () => {
    obs = []; if (!K.DRIP_AVOID) return;
    const br = btn.getBoundingClientRect(), reach = K.DRIP_REACH, found = new Map<Element, DOMRect>(), COLS = 9, ROWS = 12;
    for (let i = 0; i <= COLS; i++) for (let j = 0; j <= ROWS; j++) {
      const px = br.left + br.width * (i / COLS), py = br.bottom + 2 + (reach - 2) * (j / ROWS);
      for (const el of document.elementsFromPoint(px, py)) {
        if (!el || el === btn || btn.contains(el) || el.contains(btn) || found.has(el)) continue;
        if (el === document.body || el === document.documentElement || el.closest('[data-ink]')) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 12 || r.height < 12) continue;
        if (r.width > br.width + reach * 2 && r.height > reach) continue;
        const s = getComputedStyle(el), bg = s.backgroundColor;
        const hasBg = !!bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)';
        const hasBorder = (parseFloat(s.borderTopWidth) || 0) > 0 && s.borderTopStyle !== 'none';
        const solid = /^(IMG|BUTTON|A|INPUT|SELECT|TEXTAREA|CANVAS|VIDEO|svg)$/i.test(el.tagName) || el.hasAttribute('data-ink-obstacle');
        if (!(hasBg || hasBorder || solid)) continue;
        found.set(el, r as DOMRect);
      }
    }
    obs = [...found.entries()].map(([el, r]) => {
      const left = r.left - br.left, right = r.right - br.left, top = r.top - br.top, bottom = r.bottom - br.top;
      const w = r.width, h = r.height, rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      const circle = rad >= Math.min(w, h) / 2 - 1;
      return { left, right, top, bottom, w, h, cx: (left + right) / 2, cy: (top + bottom) / 2, r: Math.min(w, h) / 2, cr: circle ? Math.min(w, h) / 2 : rad, circle };
    }).filter((o) => o.bottom > H + 1);
  };
  const boundaryX = (ob: Obstacle, y: number, side: 'left' | 'right'): number | null => {
    const GAP = K.DRIP_OBSTACLE_GAP;
    if (ob.circle) { const R = ob.r + GAP, dy = y - ob.cy; if (Math.abs(dy) >= R) return null; const dx = Math.sqrt(R * R - dy * dy); return side === 'left' ? ob.cx - dx : ob.cx + dx; }
    const lead = K.DRIP_LEAD, t2 = ob.top - GAP, b2 = ob.bottom + GAP, l2 = ob.left - GAP, r2 = ob.right + GAP;
    if (y <= t2 - lead || y >= b2 + lead) return null;
    const R = Math.min(ob.cr + GAP, (r2 - l2) / 2, (b2 - t2) / 2);
    let t = 1; if (y < t2) t = SMOOTH01((y - (t2 - lead)) / lead); else if (y > b2) t = SMOOTH01((b2 + lead - y) / lead);
    const yc = Math.max(t2, Math.min(b2, y)); let bx: number;
    if (side === 'left') { if (yc <= t2 + R) bx = (l2 + R) - Math.sqrt(Math.max(0, R * R - (yc - (t2 + R)) ** 2)); else if (yc >= b2 - R) bx = (l2 + R) - Math.sqrt(Math.max(0, R * R - (yc - (b2 - R)) ** 2)); else bx = l2; return bx + (1 - t) * 1e5; }
    if (yc <= t2 + R) bx = (r2 - R) + Math.sqrt(Math.max(0, R * R - (yc - (t2 + R)) ** 2)); else if (yc >= b2 - R) bx = (r2 - R) + Math.sqrt(Math.max(0, R * R - (yc - (b2 - R)) ** 2)); else bx = r2; return bx - (1 - t) * 1e5;
  };
  const STEP = 4;
  const densify = (poly: number[][]) => { const out = [{ x: poly[0][0], y: poly[0][1] }]; for (let i = 1; i < poly.length; i++) { const a = poly[i - 1], b = poly[i]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-3) continue; const steps = Math.max(1, Math.round(L / STEP)); for (let k = 1; k <= steps; k++) { const u = k / steps; out.push({ x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u }); } } return out; };
  const smoothPts = (arr: { x: number; y: number }[], passes: number) => { let a = arr; for (let p = 0; p < passes; p++) a = a.map((pt, i) => { if (i === 0 || i === a.length - 1) return { x: pt.x, y: pt.y }; const q = a[i - 1], r = a[i + 1]; return { x: q.x * 0.25 + pt.x * 0.5 + r.x * 0.25, y: q.y * 0.25 + pt.y * 0.5 + r.y * 0.25 }; }); return a; };
  const withS = (a: { x: number; y: number; s?: number }[]) => { a[0].s = 0; let acc = 0; for (let i = 1; i < a.length; i++) { acc += Math.hypot(a[i].x - a[i - 1].x, a[i].y - a[i - 1].y); a[i].s = acc; } return a as { x: number; y: number; s: number }[]; };
  const centerline = (x0: number, reach: number) => {
    const pts: number[][] = [], yEnd = H + reach;
    for (let y = H; y <= yEnd + 0.5; y += STEP) {
      let x = x0 + K.DRIP_WOBBLE * (Math.sin(y * 0.05 + x0 * 0.02) * 0.6 + Math.sin(y * 0.021 - x0 * 0.03) * 0.4) * Math.min(1, (y - H) / 45);
      for (const ob of obs) { const side: 'left' | 'right' = x0 < ob.cx ? 'left' : 'right'; const b = boundaryX(ob, y, side); if (b == null) continue; x = side === 'left' ? smin(x, b, K.DRIP_SOFT) : smax(x, b, K.DRIP_SOFT); }
      pts.push([x, y]);
    }
    return pts;
  };
  const buildRibbon = (dense: { x: number; y: number; s: number }[], headLen: number, topW: number, headR: number) => {
    if (headLen < 3) return '';
    const pts: { x: number; y: number; s: number }[] = []; let nextPt: { x: number; y: number; s: number } | null = null;
    for (const p of dense) { if (p.s <= headLen) pts.push(p); else { nextPt = p; break; } }
    if (nextPt && pts.length) { const last = pts[pts.length - 1], seg = nextPt.s - last.s; if (seg > 1e-3) { const fr = (headLen - last.s) / seg; pts.push({ x: last.x + (nextPt.x - last.x) * fr, y: last.y + (nextPt.y - last.y) * fr, s: headLen }); } }  // exact tip → smooth growth (no 4px stepping)
    if (pts.length < 2) return '';
    const n = pts.length, L = Math.max(headLen, pts[n - 1].s), left: number[][] = [], right: number[][] = [];
    for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let tx = b.x - a.x, ty = b.y - a.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl; const px = -ty, py = tx; const hw = Math.max(headR * 0.62, headR + (topW / 2 - headR) * Math.pow(1 - pts[i].s / L, 0.72)); left.push([pts[i].x + px * hw, pts[i].y + py * hw]); right.push([pts[i].x - px * hw, pts[i].y - py * hw]); }
    let d = 'M ' + left[0][0].toFixed(1) + ' ' + left[0][1].toFixed(1);
    for (let i = 1; i < n; i++) d += ' L ' + left[i][0].toFixed(1) + ' ' + left[i][1].toFixed(1);
    d += ' A ' + headR.toFixed(1) + ' ' + headR.toFixed(1) + ' 0 0 0 ' + right[n - 1][0].toFixed(1) + ' ' + right[n - 1][1].toFixed(1);  // sweep 0 = convex rounded bulb (not concave)
    for (let i = n - 1; i >= 0; i--) d += ' L ' + right[i][0].toFixed(1) + ' ' + right[i][1].toFixed(1);
    return d + ' Z';
  };
  const makeRuns = () => {
    dripG.innerHTML = ''; runs = [];
    const n = Math.max(K.DRIP_MIN, Math.min(K.DRIP_MAX, Math.round(W / K.DRIP_SPACING)));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      let x0 = t * W + (Math.random() - 0.5) * (W / n) * 0.42;
      const topW = K.DRIP_TOPW * (0.7 + Math.random() * 0.85);
      x0 = Math.max(topW, Math.min(W - topW, x0));
      const leader = Math.random() < 0.34;
      let reach = leader ? K.DRIP_MAX_LEN * (0.78 + Math.random() * 0.22) : K.DRIP_MAX_LEN * (0.24 + Math.random() * 0.36);
      for (const ob of obs) if (x0 >= ob.left - K.DRIP_OBSTACLE_GAP && x0 <= ob.right + K.DRIP_OBSTACLE_GAP && ob.bottom > H) reach = Math.max(reach, ob.bottom - H + 28);
      reach = Math.min(reach, K.DRIP_REACH);
      const headR = K.DRIP_HEAD_R * (0.8 + Math.random() * 0.55);
      const grow = K.DRIP_GROW_PXPS * (0.8 + Math.random() * 0.5);
      const dense = withS(smoothPts(densify(centerline(x0, reach)), 3));
      const el = document.createElementNS(SVGNS, 'path'); el.setAttribute('fill', INK);
      dripG.appendChild(el);
      runs.push({ x0, topW, headR, grow, dense, fullLen: dense[dense.length - 1].s, len: 0, retracting: false, retractFrom: 0, retractStart: 0, el });
    }
  };
  const drawRun = (r: Run) => { r.el.setAttribute('d', r.len < 0.6 ? '' : buildRibbon(r.dense, r.len, r.topW, r.headR)); };

  const tick = (now: number) => {
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016; lastT = now; phase += dt;
    if (anim) { let p = (now - anim.start) / anim.dur; if (p >= 1) p = 1; f = anim.from + (anim.to - anim.from) * anim.ease(p); if (p >= 1) { f = anim.to; anim = null; } }
    buildFill(); buildLabel();
    if (drainAt && now >= drainAt) { drainAt = 0; hovering = false; pendingSnapAt = now + K.DRIP_RETRACT_MS * 0.82; }
    let anyRun = false;
    for (const r of runs) {
      if (hovering && !reduced) { const tgt = f > 0.98 ? r.fullLen : 0; if (r.len < tgt) r.len = Math.min(tgt, r.len + r.grow * dt); else if (r.len > tgt) r.len = Math.max(tgt, r.len - r.grow * 2 * dt); r.retracting = false; }
      else { if (!r.retracting) { r.retracting = true; r.retractFrom = r.len; r.retractStart = now; } let p = (now - r.retractStart) / K.DRIP_RETRACT_MS; if (p >= 1) p = 1; r.len = r.retractFrom * (1 - easeOutCubic(p)); }
      drawRun(r); if (r.len > 0.4) anyRun = true;
    }
    if (!hovering && !anyRun && runs.length) { dripG.innerHTML = ''; runs = []; }
    if (pendingSnapAt && now >= pendingSnapAt) { pendingSnapAt = 0; anim = { from: f, to: 0, start: now, dur: K.SNAP_MS, ease: easeOutBack }; }
    running = !!(anim || (hovering && !reduced) || anyRun || drainAt || pendingSnapAt);
    if (running) rafId = requestAnimationFrame(tick); else { rafId = 0; lastT = 0; }
  };
  const start = () => { if (!running) { running = true; lastT = 0; rafId = requestAnimationFrame(tick); } };
  const fill = (dur: number) => { anim = { from: f, to: 1, start: performance.now(), dur, ease: easeOutCubic }; start(); };

  const onEnter = () => { hovering = true; pendingSnapAt = 0; drainAt = 0; if (reduced) { f = 1; buildFill(); buildLabel(); } else { if (!runs.length) { scanObstacles(); makeRuns(); } fill(K.FILL_MS); } };
  const onLeave = () => { hovering = false; if (reduced) { f = 0; dripG.innerHTML = ''; runs = []; buildFill(); buildLabel(); } else { pendingSnapAt = performance.now() + K.DRIP_RETRACT_MS * 0.82; start(); } };
  const onTap = () => { if (reduced) { f = 1; buildFill(); buildLabel(); setTimeout(() => { f = 0; buildFill(); buildLabel(); }, 700); return; } hovering = true; if (!runs.length) { scanObstacles(); makeRuns(); } fill(K.FILL_MS * 0.7); drainAt = performance.now() + 900; };

  if (canHover) {
    btn.addEventListener('pointerenter', onEnter);
    btn.addEventListener('pointerleave', onLeave);
    btn.addEventListener('focus', onEnter);
    btn.addEventListener('blur', onLeave);
  } else {
    btn.addEventListener('pointerdown', onTap);
  }

  buildFill(); buildLabel();
  return {
    destroy() {
      cancelAnimationFrame(rafId); ro.disconnect();
      btn.removeEventListener('pointerenter', onEnter); btn.removeEventListener('pointerleave', onLeave);
      btn.removeEventListener('focus', onEnter); btn.removeEventListener('blur', onLeave);
      btn.removeEventListener('pointerdown', onTap);
      wrap.remove(); paper.remove(); dripSvg.remove();
      if (prevInline === null) btn.removeAttribute('style'); else btn.setAttribute('style', prevInline);
    },
  };
}
