// After Hours — the dark salon. ONE responsive page, ONE breakpoint-aware module:
//   < 1024px  → the mobile (phone) salon: cqw stage, stage-relative torch (ported 1:1 from the
//               approved "After Hours Phone.dc.html").
//   ≥ 1024px  → the desktop (landscape) salon: a 1512×946 stage scaled to the viewport, viewport-
//               space torch (ported 1:1 from "GoteFigure After Hours.dc.html").
// Only the active block is wired; a media-query change tears down + re-mounts the other block.
// Repo lifecycle via core (init on astro:page-load, cleanup on astro:before-swap; §7.6.6, animation.md #1).
// Reduced-motion: starts lit + static in both (§7.6.2). No-ops on any page without [data-ah-block].
import { defineModule } from './core';

// ---- Sprint 1 email capture (shared by both breakpoints) ----
// The invisible-Turnstile + honeypot capture wiring lives in the SHARED helper
// `src/lib/email-capture.ts` (extracted R2-S8 so the /about NewsletterForm reuses the
// same implementation instead of forking one). Defaults preserve this page's behavior:
// source 'after-hours', localStorage key 'gf-soon-email'.
import { wireEmailCapture } from '../lib/email-capture';

defineModule('after-hours', ({ reduced }) => {
  const cs = getComputedStyle(document.documentElement);
  const BEAM = cs.getPropertyValue('--ah-beam').trim() || '255, 214, 140';
  const NIGHT = cs.getPropertyValue('--ah-night-rgb').trim() || '12, 9, 6';

  // ---- shared author gate (single corner element, both breakpoints) ----
  // HARD GATE (Sprint 2): the code never ships in this bundle. The form POSTs to
  // /api/gate (rate-limited, constant-time compare) which sets a signed HttpOnly
  // cookie; /store itself verifies that cookie ON the Worker. localStorage below is
  // a UX hint only (skip the form when likely unlocked) — never security state.
  const STORE_PATH = '/store';
  const gateBtn = document.querySelector<HTMLElement>('[data-gate-btn]');
  const gateForm = document.querySelector<HTMLFormElement>('[data-gate-form]');
  const gateInput = document.querySelector<HTMLInputElement>('[data-gate-input]');
  const likelyUnlocked = () => { try { return localStorage.getItem('gf-store-open') === '1'; } catch { return false; } };
  const wobble = () => {
    if (!gateInput) return;
    gateInput.style.animation = 'none'; void gateInput.offsetWidth; gateInput.style.animation = 'gfahm-wob .4s ease';
  };
  const onGateBtn = () => {
    if (likelyUnlocked()) { location.href = STORE_PATH; return; } // server re-checks; bounces home if stale
    if (!gateForm) return;
    const opening = gateForm.hasAttribute('hidden');
    gateForm.toggleAttribute('hidden');
    if (opening) gateInput?.focus();
  };
  let gateBusy = false;
  const onGateSubmit = (e: Event) => {
    e.preventDefault();
    if (gateBusy) return;
    const code = gateInput?.value || '';
    if (!code) { wobble(); return; }
    gateBusy = true;
    fetch('/api/gate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then((r) => r.json() as Promise<{ ok?: boolean }>)
      .then((b) => {
        if (b.ok) {
          try { localStorage.setItem('gf-store-open', '1'); } catch { /* private mode */ }
          location.href = STORE_PATH;
        } else {
          wobble(); // wrong code and rate-limited look identical on purpose
        }
      })
      .catch(wobble)
      .finally(() => { gateBusy = false; });
  };
  gateBtn?.addEventListener('click', onGateBtn);
  gateForm?.addEventListener('submit', onGateSubmit);

  // ---- shared helpers ----
  const show = (el: HTMLElement | null, vis: boolean) => { if (el) el.style.opacity = vis ? '1' : '0'; };

  // ---- MOBILE block (main's phone salon, stage-relative torch) ----
  function mountMobile(root: HTMLElement) {
    const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s);
    const stage = q('[data-room-stage]'); if (!stage) return null;
    const dark = q('[data-dark]'), glow = q('[data-glow]');
    const cord = q<HTMLButtonElement>('[data-cord]'), cordInner = q('[data-cord-inner]'), eyes = q('[data-eyes]');
    const wm = q<HTMLImageElement>('[data-wm]'), tagline = q('[data-tagline]'), hint = q('[data-hint]');
    const BEAM_BASE = 135; // px on a 390-wide phone, scaled by stage width
    let rect = stage.getBoundingClientRect();
    const measure = () => { rect = stage.getBoundingClientRect(); };
    const beamR = () => BEAM_BASE * ((rect.width || 390) / 390);
    let lit = false, bx = rect.width / 2, by = rect.height * 0.45, tx = bx, ty = by, lastMove = 0, lastMeasure = 0, raf = 0;
    const t0 = performance.now();

    const paintBeam = () => {
      if (!dark) return;
      const R = beamR(), x = Math.round(bx), y = Math.round(by);
      dark.style.background =
        `radial-gradient(circle ${Math.round(R * 2.1)}px at ${x}px ${y}px, ` +
        `rgba(${BEAM},.09), rgba(${NIGHT},0) ${Math.round(R * 0.42)}px, ` +
        `rgba(${NIGHT},.55) ${Math.round(R)}px, rgba(${NIGHT},.987) ${Math.round(R * 1.92)}px)`;
    };
    const updateEyes = () => {
      if (!eyes) return;
      if (lit) { eyes.style.opacity = '0'; return; }
      const r = eyes.getBoundingClientRect();
      const ex = (r.left + r.width / 2) - rect.left, ey = (r.top + r.height / 2) - rect.top;
      const dist = Math.hypot(ex - bx, ey - by), R = beamR() * 1.5;
      eyes.style.opacity = String(Math.max(0, Math.min(1, (dist - R * 0.55) / (R * 0.6))));
    };
    const setLit = (on: boolean, instant: boolean) => {
      lit = on;
      if (dark) {
        dark.style.animation = 'none';
        if (on) { if (instant) dark.style.opacity = '0'; else { void dark.offsetWidth; dark.style.animation = 'gfahm-flickon .95s steps(1,end) forwards'; dark.style.opacity = '0'; } }
        else { dark.style.opacity = '1'; paintBeam(); }
      }
      if (glow) glow.style.opacity = on ? '1' : '0';
      if (on) { try { localStorage.setItem('gf-ah-found', '1'); } catch { /* private mode */ } }
      show(q('[data-h-dark]'), !on); show(q('[data-h-lit]'), on);
      show(q('[data-s-dark]'), !on); show(q('[data-s-lit]'), on);
      if (wm) wm.style.filter = on ? 'none' : 'invert(1) brightness(1.6)';
      if (tagline) tagline.style.color = on ? 'var(--ah-sub-lit)' : 'var(--ah-tagline)';
      if (hint) {
        hint.textContent = on ? 'pull the cord to close up' : 'drag your thumb · a cord hangs somewhere';
        hint.style.color = on ? 'var(--ah-sub-lit)' : 'var(--ah-hint)'; // lit hint matches the lit sub colour
        hint.style.animation = on ? 'none' : '';
      }
      if (cordInner && !instant) { cordInner.style.animation = 'none'; void cordInner.offsetWidth; cordInner.style.animation = 'gfahm-sway .9s ease 2'; }
    };
    const onMove = (e: PointerEvent | TouchEvent) => {
      const p = (e as TouchEvent).touches?.[0] || (e as PointerEvent);
      tx = p.clientX - rect.left; ty = p.clientY - rect.top; lastMove = performance.now();
    };
    const onToggle = () => { setLit(!lit, false); try { (navigator as Navigator & { vibrate?: (n: number) => void }).vibrate?.(12); } catch { /* no haptics */ } };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      if (now - lastMeasure > 500) { lastMeasure = now; measure(); }
      const W = rect.width || 390, H = rect.height || 844;
      if (now - lastMove > 4200) { const t = now - t0; tx = W * (0.5 + 0.36 * Math.sin(t * 0.00023) + 0.08 * Math.sin(t * 0.00061)); ty = H * (0.5 + 0.3 * Math.sin(t * 0.00017 + 1.7)); }
      bx += (tx - bx) * 0.11; by += (ty - by) * 0.11;
      if (!lit) paintBeam();
      updateEyes();
    };
    cord?.addEventListener('click', onToggle);
    const disposeEmail = wireEmailCapture(root);
    let found = false; try { found = localStorage.getItem('gf-ah-found') === '1'; } catch { /* private mode */ }
    const moveEvents = ['pointermove', 'pointerdown', 'touchmove', 'touchstart'] as const;
    if (reduced) { setLit(true, true); }
    else {
      if (found) setLit(true, true); else paintBeam();
      addEventListener('resize', measure, { passive: true });
      moveEvents.forEach((ev) => window.addEventListener(ev, onMove as EventListener, { passive: true }));
      raf = requestAnimationFrame(loop);
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      removeEventListener('resize', measure);
      moveEvents.forEach((ev) => window.removeEventListener(ev, onMove as EventListener));
      cord?.removeEventListener('click', onToggle);
      disposeEmail();
    };
  }

  // ---- DESKTOP block (landscape 1512×946 stage scaled to viewport, viewport-space torch) ----
  function mountDesktop(root: HTMLElement) {
    const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s);
    if (!q('[data-room-stage]')) return null;
    const dark = q('[data-dark]'), glow = q('[data-glow]');
    const cord = q<HTMLButtonElement>('[data-cord]'), cordInner = q('[data-cord-inner]'), eyes = q('[data-eyes]');
    const wm = q<HTMLImageElement>('[data-wm]'), tagline = q('[data-tagline]'), hint = q('[data-hint]');
    const BEAM = 180; // px in the 1512-space, painted in viewport coords
    let lit = false, bx = innerWidth / 2, by = innerHeight * 0.42, tx = bx, ty = by, lastMove = 0, raf = 0;
    const t0 = performance.now();
    const BEAM_RGB = cs.getPropertyValue('--ah-beam').trim() || '255, 214, 140';
    const NIGHT_RGB = cs.getPropertyValue('--ah-night-rgb').trim() || '12, 9, 6';

    const applyScale = () => {
      const s = Math.min(innerWidth / 1512, innerHeight / 946);
      (['[data-stage-back]', '[data-stage-front]'] as const).forEach((sel) => { const el = q(sel); if (el) el.style.transform = `translate(-50%,-50%) scale(${s})`; });
    };
    const paintBeam = () => {
      if (!dark) return;
      const R = BEAM, x = Math.round(bx), y = Math.round(by);
      dark.style.background =
        `radial-gradient(circle ${Math.round(R * 2.1)}px at ${x}px ${y}px, ` +
        `rgba(${BEAM_RGB},.09), rgba(${NIGHT_RGB},0) ${Math.round(R * 0.42)}px, ` +
        `rgba(${NIGHT_RGB},.55) ${R}px, rgba(${NIGHT_RGB},.987) ${Math.round(R * 1.92)}px)`;
    };
    const updateEyes = () => {
      if (!eyes) return;
      if (lit) { eyes.style.opacity = '0'; return; }
      const r = eyes.getBoundingClientRect();
      const dist = Math.hypot((r.left + r.width / 2) - bx, (r.top + r.height / 2) - by), R = BEAM * 1.5;
      eyes.style.opacity = String(Math.max(0, Math.min(1, (dist - R * 0.55) / (R * 0.6))));
    };
    const setLit = (on: boolean, instant: boolean) => {
      lit = on;
      if (dark) {
        dark.style.animation = 'none';
        if (on) { if (instant) dark.style.opacity = '0'; else { void dark.offsetWidth; dark.style.animation = 'gfahm-flickon .95s steps(1,end) forwards'; dark.style.opacity = '0'; } }
        else { dark.style.opacity = '1'; paintBeam(); }
      }
      if (glow) glow.style.opacity = on ? '1' : '0';
      if (on) { try { localStorage.setItem('gf-ah-found', '1'); } catch { /* private mode */ } }
      show(q('[data-h-dark]'), !on); show(q('[data-h-lit]'), on);
      show(q('[data-s-dark]'), !on); show(q('[data-s-lit]'), on);
      if (wm) wm.style.filter = on ? 'none' : 'invert(1) brightness(1.6)';
      if (tagline) tagline.style.color = on ? 'var(--ah-sub-lit)' : 'var(--ah-tagline)';
      if (hint) {
        hint.textContent = on ? 'pull the cord to close up' : 'somewhere, a cord is hanging · pull it';
        hint.style.color = on ? 'var(--ah-hint-lit)' : 'var(--ah-hint)';
        hint.style.animation = on ? 'none' : '';
      }
      if (cordInner && !instant) { cordInner.style.animation = 'none'; void cordInner.offsetWidth; cordInner.style.animation = 'gfahm-sway .9s ease 2'; }
    };
    const onMove = (e: PointerEvent | TouchEvent) => { const p = (e as TouchEvent).touches?.[0] || (e as PointerEvent); tx = p.clientX; ty = p.clientY; lastMove = performance.now(); };
    const onToggle = () => setLit(!lit, false);
    const onResize = () => applyScale();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      if (now - lastMove > 5200) { const t = now - t0; tx = innerWidth * (0.5 + 0.34 * Math.sin(t * 0.00021) + 0.09 * Math.sin(t * 0.00059)); ty = innerHeight * (0.44 + 0.30 * Math.sin(t * 0.00017 + 1.7)); }
      bx += (tx - bx) * 0.09; by += (ty - by) * 0.09;
      if (!lit) paintBeam();
      updateEyes();
    };
    cord?.addEventListener('click', onToggle);
    const disposeEmail = wireEmailCapture(root);
    applyScale();
    addEventListener('resize', onResize, { passive: true });
    let found = false; try { found = localStorage.getItem('gf-ah-found') === '1'; } catch { /* private mode */ }
    const moveEvents = ['pointermove', 'pointerdown', 'touchmove'] as const;
    if (reduced) { setLit(true, true); }
    else {
      if (found) setLit(true, true); else paintBeam();
      moveEvents.forEach((ev) => window.addEventListener(ev, onMove as EventListener, { passive: true }));
      raf = requestAnimationFrame(loop);
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      moveEvents.forEach((ev) => window.removeEventListener(ev, onMove as EventListener));
      cord?.removeEventListener('click', onToggle);
      disposeEmail();
    };
  }

  // ---- activate the block for the current breakpoint; re-mount on breakpoint change ----
  const mq = matchMedia('(min-width: 1024px)');
  const mount = () => {
    const root = document.querySelector<HTMLElement>(mq.matches ? '[data-ah-block="desktop"]' : '[data-ah-block="mobile"]');
    if (!root) return null;
    return mq.matches ? mountDesktop(root) : mountMobile(root);
  };
  let dispose = mount();
  const onMq = () => { dispose?.(); dispose = mount(); };
  mq.addEventListener('change', onMq);

  return () => {
    dispose?.();
    mq.removeEventListener('change', onMq);
    gateBtn?.removeEventListener('click', onGateBtn);
    gateForm?.removeEventListener('submit', onGateSubmit);
  };
});
