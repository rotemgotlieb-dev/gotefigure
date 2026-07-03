// The scroll-drawn brush stroke (design _buildLine/_startLineRaf, lines 958-1366) — a single
// continuous variable-width ink ribbon over the home page: leaves the header logo, writes
// "Gote" (clip-reveal of gote.png) beside the shop heading, underlines it, climbs past the
// filter chips, weaves between [data-la] anchors with alternating bows, INVERTS color across
// the dark vault band ([data-doodle-ink]), rings the Rotem portrait 1.22 turns, and lands on
// the vault button with an ink splash. Splats pop at [data-la-splat]; passive drips grow off
// the line. Head eases toward the scroll target; RAF self-parks. Reduced motion: no line.
import { defineModule } from './core';

const SVGNS = 'http://www.w3.org/2000/svg';
const STEP = 7;

type Splat = { len: number; el: SVGGElement; tr: string; on: boolean };
type Drip = { s: number; x: number; y: number; el: SVGPathElement; len: number; drawn: number; maxLen: number; rate: number };
type VaultSplash = { el: SVGGElement; parts: { el: SVGElement; tr: string; rst: string }[]; on: boolean };
type L = {
  total: number; N: number; P: number[][]; LF: string[]; RF: string[];
  SL: string[]; SR: string[]; SL2: string[]; SR2: string[]; HW: number[]; CI: number[];
  word: { lenA: number; lenB: number; lenC: number; w: number; mids: number[][] } | null;
  vaultSplash: VaultSplash | null;
  segs: { a: number; b: number; c: number }[];
  Y: number[]; lens: number[];
  ribbon: SVGPathElement; ribbon2: SVGPathElement | null;
  streak: SVGPathElement | null; streak2: SVGPathElement | null; streak3: SVGPathElement | null;
  splats: Splat[]; drips: Drip[];
};

defineModule('scroll-line', ({ reduced }) => {
  if (reduced) return;
  const main = document.querySelector<HTMLElement>('[data-home-main]');
  if (!main || !document.getElementById('gf-line')) return;

  let L: L | null = null;
  let lineHead = 0, lineTs = 0, lineDirty = true, lineRaf = 0;
  let vaultFadeT: ReturnType<typeof setTimeout> | undefined;
  let lrT: ReturnType<typeof setTimeout> | undefined;
  let fontsKicked = false, dead = false;

  const blobD = (r: number) => {
    const nB = 9, bp: number[][] = [];
    for (let q = 0; q <= nB; q++) { const a = (q / nB) * Math.PI * 2; const rr = r * (0.72 + Math.random() * 0.5); bp.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    bp[nB] = bp[0].slice();
    let bd = `M ${bp[0][0].toFixed(1)} ${bp[0][1].toFixed(1)}`;
    for (let q = 1; q < nB; q++) { const mx = (bp[q][0] + bp[q + 1][0]) / 2, my = (bp[q][1] + bp[q + 1][1]) / 2; bd += ` Q ${bp[q][0].toFixed(1)} ${bp[q][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`; }
    return bd + ' Z';
  };

  function buildLine() {
    if (dead) return;
    const svg = document.getElementById('gf-line') as SVGSVGElement | null;
    const guide = document.getElementById('gf-line-guide') as SVGPathElement | null;
    const ribbon = document.getElementById('gf-line-ribbon') as SVGPathElement | null;
    const ribbon2 = document.getElementById('gf-line-ribbon2') as SVGPathElement | null;
    const streak = document.getElementById('gf-line-streak') as SVGPathElement | null;
    const streak2 = document.getElementById('gf-line-streak2') as SVGPathElement | null;
    const streak3 = document.getElementById('gf-line-streak3') as SVGPathElement | null;
    const splatsG = document.getElementById('gf-splats') as SVGGElement | null;
    const dripsG = document.getElementById('gf-inkdrips') as SVGGElement | null;
    if (!main || !svg || !guide || !ribbon || !splatsG || !dripsG) { L = null; return; }
    const mr = main.getBoundingClientRect();
    const W = Math.round(mr.width), H = Math.round(mr.height);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.width = W + 'px'; svg.style.height = H + 'px';
    const laSvg = document.getElementById('gf-liveart');
    if (laSvg) { laSvg.setAttribute('viewBox', `0 0 ${W} ${H}`); (laSvg as unknown as SVGSVGElement).style.width = W + 'px'; (laSvg as unknown as SVGSVGElement).style.height = H + 'px'; }

    const els = [...main.querySelectorAll<HTMLElement>('[data-la]')].sort((a, b) => (+a.getAttribute('data-la')!) - (+b.getAttribute('data-la')!));
    if (els.length < 2) { L = null; ribbon.setAttribute('d', ''); if (ribbon2) ribbon2.setAttribute('d', ''); return; }
    const pts = els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.left - mr.left + 1, y: r.top - mr.top + 1, ring: el.hasAttribute('data-la-ring'), splat: el.hasAttribute('data-la-splat') }; });

    let bandTop = -9e9, bandBot = -9e9;
    const bandEl = main.querySelector<HTMLElement>('[data-doodle-ink]');
    if (bandEl) {
      const br2 = bandEl.getBoundingClientRect();
      bandTop = br2.top - mr.top; bandBot = br2.bottom - mr.top;
      const vlg = document.getElementById('gf-vault-line-g');
      if (vlg) { vlg.setAttribute('transform', `translate(${(-(br2.left - mr.left)).toFixed(1)},${(-(br2.top - mr.top)).toFixed(1)})`); (vlg as unknown as SVGGElement).style.transition = 'opacity .55s ease .12s'; }
    }

    // ---- opening: leave the logo, write "Gote", underline, climb past the chips
    const heroSec = main.querySelector('section');
    const hrc = heroSec ? heroSec.getBoundingClientRect() : null;
    const heroTop = hrc ? hrc.top - mr.top : 0, heroH = hrc ? hrc.height : innerHeight;
    let word: L['word'] = null;
    const logoBtn = document.querySelector('header .logo');
    let x0 = W * 0.06;
    if (logoBtn) { const lb = logoBtn.getBoundingClientRect(); x0 = Math.max(30, lb.left - mr.left + lb.width * 0.4); }
    const y0 = 4;
    let d = `M ${x0.toFixed(1)} ${y0.toFixed(1)}`;
    const ck: { y: number; len: number }[] = [{ y: 0, len: 0 }];
    const lens: number[] = []; let side = -1;
    let from = { x: x0, y: y0 };

    const wt = document.getElementById('gf-word');
    if (wt) {
      const shopSec = main.querySelector('[data-sec="shop"]');
      const h2El = shopSec ? shopSec.querySelector('h2') : null;
      const chipsEl = h2El ? h2El.parentElement!.lastElementChild : null;
      let wWidth = 142, wx0: number, wBase: number, wH: number;
      if (h2El && chipsEl && chipsEl !== h2El) {
        const hr2 = h2El.getBoundingClientRect(), cr3 = chipsEl.getBoundingClientRect();
        const gl = hr2.right - mr.left, gr = cr3.left - mr.left;
        wWidth = Math.max(92, Math.min(118, gr - gl - 120));
        wH = wWidth / 1.331;
        wx0 = (gl + gr) / 2 - wWidth / 2;
        wBase = hr2.bottom - mr.top - 6;
      } else {
        wH = wWidth / 1.331;
        wx0 = W / 2 - wWidth / 2;
        wBase = heroTop + heroH + 120;
      }
      const wTop = wBase - wH * 0.9;
      wt.setAttribute('x', wx0.toFixed(1)); wt.setAttribute('y', wTop.toFixed(1));
      wt.setAttribute('width', wWidth.toFixed(1)); wt.setAttribute('height', wH.toFixed(1));
      const wcr = document.getElementById('gf-word-cliprect');
      if (wcr) { wcr.setAttribute('x', (wx0 - 12).toFixed(1)); wcr.setAttribute('y', (wTop - 12).toFixed(1)); wcr.setAttribute('height', (wH + 24).toFixed(1)); wcr.setAttribute('width', '0'); }
      let droopY = wBase + 60, h2cx = Math.max(140, wx0 - 300), chTop = wTop - 20, chRight = wx0 + wWidth + 200;
      let gridTopY = wBase + 120;
      if (h2El && chipsEl) {
        const hb2 = h2El.getBoundingClientRect(), cb3 = chipsEl.getBoundingClientRect();
        droopY = hb2.bottom - mr.top + 8;
        h2cx = hb2.right - mr.left - 26;
        chTop = cb3.top - mr.top;
        chRight = cb3.right - mr.left;
      }
      const shopTile0 = shopSec ? shopSec.querySelector('[data-tile]') : null;
      if (shopTile0) gridTopY = shopTile0.getBoundingClientRect().top - mr.top;
      let h2L = h2cx - 240;
      if (h2El) h2L = h2El.getBoundingClientRect().left - mr.left;
      const dropX = Math.max(22, h2L - 58);
      d += ` C ${(x0 - 115).toFixed(1)} ${(droopY * 0.48).toFixed(1)} ${Math.max(6, h2L - 170).toFixed(1)} ${(droopY - 120).toFixed(1)} ${dropX.toFixed(1)} ${(droopY - 18).toFixed(1)}`;
      d += ` C ${(dropX + 36).toFixed(1)} ${(droopY + 4).toFixed(1)} ${(h2cx - 150).toFixed(1)} ${(droopY + 9).toFixed(1)} ${h2cx.toFixed(1)} ${droopY.toFixed(1)}`;
      d += ` C ${(h2cx + 130).toFixed(1)} ${(droopY + 6).toFixed(1)} ${(wx0 - 110).toFixed(1)} ${(wBase + 34).toFixed(1)} ${(wx0 - 16).toFixed(1)} ${(wBase + 15).toFixed(1)}`;
      guide.setAttribute('d', d);
      const lenA = guide.getTotalLength();
      d += ` C ${(wx0 + wWidth * 0.3).toFixed(1)} ${(wBase + 21).toFixed(1)} ${(wx0 + wWidth * 0.7).toFixed(1)} ${(wBase + 15).toFixed(1)} ${(wx0 + wWidth + 30).toFixed(1)} ${(wBase + 9).toFixed(1)}`;
      guide.setAttribute('d', d);
      const lenB = guide.getTotalLength();
      const wallX = W - 34, wallY = chTop - 48;
      d += ` C ${(wx0 + wWidth + 170).toFixed(1)} ${(wBase - 40).toFixed(1)} ${(chRight - (chRight - wx0 - wWidth) * 0.42).toFixed(1)} ${(chTop - 36).toFixed(1)} ${(wallX - 52).toFixed(1)} ${wallY.toFixed(1)}`;
      guide.setAttribute('d', d);
      const lenC = guide.getTotalLength();
      word = { lenA, lenB, lenC, w: wWidth, mids: [[wallX, wallY + 84], [W - 74, gridTopY + 130], [wx0 + wWidth * 0.4, gridTopY + 205]] };
      ck.push({ y: Math.max(wTop - 40, innerHeight * 0.74), len: lenA });
      ck.push({ y: Math.max(wBase + 40, innerHeight * 1.0), len: lenB });
      ck.push({ y: Math.max(wBase + 90, innerHeight * 1.12), len: lenC });
      from = { x: wallX, y: wallY };
    }

    // ---- weave through the anchors
    const route: { x: number; y: number; mid?: number }[] = [{ x: from.x, y: from.y }];
    if (word && word.mids) for (const m of word.mids) route.push({ x: m[0], y: m[1], mid: 1 });
    for (let i = 0; i < pts.length; i++) {
      const A = route[route.length - 1], B = pts[i];
      const dx = B.x - A.x, dyR = B.y - A.y, segL = Math.hypot(dx, dyR) || 1;
      if (!(i === 0 && word)) {
        const bow = Math.min(220, Math.max(90, segL * 0.26)) * side;
        let mbx = (A.x + B.x) / 2 - (dyR / segL) * bow, mby = (A.y + B.y) / 2 + (dx / segL) * bow;
        if (mby < Math.min(A.y, B.y) - 24) { mbx = (A.x + B.x) / 2 + (dyR / segL) * bow; mby = (A.y + B.y) / 2 - (dx / segL) * bow; }
        route.push({ x: mbx, y: mby, mid: 1 });
      }
      route.push({ x: B.x, y: B.y });
      side = -side;
    }
    for (let r = 0; r < route.length - 1; r++) {
      const p0 = route[Math.max(0, r - 1)], p1 = route[r], p2 = route[r + 1], p3 = route[Math.min(route.length - 1, r + 2)];
      d += ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      if (!p2.mid) {
        guide.setAttribute('d', d);
        const gl = guide.getTotalLength();
        lens.push(gl); ck.push({ y: p2.y, len: gl });
        from = { x: p2.x, y: p2.y };
      }
    }

    // ---- ring the portrait
    if (pts.length && pts[pts.length - 1].ring) {
      const host = document.getElementById('rotem-portrait');
      if (host) {
        guide.setAttribute('d', d);
        const hb = host.getBoundingClientRect();
        const rcx = hb.left - mr.left + hb.width / 2, rcy = hb.top - mr.top + hb.height / 2;
        const RR = Math.max(hb.width, hb.height) / 2 + 30;
        const ra0 = Math.atan2(from.y - rcy, from.x - rcx);
        const nR = 24, swp = Math.PI * 2 * 1.22, rp: number[][] = [];
        for (let q = 0; q <= nR; q++) {
          const a = ra0 + (q / nR) * swp;
          const wob = 1 + Math.sin(a * 2.6 + 1.2) * 0.045 + (q / nR) * 0.06;
          rp.push([rcx + Math.cos(a) * RR * wob, rcy + Math.sin(a) * RR * wob * 0.965]);
        }
        for (let q = 0; q < rp.length - 1; q++) { const mx = (rp[q][0] + rp[q + 1][0]) / 2, my = (rp[q][1] + rp[q + 1][1]) / 2; d += ` Q ${rp[q][0].toFixed(1)} ${rp[q][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`; }
        guide.setAttribute('d', d);
        const rl = rp[rp.length - 1];
        d += ` C ${(rl[0] + 26).toFixed(1)} ${(rl[1] + 44).toFixed(1)} ${(rl[0] + 16).toFixed(1)} ${(rl[1] + 96).toFixed(1)} ${(rl[0] - 12).toFixed(1)} ${(rl[1] + 128).toFixed(1)}`;
        guide.setAttribute('d', d);
        from = { x: rl[0] - 12, y: rl[1] + 128 };
        ck.push({ y: rcy + RR + 60, len: guide.getTotalLength() });
      }
    }

    // ---- land on the vault button
    const vBtn = main.querySelector<HTMLElement>('[data-nav="/vault/"]');
    if (vBtn) {
      const vb = vBtn.getBoundingClientRect();
      const vbx = vb.left - mr.left + vb.width / 2, vby = vb.top - mr.top + vb.height / 2;
      d += ` C ${(from.x - 46).toFixed(1)} ${(from.y + 64).toFixed(1)} ${(vbx + 120).toFixed(1)} ${(vby - 150).toFixed(1)} ${vbx.toFixed(1)} ${vby.toFixed(1)}`;
      guide.setAttribute('d', d);
      ck.push({ y: vby - 110, len: guide.getTotalLength() });
    }

    // ---- sample the guide into a variable-width jittered ribbon + dry-brush streaks
    const total = guide.getTotalLength();
    const N = Math.max(2, Math.floor(total / STEP));
    const P: number[][] = [], LF: string[] = [], RF: string[] = [], SL: string[] = [], SR: string[] = [], SL2: string[] = [], SR2: string[] = [], HW: number[] = [], CI: number[] = [];
    for (let i = 0; i <= N; i++) { const p = guide.getPointAtLength(Math.min(total, i * STEP)); P.push([p.x, p.y]); }
    const sm3 = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
    for (let i = 0; i <= N; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(N, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const s = i * STEP;
      let hw = 4.4 + 4.4 * (0.5 + 0.5 * Math.sin(s * 0.006 + 1.7)) + 2.4 * (0.5 + 0.5 * Math.sin(s * 0.019 + 0.4));
      hw *= Math.min(1, 0.2 + s / 110);
      const zoneF = (za: number, zb: number, mf: number, ramp: number) => {
        if (s < za - ramp || s > zb + ramp) return 1;
        if (s < za) return 1 - (1 - mf) * sm3((s - (za - ramp)) / ramp);
        if (s > zb) return mf + (1 - mf) * sm3((s - zb) / ramp);
        return mf;
      };
      if (word) {
        hw *= zoneF(-1e8, (word.lenC || word.lenB) + 80, 0.72, 260);
        hw *= zoneF(word.lenA - 10, word.lenB + 16, 0.66, 130);
      }
      HW.push(hw);
      const jl = Math.max(0.7, hw + (Math.random() - 0.5) * 1.3), jr = Math.max(0.7, hw + (Math.random() - 0.5) * 1.3);
      LF.push(`${(P[i][0] - ty * jl).toFixed(1)} ${(P[i][1] + tx * jl).toFixed(1)}`);
      RF.push(`${(P[i][0] + ty * jr).toFixed(1)} ${(P[i][1] - tx * jr).toFixed(1)}`);
      const off = hw * 0.5, w2 = Math.max(0.05, (hw - 4.6) * 0.22);
      SL.push(`${(P[i][0] - ty * (off - w2)).toFixed(1)} ${(P[i][1] + tx * (off - w2)).toFixed(1)}`);
      SR.push(`${(P[i][0] - ty * (off + w2)).toFixed(1)} ${(P[i][1] + tx * (off + w2)).toFixed(1)}`);
      const of2 = -hw * 0.36, wb = Math.max(0.04, (hw - 5.4) * 0.24);
      SL2.push(`${(P[i][0] - ty * (of2 - wb)).toFixed(1)} ${(P[i][1] + tx * (of2 - wb)).toFixed(1)}`);
      SR2.push(`${(P[i][0] - ty * (of2 + wb)).toFixed(1)} ${(P[i][1] + tx * (of2 + wb)).toFixed(1)}`);
      CI.push(P[i][1] >= bandTop && P[i][1] <= bandBot ? 1 : 0);
    }
    const segs: { a: number; b: number; c: number }[] = []; let sa = 0;
    for (let i = 1; i <= N; i++) { if (CI[i] !== CI[sa]) { segs.push({ a: sa, b: i - 1, c: CI[sa] }); sa = i; } }
    segs.push({ a: sa, b: N, c: CI[sa] });

    // ---- splats + passive drips
    splatsG.innerHTML = ''; dripsG.innerHTML = '';
    const splats: Splat[] = [], drips: Drip[] = [];
    const colAt = (idx: number) => (CI[Math.max(0, Math.min(N, idx))] ? '#F7F5F0' : '#16130F');
    const addDrip = (s: number, ox: number) => {
      const idx = Math.max(0, Math.min(N, Math.round(s / STEP)));
      if (CI[idx]) return;
      const el = document.createElementNS(SVGNS, 'path'); el.setAttribute('fill', colAt(idx)); dripsG.appendChild(el);
      drips.push({ s, x: P[idx][0] + (ox || 0), y: P[idx][1], el, len: 0, drawn: -1, maxLen: 46 + Math.random() * 96, rate: 5 + Math.random() * 9 });
    };
    for (let i = 1; i < pts.length; i++) {
      if (!pts[i].splat) continue;
      const idx = Math.round(lens[i] / STEP);
      const col = colAt(idx);
      const g = document.createElementNS(SVGNS, 'g');
      const axis = Math.random() * Math.PI * 2;
      let inner = `<path d="${blobD(6.5 + Math.random() * 3.5)}" fill="${col}"></path>`;
      const nB = 6 + Math.floor(Math.random() * 4);
      for (let k2 = 0; k2 < nB; k2++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = (10 + Math.random() * 26) * (1 + 0.5 * Math.cos(ang - axis));
        const ex = (Math.cos(ang) * dist).toFixed(1), ey = (Math.sin(ang) * dist).toFixed(1);
        if (Math.random() < 0.55) { const rr2 = (1.1 + Math.random() * 1.9).toFixed(1); inner += `<circle cx="${ex}" cy="${ey}" r="${rr2}" fill="${col}"></circle>`; }
        else { const rx = 1.8 + Math.random() * 2.8, ry = rx * (0.36 + Math.random() * 0.3); inner += `<ellipse cx="${ex}" cy="${ey}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" transform="rotate(${Math.round(ang * 57.3)} ${ex} ${ey})" fill="${col}"></ellipse>`; }
      }
      g.innerHTML = inner;
      const tr = `translate(${pts[i].x.toFixed(1)}px,${pts[i].y.toFixed(1)}px)`;
      g.style.transform = tr + ' scale(0)';
      g.style.transition = 'transform .34s cubic-bezier(.2,1.55,.4,1)';
      splatsG.appendChild(g);
      splats.push({ len: lens[i], el: g, tr, on: false });
      addDrip(lens[i] - 2, -9 + Math.random() * 4);
      addDrip(lens[i] - 2, 7 + Math.random() * 4);
    }

    // ---- vault-button splash
    let vaultSplash: VaultSplash | null = null;
    const vg = document.getElementById('gf-vault-splash-g') as SVGGElement | null;
    if (vBtn && vg) {
      const sec5 = vBtn.closest('section')!;
      const sr5 = sec5.getBoundingClientRect();
      const vb2 = vBtn.getBoundingClientRect();
      const sx = vb2.left - sr5.left + vb2.width / 2, sy = vb2.top - sr5.top + vb2.height / 2;
      vg.innerHTML = '';
      vg.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`;
      vg.style.transition = 'opacity .6s ease';
      vg.style.opacity = '1';
      const parts: VaultSplash['parts'] = [];
      const core = document.createElementNS(SVGNS, 'path');
      core.setAttribute('d', blobD(22 + Math.random() * 6));
      core.setAttribute('fill', '#F7F5F0');
      core.style.transform = 'scale(0)';
      core.style.transition = 'transform .42s cubic-bezier(.2,1.7,.4,1)';
      vg.appendChild(core);
      parts.push({ el: core, tr: `scale(1) rotate(${Math.round(Math.random() * 40 - 20)}deg)`, rst: 'scale(0)' });
      const nV = 16;
      for (let k3 = 0; k3 < nV; k3++) {
        const ang = (k3 / nV) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 36 + Math.random() * 116;
        const dxV = Math.cos(ang) * dist, dyV = Math.sin(ang) * dist * 0.62;
        const g2 = document.createElementNS(SVGNS, 'g');
        let shp: SVGElement;
        if (Math.random() < 0.45) {
          shp = document.createElementNS(SVGNS, 'circle');
          shp.setAttribute('r', (1.5 + Math.random() * 2.9).toFixed(1));
        } else {
          shp = document.createElementNS(SVGNS, 'ellipse');
          const rx = 3 + Math.random() * 5.5;
          shp.setAttribute('rx', rx.toFixed(1));
          shp.setAttribute('ry', (rx * (0.3 + Math.random() * 0.25)).toFixed(1));
          shp.setAttribute('transform', `rotate(${Math.round(Math.atan2(dyV, dxV) * 57.3)})`);
        }
        shp.setAttribute('fill', '#F7F5F0');
        g2.appendChild(shp);
        g2.style.transform = 'translate(0px,0px) scale(0)';
        g2.style.transition = `transform .5s cubic-bezier(.16,1.4,.3,1) ${Math.round(k3 * 14 + Math.random() * 40)}ms`;
        vg.appendChild(g2);
        parts.push({ el: g2, tr: `translate(${dxV.toFixed(1)}px,${dyV.toFixed(1)}px) scale(1)`, rst: 'translate(0px,0px) scale(0)' });
      }
      for (let k4 = 0; k4 < 8; k4++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 125 + Math.random() * 95;
        const g3 = document.createElementNS(SVGNS, 'g');
        const c3 = document.createElementNS(SVGNS, 'circle');
        c3.setAttribute('r', (0.8 + Math.random() * 1.5).toFixed(1));
        c3.setAttribute('fill', '#F7F5F0');
        g3.appendChild(c3);
        g3.style.transform = 'translate(0px,0px) scale(0)';
        g3.style.transition = `transform .62s cubic-bezier(.16,1.2,.3,1) ${Math.round(90 + Math.random() * 130)}ms`;
        vg.appendChild(g3);
        parts.push({ el: g3, tr: `translate(${(Math.cos(ang) * dist).toFixed(1)}px,${(Math.sin(ang) * dist * 0.55).toFixed(1)}px) scale(1)`, rst: 'translate(0px,0px) scale(0)' });
      }
      vaultSplash = { el: vg, parts, on: false };
    }
    for (let s = 320 + Math.random() * 200; s < total - 120; s += 400 + Math.random() * 320) addDrip(s, 0);

    const mTop = mr.top + scrollY;
    for (let i = 1; i < ck.length; i++) ck[i].y = Math.max(ck[i].y, ck[i - 1].y + 2);
    const Y = ck.map((c) => c.y + mTop);
    Y.push(Y[Y.length - 1] + 300);
    const ckLens = ck.map((c) => c.len); ckLens.push(total);
    L = { total, N, P, LF, RF, SL, SR, SL2, SR2, HW, CI, word, vaultSplash, segs, Y, lens: ckLens, ribbon, ribbon2, streak, streak2, streak3, splats, drips };
    lineHead = Math.min(lineHead, total);
    lineTs = 0; lineDirty = true;
    if (document.fonts && !fontsKicked) { fontsKicked = true; document.fonts.ready.then(() => buildLine()); }
    startRaf();
  }

  function startRaf() {
    if (lineRaf || dead) return;
    const step = (ts: number) => {
      lineRaf = 0;
      if (dead || !L || !L.ribbon.isConnected) return;
      const dt = lineTs ? Math.min(0.06, (ts - lineTs) / 1000) : 0.016;
      lineTs = ts;
      const focus = scrollY < 6 ? -1e9 : scrollY + innerHeight * 0.68;
      const Y = L.Y, LN = L.lens;
      let target = 0;
      if (focus <= Y[0]) target = 0;
      else if (focus >= Y[Y.length - 1]) target = L.total;
      else { for (let i = 1; i < Y.length; i++) { if (focus < Y[i]) { target = LN[i - 1] + ((focus - Y[i - 1]) / (Y[i] - Y[i - 1])) * (LN[i] - LN[i - 1]); break; } } }
      const cur = lineHead;
      const head = Math.abs(target - cur) < 0.5 ? target : cur + (target - cur) * 0.16;
      lineHead = head;
      const k = Math.max(0, Math.min(L.N, Math.floor(head / STEP)));
      let dInk = '', dCream = '', sInk = '', sCream = '', s3 = '';
      if (k >= 2) {
        for (const sg of L.segs) {
          if (sg.a > k) break;
          const a0 = Math.max(0, sg.a - 2), hi = Math.min(sg.b + 2, k);
          if (hi - a0 < 2) continue;
          let sub = 'M ' + L.LF[a0] + ' L ' + L.LF.slice(a0 + 1, hi + 1).join(' L ');
          const cr = ((L.HW && L.HW[hi]) || 3.2).toFixed(1); sub += ` A ${cr} ${cr} 0 0 1 ` + L.RF[hi];
          sub += ' L ' + L.RF.slice(a0, hi).reverse().join(' L ') + ' Z ';
          let st = 'M ' + L.SL[a0] + ' L ' + L.SL.slice(a0 + 1, hi + 1).join(' L ');
          st += ' L ' + L.SR.slice(a0, hi + 1).reverse().join(' L ') + ' Z ';
          let st2 = 'M ' + L.SL2[a0] + ' L ' + L.SL2.slice(a0 + 1, hi + 1).join(' L ');
          st2 += ' L ' + L.SR2.slice(a0, hi + 1).reverse().join(' L ') + ' Z ';
          if (sg.c) { dCream += sub; s3 += st; } else { dInk += sub; sInk += st; sCream += st2; }
        }
      }
      L.ribbon.setAttribute('d', dInk);
      if (L.ribbon2) L.ribbon2.setAttribute('d', dCream);
      if (L.streak) L.streak.setAttribute('d', sInk);
      if (L.streak2) L.streak2.setAttribute('d', sCream);
      if (L.streak3) L.streak3.setAttribute('d', s3);
      for (const sp of L.splats) {
        const on = head >= sp.len - 2;
        if (on !== sp.on) { sp.on = on; sp.el.style.transform = sp.tr + ` scale(${on ? 1 : 0})`; }
      }
      if (L.word) {
        const wt2 = document.getElementById('gf-word'), wcr2 = document.getElementById('gf-word-cliprect');
        if (wt2 && wcr2) {
          const tw = Math.max(0, Math.min(1, (head - L.word.lenA) / Math.max(1, L.word.lenB - L.word.lenA)));
          const LB = [0, 0.40, 0.58, 0.78, 1];
          const qL = Math.min(3, Math.floor(tw * 4)), fL = tw * 4 - qL;
          const ssL = fL * fL * (3 - 2 * fL);
          const twS = LB[qL] + (LB[qL + 1] - LB[qL]) * ssL;
          wt2.setAttribute('opacity', tw > 0.01 ? '1' : '0');
          wcr2.setAttribute('width', ((L.word.w + 48) * twS).toFixed(1));
        }
      }
      if (L.vaultSplash) {
        const onV = head >= L.total - 6;
        if (onV !== L.vaultSplash.on) {
          const vs = L.vaultSplash;
          vs.on = onV;
          clearTimeout(vaultFadeT);
          const vlg2 = document.getElementById('gf-vault-line-g') as SVGGElement | null;
          if (vlg2) vlg2.style.opacity = onV ? '0' : '1';
          if (onV) {
            vs.el.style.opacity = '1';
            for (const p of vs.parts) p.el.style.transform = p.tr;
            vaultFadeT = setTimeout(() => { vs.el.style.opacity = '0'; }, 1300);
          } else {
            vs.el.style.opacity = '0';
            vaultFadeT = setTimeout(() => { for (const p of vs.parts) p.el.style.transform = p.rst; }, 320);
          }
        }
      }
      let dripBusy = false;
      for (const dr of L.drips) {
        const active = head >= dr.s + 4;
        if (active && dr.len < dr.maxLen) { dr.len = Math.min(dr.maxLen, dr.len + dr.rate * dt); dripBusy = true; }
        else if (!active && dr.len > 0) { dr.len = Math.max(0, dr.len - 300 * dt); dripBusy = true; }
        if (Math.abs(dr.len - dr.drawn) > 0.35) {
          dr.drawn = dr.len;
          if (dr.len < 1.2) dr.el.setAttribute('d', '');
          else {
            const x = dr.x, y0 = dr.y, tip = y0 + dr.len, hw = 2.9, hr = 2.6;
            const xl = (x - hw).toFixed(1), xr = (x + hw).toFixed(1), il = (x - hr).toFixed(1), ir = (x + hr).toFixed(1);
            const my = (y0 + dr.len * 0.45).toFixed(1), py = (tip - hr * 1.5).toFixed(1), ty = tip.toFixed(1), by = y0.toFixed(1);
            dr.el.setAttribute('d', `M ${xl} ${by} C ${xl} ${my} ${il} ${py} ${il} ${ty} A ${hr} ${hr} 0 0 0 ${ir} ${ty} C ${ir} ${py} ${xr} ${my} ${xr} ${by} Z`);
          }
        }
      }
      if (head !== target || dripBusy || lineDirty) { lineDirty = false; lineRaf = requestAnimationFrame(step); }
      else lineTs = 0;
    };
    lineRaf = requestAnimationFrame(step);
  }

  const onScroll = () => { lineDirty = true; startRaf(); };
  addEventListener('scroll', onScroll, { passive: true });
  const ro = new ResizeObserver(() => { clearTimeout(lrT); lrT = setTimeout(() => buildLine(), 120); });
  ro.observe(main);
  buildLine();

  return () => {
    dead = true;
    removeEventListener('scroll', onScroll);
    ro.disconnect();
    clearTimeout(lrT); clearTimeout(vaultFadeT);
    cancelAnimationFrame(lineRaf); lineRaf = 0;
    L = null;
  };
});
