// Ink-fill button v3 — the finalized brand animation, ported 1:1 from the Fable 5 design
// (GoteFigure Store.dc.html lines 1575-1891) at locked setting dripStyle=STRAIGHT (flow-mode
// obstacle routing/pools deliberately not shipped — source archived in research/design/).
// Binds to markup authored by components/InkButton.astro (.gf-fill/.gf-lbl-paper/.gf-drips).
// vs v2: meniscus overflow BEAD along the bottom edge, drip-length distribution, mass-based
// head bulge + neck thinning + root flare, droplet RELEASE with gravity after a 0.3s hold.
// Lifecycle owned by core.ts (§7.6.6). Reduced motion: instant fill, no drips, instant clear.
import { defineModule } from './core';
import { floodNavigate } from './flood-nav';

const SVGNS = 'http://www.w3.org/2000/svg';

const K = {
  FILL_MS: 880, SNAP_MS: 430, SNAP_OVERSHOOT: 1.7,
  DRIP_SPACING: 24, DRIP_MIN: 3, DRIP_MAX: 15,
  DRIP_MAX_LEN: 118, DRIP_GROW_PXPS: 44, DRIP_HEAD_R: 3.4, DRIP_TOPW: 7, DRIP_RETRACT_MS: 400,
  MENISCUS_H: 5, RIPPLE_AMP: 2.4, FALL_ZONE: 185, SEG: 40,
};

const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
const so = K.SNAP_OVERSHOOT, c3 = so + 1;
const easeOutBack = (p: number) => 1 + c3 * Math.pow(p - 1, 3) + so * Math.pow(p - 1, 2);

type Run = {
  dense: { x: number; y: number; s: number }[];
  x: number; topW: number; headR: number; grow: number; wph: number;
  targetLen: number; len: number; holdT: number; released: boolean; canRelease: boolean;
  retracting: boolean; retractFrom: number; retractStart: number; el: SVGPathElement;
};
type Drop = { x: number; y: number; vy: number; r: number; el: SVGCircleElement };

defineModule('ink-button', ({ reduced }) => {
  const targets = [...document.querySelectorAll<HTMLElement>('[data-ink-btn]')];
  if (!targets.length) return;
  const canHover = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const controllers = targets.map((el) => make(el, reduced, canHover));
  return () => controllers.forEach((c) => c.destroy());
});

function make(btn: HTMLElement, reduced: boolean, canHover: boolean) {
  const fillSvg = btn.querySelector<SVGSVGElement>('.gf-fillsvg')!;
  const fillPath = btn.querySelector<SVGPathElement>('.gf-fill')!;
  const paper = btn.querySelector<HTMLElement>('.gf-lbl-paper')!;
  const dripSvg = btn.querySelector<SVGSVGElement>('.gf-dripsvg')!;
  const dripG = btn.querySelector<SVGGElement>('.gf-drips')!;
  const inkCol = btn.getAttribute('data-ink-color') || '#16130F';
  const navTarget = btn.getAttribute('data-nav');

  let W = 0, H = 0;
  const FALL = K.FALL_ZONE;
  let f = 0, anim: { from: number; to: number; start: number; dur: number; ease: (p: number) => number } | null = null;
  let hovering = false, phase = 0;
  let runs: Run[] = [], drops: Drop[] = [], beadEl: SVGPathElement | null = null;
  let lastT = 0, running = false, rafId = 0, drainAt = 0, pendingSnapAt = 0;

  const measure = () => {
    W = btn.clientWidth; H = btn.clientHeight;
    fillSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    dripSvg.setAttribute('width', String(W)); dripSvg.setAttribute('height', String(H + FALL));
    dripSvg.setAttribute('viewBox', `0 0 ${W} ${H + FALL}`);
  };
  measure();
  const ro = new ResizeObserver(measure); ro.observe(btn);

  // straight drips: sine-wobble centerline, box-smoothed, arc-length parameterized
  const routeRun = (x0: number, amp: number, freq: number, ph: number) => {
    const pts: { x: number; y: number; s: number }[] = [];
    for (let y = H; y <= H + FALL; y += 3) pts.push({ x: x0 + amp * Math.sin((y - H) * freq + ph), y, s: 0 });
    for (let p2 = 0; p2 < 3; p2++) for (let i = 1; i < pts.length - 1; i++) pts[i].x = pts[i - 1].x * 0.26 + pts[i].x * 0.48 + pts[i + 1].x * 0.26;
    let acc = 0;
    for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); pts[i].s = acc; }
    return pts;
  };

  const waterY = (x: number, base: number) =>
    base + K.MENISCUS_H * Math.sin(Math.PI * x / W) + K.RIPPLE_AMP * (Math.sin(x * 0.045 + phase * 2.1) + 0.5 * Math.sin(x * 0.105 - phase * 3.0));
  const buildFill = () => {
    if (f <= 0.002 || W < 2 || H < 2) { fillPath.setAttribute('d', ''); return; }
    const base = f * H;
    let d = `M 0 0 L ${W} 0`;
    for (let i = K.SEG; i >= 0; i--) { const x = (i / K.SEG) * W; d += ` L ${x.toFixed(1)} ${waterY(x, base).toFixed(1)}`; }
    fillPath.setAttribute('d', d + ' Z');
  };
  const buildLabel = () => {
    const wY = f * H + K.MENISCUS_H;
    const m = `linear-gradient(to bottom, #000 ${(wY - 1.2).toFixed(1)}px, rgba(0,0,0,0) ${(wY + 1.2).toFixed(1)}px)`;
    (paper.style as CSSStyleDeclaration & { webkitMaskImage: string }).webkitMaskImage = m;
    paper.style.maskImage = m;
  };

  const makeRuns = () => {
    dripG.innerHTML = ''; runs = []; drops = [];
    measure();
    if (W < 2 || H < 2) { beadEl = null; return; }
    const inset = Math.min(H * 0.5, 30) + 4;
    const usable = Math.max(20, W - inset * 2);
    const n = Math.max(K.DRIP_MIN, Math.min(K.DRIP_MAX, Math.round(usable / K.DRIP_SPACING)));
    beadEl = document.createElementNS(SVGNS, 'path'); beadEl.setAttribute('fill', inkCol); dripG.appendChild(beadEl);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      let x = inset + t * usable + (Math.random() - 0.5) * (usable / n) * 0.42;
      x = Math.max(inset, Math.min(W - inset, x));
      const dense = routeRun(x, 0.8 + Math.random() * 2.8, 0.02 + Math.random() * 0.05, Math.random() * 6.28);
      const fullLen = dense[dense.length - 1].s;
      const roll = Math.random();
      let targetLen = roll < 0.28 ? 13 + Math.random() * 24 : roll < 0.7 ? 36 + Math.random() * 44 : 84 + Math.random() * (K.DRIP_MAX_LEN - 84);
      targetLen = Math.min(targetLen, fullLen - 2);
      const el = document.createElementNS(SVGNS, 'path'); el.setAttribute('fill', inkCol);
      dripG.appendChild(el);
      runs.push({
        dense, x,
        topW: K.DRIP_TOPW * (0.7 + Math.random() * 0.85),
        headR: K.DRIP_HEAD_R * (0.8 + Math.random() * 0.55),
        grow: K.DRIP_GROW_PXPS * (0.75 + Math.random() * 0.6),
        wph: Math.random() * 6.28,
        targetLen, len: 0, holdT: 0, released: false,
        canRelease: targetLen > 74 && Math.random() < 0.55,
        retracting: false, retractFrom: 0, retractStart: 0, el,
      });
    }
  };

  const drawRun = (r: Run) => {
    if (r.len < 0.8) { r.el.setAttribute('d', ''); return; }
    const dn = r.dense;
    let m = 0;
    while (m < dn.length && dn[m].s <= r.len) m++;
    if (m < 2) { r.el.setAttribute('d', ''); return; }
    const pts = dn.slice(0, m);
    if (m < dn.length) {
      const a2 = dn[m - 1], b2 = dn[m], f2 = (r.len - a2.s) / Math.max(0.001, b2.s - a2.s);
      pts.push({ x: a2.x + (b2.x - a2.x) * f2, y: a2.y + (b2.y - a2.y) * f2, s: r.len });
    }
    const n2 = pts.length, Lt = Math.max(r.len, 1);
    const mass = Math.min(1, r.len / 92);
    const hrT = Math.max(1.6, r.headR * (0.72 + 0.85 * mass));
    const neck = 1 - 0.3 * Math.min(1, r.len / (r.targetLen || 1));
    const headSpan = Math.min(18, Lt * 0.55);
    const txs: number[] = [], tys: number[] = [], hws: number[] = [];
    for (let i = 0; i < n2; i++) {
      const a3 = pts[Math.max(0, i - 1)], b3 = pts[Math.min(n2 - 1, i + 1)];
      let tx = b3.x - a3.x, ty = b3.y - a3.y; const tl = Math.hypot(tx, ty) || 1;
      txs.push(tx / tl); tys.push(ty / tl);
      const s2 = pts[i].s, tt = s2 / Lt;
      const flare = s2 < 10 ? 1 + (1 - s2 / 10) * 0.9 : 1;
      let hw2 = (r.topW / 2) * flare * (1 - 0.58 * tt) * neck * (1 + 0.1 * Math.sin(s2 * 0.09 + r.wph));
      const fromTip = Lt - s2;
      if (fromTip < headSpan) {
        const u = 1 - fromTip / headSpan;
        hw2 = (hw2 * (1 - u) + hrT * u) * (1 + 0.34 * mass * Math.sin(u * Math.PI));
      }
      hws.push(Math.max(0.7, hw2));
    }
    const left: string[] = [], right: string[] = [];
    for (let i = 0; i < n2; i++) {
      left.push(`${(pts[i].x - tys[i] * hws[i]).toFixed(1)} ${(pts[i].y + txs[i] * hws[i]).toFixed(1)}`);
      right.push(`${(pts[i].x + tys[i] * hws[i]).toFixed(1)} ${(pts[i].y - txs[i] * hws[i]).toFixed(1)}`);
    }
    let d2 = 'M ' + left[0];
    if (n2 > 1) d2 += ' L ' + left.slice(1).join(' L ');
    const ti = n2 - 1, capR = hws[ti], ctx = txs[ti], cty = tys[ti], cpx = pts[ti].x, cpy = pts[ti].y;
    for (let a4 = 1; a4 <= 6; a4++) {
      const th = (a4 / 7) * Math.PI, co = Math.cos(th), si = Math.sin(th);
      d2 += ` L ${(cpx + (-cty * co + ctx * si) * capR).toFixed(1)} ${(cpy + (ctx * co + cty * si) * capR).toFixed(1)}`;
    }
    if (n2 > 1) d2 += ' L ' + right.slice(0, n2).reverse().join(' L ');
    r.el.setAttribute('d', d2 + ' Z');
  };

  // meniscus overflow bead along the bottom edge — gaussian bumps at run roots (design drawBead)
  const drawBead = () => {
    if (!beadEl) return;
    const amp = Math.max(0, Math.min(1, (f - 0.9) / 0.1));
    if (amp < 0.04 || W < 40) { beadEl.setAttribute('d', ''); return; }
    const bx0 = Math.min(H * 0.5, 30) - 3, bx1 = W - bx0, NB = 34;
    let d2 = `M ${bx0.toFixed(1)} ${H - 1.5}`;
    for (let i = 0; i <= NB; i++) {
      const x = bx0 + (i / NB) * (bx1 - bx0);
      let b = 1.3 * amp + 0.9 * amp * Math.sin(x * 0.075 + phase * 2.2);
      for (const r of runs) { const dxr = (x - r.x) / 10; b += Math.exp(-dxr * dxr) * (1.7 + Math.min(5, r.len * 0.07)) * amp; }
      d2 += ` L ${x.toFixed(1)} ${(H + Math.max(0, b)).toFixed(1)}`;
    }
    d2 += ` L ${bx1.toFixed(1)} ${H - 1.5} Z`;
    beadEl.setAttribute('d', d2);
  };

  const spawnDrop = (x: number, y: number, rr: number) => {
    const el = document.createElementNS(SVGNS, 'circle');
    el.setAttribute('fill', inkCol); el.setAttribute('r', rr.toFixed(1));
    dripG.appendChild(el);
    drops.push({ x, y, vy: 30, r: rr, el });
  };

  const tick = (now: number) => {
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016; lastT = now;
    phase += dt;
    if (anim) { let p = (now - anim.start) / anim.dur; if (p >= 1) p = 1; f = anim.from + (anim.to - anim.from) * anim.ease(p); if (p >= 1) { f = anim.to; anim = null; } }
    buildFill(); buildLabel();
    if (drainAt && now >= drainAt) { drainAt = 0; hovering = false; pendingSnapAt = now + K.DRIP_RETRACT_MS * 0.82; }
    let anyRun = false;
    for (const r of runs) {
      if (hovering && !reduced) {
        const tgt = f > 0.96 ? r.targetLen : 0;
        if (r.len < tgt) {
          const sp2 = r.grow * (1 + (r.len / K.DRIP_MAX_LEN) * 1.15);
          r.len = Math.min(tgt, r.len + sp2 * dt);
          r.holdT = 0;
        } else if (r.len > tgt) { r.len = Math.max(tgt, r.len - r.grow * 2 * dt); }
        else if (r.canRelease && !r.released) {
          r.holdT += dt;
          if (r.holdT > 0.3) {
            r.released = true;
            let tipIdx = 0;
            while (tipIdx < r.dense.length - 1 && r.dense[tipIdx + 1].s <= r.len) tipIdx++;
            const tip = r.dense[tipIdx];
            spawnDrop(tip.x, tip.y, Math.max(2, r.headR * (0.85 + 0.3 * Math.random())));
            r.len *= 0.78;
          }
        }
        r.retracting = false;
      } else {
        if (!r.retracting) { r.retracting = true; r.retractFrom = r.len; r.retractStart = now; }
        let p = (now - r.retractStart) / K.DRIP_RETRACT_MS; if (p >= 1) p = 1;
        r.len = r.retractFrom * (1 - easeOutCubic(p));
      }
      drawRun(r);
      if (r.len > 0.4) anyRun = true;
    }
    drawBead();
    for (let di = drops.length - 1; di >= 0; di--) {
      const dr = drops[di];
      dr.vy += 1350 * dt; dr.y += dr.vy * dt;
      if (dr.y > H + FALL + 24) { dr.el.remove(); drops.splice(di, 1); continue; }
      dr.el.setAttribute('cx', dr.x.toFixed(1)); dr.el.setAttribute('cy', dr.y.toFixed(1));
      anyRun = true;
    }
    if (!hovering && !anyRun && runs.length && f < 0.05) { dripG.innerHTML = ''; runs = []; drops = []; beadEl = null; }
    if (pendingSnapAt && now >= pendingSnapAt) { pendingSnapAt = 0; anim = { from: f, to: 0, start: now, dur: K.SNAP_MS, ease: easeOutBack }; }
    running = !!(anim || (hovering && !reduced) || anyRun || drainAt || pendingSnapAt);
    if (running) rafId = requestAnimationFrame(tick); else { rafId = 0; lastT = 0; }
  };
  const start = () => { if (!running) { running = true; lastT = 0; rafId = requestAnimationFrame(tick); } };
  const fill = (dur: number) => { anim = { from: f, to: 1, start: performance.now(), dur, ease: easeOutCubic }; start(); };

  const onEnter = () => { hovering = true; pendingSnapAt = 0; drainAt = 0; if (reduced) { f = 1; buildFill(); buildLabel(); } else { if (!runs.length) makeRuns(); fill(K.FILL_MS); } };
  const onLeave = () => { hovering = false; if (reduced) { f = 0; dripG.innerHTML = ''; runs = []; buildFill(); buildLabel(); } else { pendingSnapAt = performance.now() + K.DRIP_RETRACT_MS * 0.82; start(); } };
  const onTap = () => { if (reduced) return; hovering = true; if (!runs.length) makeRuns(); fill(K.FILL_MS * 0.7); drainAt = performance.now() + 900; };

  const onClick = (e: Event) => {
    if (navTarget) { e.preventDefault(); pendingSnapAt = 0; drainAt = 0; floodNavigate(navTarget, btn); }
    else if (!canHover && !btn.hasAttribute('data-submit')) onTap();
  };

  if (canHover) {
    btn.addEventListener('pointerenter', onEnter);
    btn.addEventListener('pointerleave', onLeave);
    btn.addEventListener('focus', onEnter);
    btn.addEventListener('blur', onLeave);
  }
  btn.addEventListener('click', onClick);

  buildFill(); buildLabel();
  return {
    destroy() {
      cancelAnimationFrame(rafId); ro.disconnect();
      btn.removeEventListener('pointerenter', onEnter); btn.removeEventListener('pointerleave', onLeave);
      btn.removeEventListener('focus', onEnter); btn.removeEventListener('blur', onLeave);
      btn.removeEventListener('click', onClick);
      dripG.innerHTML = ''; fillPath.setAttribute('d', '');
    },
  };
}
