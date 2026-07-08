// After Hours (mobile) — the dark-salon torch + light-switch experience.
// Ported 1:1 from the approved Claude Design artifact (DCLogic). Repo lifecycle: init on
// astro:page-load, destroy on astro:before-swap (§7.6.6, animation.md #1). No-ops on any
// page without [data-room-stage]. Reduced-motion: starts lit + fully static (§7.6.2).
import { defineModule } from './core';

defineModule('after-hours', ({ reduced }) => {
  const stage = document.querySelector<HTMLElement>('[data-room-stage]');
  if (!stage) return; // not the After Hours page

  const q = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s);
  const dark = q('[data-dark]');
  const glow = q('[data-glow]');
  const cord = q<HTMLButtonElement>('[data-cord]');
  const cordInner = q('[data-cord-inner]');
  const eyes = q('[data-eyes]');
  const wm = q<HTMLImageElement>('[data-wm]');
  const tagline = q('[data-tagline]');
  const hint = q('[data-hint]');
  const form = q<HTMLFormElement>('[data-email-form]');
  const input = q<HTMLInputElement>('[data-email-input]');
  const emailWrap = q('[data-email-wrap]');
  const emailDone = q('[data-email-done]');
  const gateBtn = q('[data-gate-btn]');
  const gateForm = q<HTMLFormElement>('[data-gate-form]');
  const gateInput = q<HTMLInputElement>('[data-gate-input]');

  // Author access gate. TODO(rotem): set this code. It is CLIENT-SIDE (a soft gate for previewing
  // the not-yet-open store on production), not real security — anyone reading the bundle can find it.
  const GATE_CODE = 'CHANGE-ME';
  const STORE_PATH = '/store';

  // Beam / darkness colours single-sourced from tokens (keeps this module token-clean).
  const cs = getComputedStyle(document.documentElement);
  const BEAM = cs.getPropertyValue('--ah-beam').trim() || '255, 214, 140';
  const NIGHT = cs.getPropertyValue('--ah-night-rgb').trim() || '12, 9, 6';

  const BEAM_BASE = 135; // reads as px on a 390-wide phone, scaled by stage width
  let rect = stage.getBoundingClientRect();
  const measure = () => { rect = stage.getBoundingClientRect(); };
  const beamR = () => BEAM_BASE * ((rect.width || 390) / 390);

  let lit = false;
  let bx = rect.width / 2, by = rect.height * 0.45;
  let tx = bx, ty = by;
  let lastMove = 0, lastMeasure = 0;
  const t0 = performance.now();
  let raf = 0;

  const paintBeam = () => {
    if (!dark) return;
    const R = beamR();
    const x = Math.round(bx), y = Math.round(by);
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
    const dist = Math.hypot(ex - bx, ey - by);
    const R = beamR() * 1.5;
    eyes.style.opacity = String(Math.max(0, Math.min(1, (dist - R * 0.55) / (R * 0.6))));
  };

  const show = (el: HTMLElement | null, vis: boolean) => { if (el) el.style.opacity = vis ? '1' : '0'; };

  const setLit = (on: boolean, instant: boolean) => {
    lit = on;
    if (dark) {
      dark.style.animation = 'none';
      if (on) {
        if (instant) { dark.style.opacity = '0'; }
        else { void dark.offsetWidth; dark.style.animation = 'gfahm-flickon .95s steps(1,end) forwards'; dark.style.opacity = '0'; }
      } else { dark.style.opacity = '1'; paintBeam(); }
    }
    if (glow) glow.style.opacity = on ? '1' : '0';
    if (on) { try { localStorage.setItem('gf-ah-found', '1'); } catch { /* private mode */ } }
    show(q('[data-h-dark]'), !on); show(q('[data-h-lit]'), on);
    show(q('[data-s-dark]'), !on); show(q('[data-s-lit]'), on);
    if (wm) wm.style.filter = on ? 'none' : 'invert(1) brightness(1.6)';
    if (tagline) tagline.style.color = on ? 'var(--ah-sub-lit)' : 'var(--ah-tagline)';
    if (hint) {
      hint.textContent = on ? 'soon. promise. · pull the cord to close up' : 'drag your thumb · a cord hangs somewhere';
      hint.style.color = on ? 'var(--ah-hint-lit)' : 'var(--ah-hint)';
      hint.style.animation = on ? 'none' : '';
    }
    if (cordInner && !instant) { cordInner.style.animation = 'none'; void cordInner.offsetWidth; cordInner.style.animation = 'gfahm-sway .9s ease 2'; }
  };

  const onMove = (e: PointerEvent | TouchEvent) => {
    const p = (e as TouchEvent).touches?.[0] || (e as PointerEvent);
    tx = p.clientX - rect.left; ty = p.clientY - rect.top;
    lastMove = performance.now();
  };
  const onToggle = () => {
    setLit(!lit, false);
    try { (navigator as Navigator & { vibrate?: (n: number) => void }).vibrate?.(12); } catch { /* no haptics */ }
  };

  const loop = () => {
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    if (now - lastMeasure > 500) { lastMeasure = now; measure(); }
    const W = rect.width || 390, H = rect.height || 844;
    if (now - lastMove > 4200) { // idle: torch drifts on its own
      const t = now - t0;
      tx = W * (0.5 + 0.36 * Math.sin(t * 0.00023) + 0.08 * Math.sin(t * 0.00061));
      ty = H * (0.5 + 0.3 * Math.sin(t * 0.00017 + 1.7));
    }
    bx += (tx - bx) * 0.11;
    by += (ty - by) * 0.11;
    if (!lit) paintBeam();
    updateEyes();
  };

  const applyEmailPref = () => {
    let has = false; try { has = !!localStorage.getItem('gf-soon-email'); } catch { /* private mode */ }
    if (emailWrap) emailWrap.style.display = has ? 'none' : '';
    if (emailDone) emailDone.style.display = has ? 'block' : 'none';
  };
  const onSubmit = (e: Event) => {
    e.preventDefault();
    const v = (input?.value || '').trim();
    if (!v || v.indexOf('@') < 1 || v.indexOf('.') < 0) {
      if (input) { input.style.animation = 'none'; void input.offsetWidth; input.style.animation = 'gfahm-wob .4s ease'; }
      return;
    }
    try { localStorage.setItem('gf-soon-email', v); } catch { /* private mode */ }
    if (emailWrap) emailWrap.style.display = 'none';
    if (emailDone) { emailDone.style.display = 'block'; emailDone.style.animation = 'gfahm-pop .5s ease both'; }
  };

  const storeUnlocked = () => { try { return localStorage.getItem('gf-store-open') === '1'; } catch { return false; } };
  const onGateBtn = () => {
    if (storeUnlocked()) { location.href = STORE_PATH; return; } // already unlocked → straight in
    if (!gateForm) return;
    const opening = gateForm.hasAttribute('hidden');
    gateForm.toggleAttribute('hidden');
    if (opening) gateInput?.focus();
  };
  const onGateSubmit = (e: Event) => {
    e.preventDefault();
    if ((gateInput?.value || '') === GATE_CODE) {
      try { localStorage.setItem('gf-store-open', '1'); } catch { /* private mode */ }
      location.href = STORE_PATH;
    } else if (gateInput) {
      gateInput.style.animation = 'none'; void gateInput.offsetWidth; gateInput.style.animation = 'gfahm-wob .4s ease';
    }
  };

  cord?.addEventListener('click', onToggle);
  form?.addEventListener('submit', onSubmit);
  gateBtn?.addEventListener('click', onGateBtn);
  gateForm?.addEventListener('submit', onGateSubmit);
  applyEmailPref();

  let found = false; try { found = localStorage.getItem('gf-ah-found') === '1'; } catch { /* private mode */ }
  const moveEvents = ['pointermove', 'pointerdown', 'touchmove', 'touchstart'] as const;

  if (reduced) {
    setLit(true, true); // reduced-motion parity: lit + static, no beam/drift/eye tracking
  } else {
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
    form?.removeEventListener('submit', onSubmit);
    gateBtn?.removeEventListener('click', onGateBtn);
    gateForm?.removeEventListener('submit', onGateSubmit);
  };
});
