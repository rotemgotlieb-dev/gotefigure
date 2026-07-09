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
// Replaces the old localStorage-only stub: submit posts to the own-the-data endpoint
// (/api/subscribe -> Cloudflare D1, no external email service). The server verifies an
// invisible Turnstile token (fails closed), reads a honeypot, and does a parameterized insert.
// Invisible widget = no visual clutter; token fetched on demand via getResponse/execute.
// Sitekey is env-sourced (PUBLIC_* is inlined at build; a sitekey is public, so this is safe) so it
// flips in the SAME Cloudflare env layer as TURNSTILE_SECRET_KEY. Falls back to the invisible TEST key
// for local dev + previews. GO-LIVE: set PUBLIC_TURNSTILE_SITEKEY (real SITE key) alongside the secret,
// then confirm a real signup lands a D1 row before DNS cutover (test key + real secret = silent zero-capture).
const TS_SITEKEY = import.meta.env.PUBLIC_TURNSTILE_SITEKEY || '1x00000000000000000000BB';

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  getResponse: (id: string) => string | undefined;
  execute: (id: string) => void;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
const getTS = (): TurnstileApi | undefined =>
  (window as unknown as { turnstile?: TurnstileApi }).turnstile;

// One invisible Turnstile widget bound to a container. Polls for the async-loaded script,
// renders explicitly, and hands back a fresh token on demand (fails soft to '' so the server,
// which fails closed, is the real gate).
function createTurnstile(container: HTMLElement) {
  let widgetId: string | null = null;
  let latest = '';
  let waiters: Array<(t: string) => void> = [];
  const settle = (t: string) => { latest = t; const w = waiters; waiters = []; w.forEach((r) => r(t)); };

  const render = () => {
    const ts = getTS();
    if (!ts || widgetId !== null) return;
    try {
      widgetId = ts.render(container, {
        sitekey: TS_SITEKEY,
        size: 'invisible',
        callback: (t: string) => settle(t),
        'error-callback': () => { latest = ''; },
        'expired-callback': () => { latest = ''; },
      });
    } catch { /* render failed; getToken falls back to '' */ }
  };

  let tries = 0;
  const poll = window.setInterval(() => {
    if (getTS()) { window.clearInterval(poll); render(); }
    else if (++tries > 100) window.clearInterval(poll); // give up after ~5s
  }, 50);

  return {
    getToken(): Promise<string> {
      const ts = getTS();
      if (ts && widgetId !== null) {
        const cur = ts.getResponse(widgetId);
        if (cur) return Promise.resolve(cur);
      }
      return new Promise<string>((resolve) => {
        waiters.push(resolve);
        try { if (ts && widgetId !== null) ts.execute(widgetId); } catch { /* noop */ }
        window.setTimeout(() => {
          const i = waiters.indexOf(resolve);
          if (i >= 0) { waiters.splice(i, 1); resolve(latest); }
        }, 8000);
      });
    },
    reset() { const ts = getTS(); try { if (ts && widgetId !== null) ts.reset(widgetId); } catch { /* noop */ } latest = ''; },
    remove() { const ts = getTS(); try { if (ts && widgetId !== null) ts.remove(widgetId); } catch { /* noop */ } widgetId = null; window.clearInterval(poll); },
  };
}

// Wire the notify-me form inside a mounted After Hours block to the capture endpoint.
// Returns a disposer (removes the listener + the Turnstile widget) for the mount lifecycle.
function wireEmailCapture(root: HTMLElement) {
  const form = root.querySelector<HTMLFormElement>('[data-email-form]');
  const input = root.querySelector<HTMLInputElement>('[data-email-input]');
  const emailWrap = root.querySelector<HTMLElement>('[data-email-wrap]');
  const emailDone = root.querySelector<HTMLElement>('[data-email-done]');
  const hp = root.querySelector<HTMLInputElement>('[data-hp]');
  const tsBox = root.querySelector<HTMLElement>('[data-turnstile]');
  const errEl = root.querySelector<HTMLElement>('[data-email-error]');
  if (!form || !input) return () => { /* nothing to dispose */ };

  // Remembered success (per-browser UX, independent of the server): already on the list -> show done.
  let signed = false; try { signed = !!localStorage.getItem('gf-soon-email'); } catch { /* private mode */ }
  if (emailWrap) emailWrap.style.display = signed ? 'none' : '';
  if (emailDone) emailDone.style.display = signed ? 'block' : 'none';

  const ts = tsBox ? createTurnstile(tsBox) : null;
  const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  // Failures announce to AT (role=alert lives on [data-email-error]) AND shake the input, so the
  // outcome is perceivable to screen-reader + low-vision users, not just a silent wobble.
  const fail = (msg: string) => {
    if (errEl) errEl.textContent = msg;
    input.setAttribute('aria-invalid', 'true');
    input.style.animation = 'none'; void input.offsetWidth; input.style.animation = 'gfahm-wob .4s ease';
  };
  const clearErr = () => { if (errEl) errEl.textContent = ''; input.removeAttribute('aria-invalid'); };
  const showDone = () => {
    if (emailWrap) emailWrap.style.display = 'none';
    if (emailDone) { emailDone.style.display = 'block'; emailDone.style.animation = 'gfahm-pop .5s ease both'; }
  };
  let busy = false;

  const run = async (e: Event): Promise<void> => {
    e.preventDefault();
    if (busy) return;
    clearErr();
    const v = (input.value || '').trim();
    if (!v || v.indexOf('@') < 1 || v.indexOf('.') < 0) { fail('that email looks off, please check it'); return; }
    busy = true; if (btn) btn.disabled = true;
    try {
      const hpVal = hp?.value || '';                       // honeypot: empty for a real human
      const token = ts ? await ts.getToken() : '';
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: v, gf_hp: hpVal, 'cf-turnstile-response': token }),
      });
      const data = (await res.json().catch(() => ({ ok: false }))) as { ok?: boolean };
      // The server also answers {ok:true} for a honeypot trip (storing nothing). Only treat it as a
      // real signup when OUR honeypot was empty, so an autofilled hidden field cannot cache a false success.
      if (res.ok && data.ok && !hpVal) {
        try { localStorage.setItem('gf-soon-email', v); } catch { /* private mode */ }
        showDone();
      } else if (res.ok && data.ok && hpVal) {
        fail('something went wrong, please try again');    // honeypot tripped (autofill); do not cache
      } else {
        fail('could not reach us, please try again'); ts?.reset();
      }
    } catch {
      fail('could not reach us, please try again'); ts?.reset();
    } finally {
      busy = false; if (btn) btn.disabled = false;
    }
  };
  const handler = (e: Event) => { void run(e); };
  form.addEventListener('submit', handler);
  return () => { form.removeEventListener('submit', handler); ts?.remove(); };
}

defineModule('after-hours', ({ reduced }) => {
  const cs = getComputedStyle(document.documentElement);
  const BEAM = cs.getPropertyValue('--ah-beam').trim() || '255, 214, 140';
  const NIGHT = cs.getPropertyValue('--ah-night-rgb').trim() || '12, 9, 6';

  // ---- shared author gate (single corner element, both breakpoints) ----
  // Client-side soft gate to preview the not-yet-open store on production (not real security —
  // the code ships in the bundle; the durable hard gate is a post-hosting Worker/middleware step).
  const GATE_CODE = 'timnertimner';
  const STORE_PATH = '/store';
  const gateBtn = document.querySelector<HTMLElement>('[data-gate-btn]');
  const gateForm = document.querySelector<HTMLFormElement>('[data-gate-form]');
  const gateInput = document.querySelector<HTMLInputElement>('[data-gate-input]');
  const storeUnlocked = () => { try { return localStorage.getItem('gf-store-open') === '1'; } catch { return false; } };
  const onGateBtn = () => {
    if (storeUnlocked()) { location.href = STORE_PATH; return; }
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
        hint.textContent = on ? 'soon. promise. · pull the cord to close up' : 'drag your thumb · a cord hangs somewhere';
        hint.style.color = on ? 'var(--ah-hint-lit)' : 'var(--ah-hint)';
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
        hint.textContent = on ? 'soon. promise. · pull the cord to close up' : 'somewhere, a cord is hanging · pull it';
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
