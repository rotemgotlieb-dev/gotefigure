// Drop-grid tile life (design _tileHover/_qaPool/_qaFx/_splatter, lines 651-750):
// hover = art swell + pink underline draw + hanging drips; quick-add = rising ink pool
// (flattens + breathes + leaks when full), burst on click with tile-wide pink splatter.
import { defineModule } from './core';
import { satchel } from '../lib/satchel';

type QA = HTMLElement & {
  __qaBurst?: boolean; __qaFullT?: ReturnType<typeof setTimeout>; __qaLeakI?: ReturnType<typeof setInterval>;
  __qaT1?: ReturnType<typeof setTimeout>; __qaT2?: ReturnType<typeof setTimeout>;
  __qaAnim?: Animation | null;
};

defineModule('tiles', ({ reduced }) => {
  const tiles = [...document.querySelectorAll<HTMLElement>('[data-tile]')];
  if (!tiles.length) return;
  const destroys: (() => void)[] = [];
  const leaks: HTMLElement[] = [];

  for (const t of tiles) {
    const u = t.querySelector<SVGPathElement>('[data-u]');
    const img = t.querySelector<HTMLElement>('[data-tart]');
    const drs = t.querySelectorAll<SVGPathElement>('[data-dr]');
    const enter = () => { if (u) u.style.strokeDashoffset = '0'; if (img) img.style.transform = 'scale(1.045)'; drs.forEach((p) => { p.style.transform = 'scaleY(1)'; }); };
    const leave = () => { if (u) u.style.strokeDashoffset = '1'; if (img) img.style.transform = 'none'; drs.forEach((p) => { p.style.transform = 'scaleY(0)'; }); };
    t.addEventListener('pointerenter', enter);
    t.addEventListener('pointerleave', leave);
    destroys.push(() => { t.removeEventListener('pointerenter', enter); t.removeEventListener('pointerleave', leave); });
  }

  const splatter = (tile: HTMLElement & { __splat?: HTMLElement | null; __splatT?: ReturnType<typeof setTimeout> }, b: HTMLElement) => {
    if (tile.__splat) { tile.__splat.remove(); clearTimeout(tile.__splatT); tile.__splat = null; }
    const tr2 = tile.getBoundingClientRect(), br = b.getBoundingClientRect();
    const bx = br.left - tr2.left + br.width / 2, by = br.top - tr2.top + br.height / 2;
    const ov = document.createElement('div');
    ov.setAttribute('aria-hidden', 'true');
    ov.style.cssText = 'position:absolute;inset:0;overflow:hidden;border-radius:inherit;pointer-events:none;z-index:6';
    let html = '';
    const N2 = 15 + Math.floor(Math.random() * 4);
    for (let i = 0; i < N2; i++) {
      const px = 6 + Math.random() * 88, py = i < 4 ? 6 + Math.random() * 48 : 4 + Math.random() * 62;
      const xpx = (px / 100) * tr2.width, ypx = (py / 100) * tr2.height;
      const dist = Math.hypot(xpx - bx, ypx - by);
      const sz = i < 4 ? 30 + Math.random() * 36 : 7 + Math.random() * 22;
      const del = Math.round(dist * 0.5 + Math.random() * 70);
      const r1 = Math.round(38 + Math.random() * 24), r2 = Math.round(38 + Math.random() * 24), r3 = Math.round(38 + Math.random() * 24), r4 = Math.round(38 + Math.random() * 24);
      html += `<span data-splat style="position:absolute;left:${px.toFixed(1)}%;top:${py.toFixed(1)}%;width:${sz.toFixed(0)}px;height:${(sz * (0.68 + Math.random() * 0.5)).toFixed(0)}px;background:#DA7285;border-radius:${r1}% ${100 - r1}% ${r2}% ${100 - r2}% / ${r3}% ${r4}% ${100 - r4}% ${100 - r3}%;transform:translate(-50%,-50%) rotate(${Math.round(Math.random() * 360)}deg) scale(0);opacity:.92;transition:transform .5s cubic-bezier(.18,.89,.32,1.2) ${del}ms;"></span>`;
    }
    ov.innerHTML = html;
    tile.appendChild(ov);
    tile.__splat = ov;
    requestAnimationFrame(() => { requestAnimationFrame(() => {
      ov.querySelectorAll<HTMLElement>('[data-splat]').forEach((sp) => { sp.style.transform = sp.style.transform.replace('scale(0)', 'scale(1)'); });
    }); });
    tile.__splatT = setTimeout(() => {
      ov.querySelectorAll<HTMLElement>('[data-splat]').forEach((sp, i) => {
        sp.style.transition = `opacity .85s ease ${i * 26}ms, transform .85s ease ${i * 26}ms`;
        sp.style.opacity = '0';
        sp.style.transform = sp.style.transform.replace('scale(1)', 'scale(.8)');
      });
      setTimeout(() => { ov.remove(); if (tile.__splat === ov) tile.__splat = null; }, 1700);
    }, 1500);
  };

  const qaPool = (b: QA, on: boolean) => {
    if (b.__qaBurst) return;
    const pool = b.querySelector<HTMLElement>('[data-qa-pool]');
    if (!pool) return;
    clearTimeout(b.__qaFullT); clearInterval(b.__qaLeakI);
    if (b.__qaAnim) { b.__qaAnim.cancel(); b.__qaAnim = null; }
    if (on) {
      pool.style.transition = 'height 5.2s cubic-bezier(.1,.62,.16,.99)';
      pool.style.height = '140%';
      b.__qaFullT = setTimeout(() => {
        if (b.__qaBurst) return;
        pool.style.transition = 'height 1.2s ease, border-radius 1.4s ease';
        pool.style.borderRadius = '26% 20% 0 0 / 12% 9% 0 0';
        try { b.__qaAnim = b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.018)' }, { transform: 'scale(1)' }], { duration: 1150, iterations: Infinity, easing: 'ease-in-out' }); } catch { /* old browser */ }
        const leak = () => {
          if (b.__qaBurst || !document.body.contains(b)) return;
          const br = b.getBoundingClientRect();
          const sp = document.createElement('span');
          const w2 = 1.8 + Math.random() * 1.4;
          const lx = br.left + br.width * (0.18 + Math.random() * 0.64);
          sp.style.cssText = `position:fixed;left:${lx.toFixed(0)}px;top:${(br.bottom - 4).toFixed(0)}px;width:${w2.toFixed(1)}px;height:4px;border-radius:40% 40% 55% 55% / 30% 30% 70% 70%;background:#DA7285;opacity:.8;pointer-events:none;z-index:10600;transition:height 1.2s cubic-bezier(.4,.2,.6,1),transform 1.2s cubic-bezier(.5,.1,.7,.6),opacity .5s ease .9s`;
          document.body.appendChild(sp);
          leaks.push(sp);
          requestAnimationFrame(() => {
            sp.style.height = (8 + Math.random() * 8).toFixed(0) + 'px';
            sp.style.transform = `translateY(${(7 + Math.random() * 10).toFixed(0)}px)`;
            sp.style.opacity = '0';
          });
          setTimeout(() => sp.remove(), 1500);
        };
        leak();
        b.__qaLeakI = setInterval(leak, 950);
      }, 5250);
    } else {
      pool.style.transition = 'height .45s ease';
      pool.style.height = '0px';
      pool.style.borderRadius = '55% 45% 0 0 / 100% 85% 0 0';
    }
  };

  const qaFx = (b: QA) => {
    const pool = b.querySelector<HTMLElement>('[data-qa-pool]');
    const lbl = b.querySelector<HTMLElement & { __orig?: string }>('[data-qa-lbl]');
    clearTimeout(b.__qaT1); clearTimeout(b.__qaT2);
    clearTimeout(b.__qaFullT); clearInterval(b.__qaLeakI);
    if (b.__qaAnim) { b.__qaAnim.cancel(); b.__qaAnim = null; }
    b.__qaBurst = true;
    if (pool) { pool.style.transition = 'height .3s cubic-bezier(.2,.9,.25,1)'; pool.style.height = '130%'; }
    b.style.transform = 'scale(.93)';
    if (lbl) { if (!lbl.__orig) lbl.__orig = lbl.textContent || ''; lbl.textContent = 'in the bag ✓'; }
    const tile = b.closest<HTMLElement>('[data-tile]');
    if (tile && !reduced) splatter(tile, b);
    b.__qaT1 = setTimeout(() => { b.style.transform = ''; }, 190);
    b.__qaT2 = setTimeout(() => {
      b.__qaBurst = false;
      if (pool) { pool.style.transition = 'height .55s ease'; pool.style.height = '0px'; pool.style.borderRadius = '55% 45% 0 0 / 100% 85% 0 0'; }
      if (lbl && lbl.__orig) lbl.textContent = lbl.__orig;
      if (b.matches(':hover')) setTimeout(() => qaPool(b, true), 500);
    }, 1050);
  };

  const qas = [...document.querySelectorAll<QA>('[data-quickadd]')];
  for (const b of qas) {
    const onClick = (e: Event) => {
      e.stopPropagation(); e.preventDefault();
      qaFx(b);
      satchel.add(b.getAttribute('data-quickadd')!);
      satchel.open();
    };
    const onEnter = () => { if (!reduced) qaPool(b, true); };
    const onLeave = () => { if (!reduced) qaPool(b, false); };
    b.addEventListener('click', onClick);
    b.addEventListener('pointerenter', onEnter);
    b.addEventListener('pointerleave', onLeave);
    destroys.push(() => {
      b.removeEventListener('click', onClick);
      b.removeEventListener('pointerenter', onEnter);
      b.removeEventListener('pointerleave', onLeave);
      clearTimeout(b.__qaFullT); clearInterval(b.__qaLeakI); clearTimeout(b.__qaT1); clearTimeout(b.__qaT2);
      if (b.__qaAnim) b.__qaAnim.cancel();
    });
  }

  return () => { destroys.forEach((d) => d()); leaks.forEach((el) => el.remove()); };
});
