// After Hours — the dark salon. Torch + pull-cord + email capture.
// 1:1 translation of the approved mock's DCLogic into an init()/destroy() module so it
// survives ClientRouter (§7.6.6): bound on astro:page-load, fully torn down on astro:before-swap.
// Torch/beam is a compositor-only rAF loop (background-position + opacity). Desktop-only;
// mobile motion is owned by the parallel branch. Reduced-motion -> static LIT (content never gated, §7.6.1).

const BEAM = 180; // mock prop default (range 110-320)

let raf = 0;
let lit = false;
let bx = 0, by = 0, tx = 0, ty = 0, lastMove = 0, t0 = 0;
let bound = false;

let onMove: ((e: PointerEvent | TouchEvent) => void) | null = null;
let onResize: (() => void) | null = null;
let onCord: (() => void) | null = null;
let onSubmit: ((e: Event) => void) | null = null;

const q = <T extends Element>(s: string) => document.querySelector<T>(s);
const isDesktop = () => matchMedia('(min-width: 1024px)').matches;

function paintBeam() {
  const d = q<HTMLElement>('[data-dark]');
  if (!d) return;
  const R = BEAM;
  const x = Math.round(bx), y = Math.round(by);
  d.style.background =
    `radial-gradient(circle ${Math.round(R * 2.1)}px at ${x}px ${y}px, ` +
    `rgba(255,214,140,.09), rgba(12,9,6,0) ${Math.round(R * 0.42)}px, ` +
    `rgba(12,9,6,.55) ${R}px, rgba(12,9,6,.987) ${Math.round(R * 1.92)}px)`;
}

function updateEyes() {
  const eyes = q<HTMLElement>('[data-eyes]');
  if (!eyes) return;
  if (lit) { eyes.style.opacity = '0'; return; }
  const r = eyes.getBoundingClientRect();
  const dx = (r.left + r.width / 2) - bx, dy = (r.top + r.height / 2) - by;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const R = BEAM * 1.5;
  eyes.style.opacity = String(Math.max(0, Math.min(1, (dist - R * 0.55) / (R * 0.6))));
}

// The stage is a fixed 1512x946 canvas scaled to the viewport (desktop only).
function applyScale() {
  const desktop = isDesktop();
  const s = Math.min(window.innerWidth / 1512, window.innerHeight / 946);
  (['[data-stage-back]', '[data-stage-front]'] as const).forEach((sel) => {
    const el = q<HTMLElement>(sel);
    if (el) el.style.transform = desktop ? `translate(-50%,-50%) scale(${s})` : '';
  });
}

function setLit(on: boolean, instant: boolean) {
  lit = on;
  const d = q<HTMLElement>('[data-dark]');
  const glow = q<HTMLElement>('[data-glow]');
  if (d) {
    d.style.animation = 'none';
    if (on) {
      if (instant) { d.style.opacity = '0'; }
      else { void d.offsetWidth; d.style.animation = 'gfah-flickon .95s steps(1,end) forwards'; d.style.opacity = '0'; }
    } else {
      d.style.opacity = '1';
      paintBeam();
    }
  }
  if (glow) glow.style.opacity = on ? '1' : '0';
  if (on) { try { localStorage.setItem('gf-ah-found', '1'); } catch { /* private mode */ } }

  const show = (sel: string, vis: boolean) => { const el = q<HTMLElement>(sel); if (el) el.style.opacity = vis ? '1' : '0'; };
  show('[data-h-dark]', !on); show('[data-h-lit]', on);
  show('[data-s-dark]', !on); show('[data-s-lit]', on);

  const wm = q<HTMLElement>('[data-wm]');
  if (wm) wm.style.filter = on ? 'none' : 'invert(1) brightness(1.6)';
  const tag = q<HTMLElement>('[data-tagline]');
  if (tag) tag.style.color = on ? 'var(--ah-tag-lit)' : 'var(--ah-tag-dark)';
  const hint = q<HTMLElement>('[data-hint]');
  if (hint) {
    hint.textContent = on ? 'soon. promise. · pull the cord to close up' : 'somewhere, a cord is hanging · pull it';
    hint.style.color = on ? 'var(--ah-hint-lit)' : 'var(--ah-hint-dark)';
    hint.style.animation = on ? 'none' : '';
  }
  const cord = q<HTMLElement>('[data-cord-inner]');
  if (cord && !instant) { cord.style.animation = 'none'; void cord.offsetWidth; cord.style.animation = 'gfah-sway .9s ease 2'; }
}

function toggleLights() { setLit(!lit, false); }

function applyEmailPref() {
  const card = q<HTMLElement>('[data-email-card]');
  if (!card) return;
  card.style.display = ''; // emailCapture default = true
  let has = false;
  try { has = !!localStorage.getItem('gf-soon-email'); } catch { /* private mode */ }
  const wrap = q<HTMLElement>('[data-email-wrap]');
  const done = q<HTMLElement>('[data-email-done]');
  if (wrap) wrap.style.display = has ? 'none' : '';
  if (done) done.style.display = has ? 'block' : 'none';
}

function submitEmail(e: Event) {
  e.preventDefault();
  const inp = q<HTMLInputElement>('[data-email-input]');
  const v = inp ? inp.value.trim() : '';
  if (!v || v.indexOf('@') < 1 || v.indexOf('.') < 0) {
    if (inp) { inp.style.animation = 'none'; void inp.offsetWidth; inp.style.animation = 'gfah-wob .4s ease'; }
    return;
  }
  // Provider seam: the real drops-list provider is an owner decision (§8.4). Until then we persist
  // locally (matches the mock) — swap this line for the shared subscribe() when a provider is chosen.
  try { localStorage.setItem('gf-soon-email', v); } catch { /* private mode */ }
  const wrap = q<HTMLElement>('[data-email-wrap]');
  const done = q<HTMLElement>('[data-email-done]');
  if (wrap) wrap.style.display = 'none';
  if (done) { done.style.display = 'block'; done.style.animation = 'gfah-pop .5s ease both'; }
}

export function initAfterHours() {
  const root = q('#ah-root');
  if (!root || bound) return;
  bound = true;

  // Shared across breakpoints: email capture (the linchpin) + the pull-cord.
  applyEmailPref();
  const form = q<HTMLFormElement>('[data-email-form]');
  if (form) { onSubmit = submitEmail; form.addEventListener('submit', onSubmit); }
  const cordBtn = q<HTMLButtonElement>('[data-cord]');
  if (cordBtn) { onCord = toggleLights; cordBtn.addEventListener('click', onCord); }

  applyScale();
  onResize = applyScale;
  window.addEventListener('resize', onResize);

  // Mobile: the room shows flat/lit via CSS; the torch is desktop-only (parallel branch owns mobile motion).
  if (!isDesktop()) return;

  lit = false;
  bx = window.innerWidth / 2; by = window.innerHeight * 0.42; tx = bx; ty = by;
  lastMove = 0; t0 = performance.now();

  // Reduced-motion: start LIT, no torch chase — art + email always reachable (§7.6.1, §7.6.2).
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setLit(true, true);
    root.setAttribute('data-lit', 'reduced');
    return;
  }

  // startMode "remember" (mock default): stay lit if the room was found before.
  let found = false;
  try { found = localStorage.getItem('gf-ah-found') === '1'; } catch { /* private mode */ }
  if (found) setLit(true, true);

  onMove = (e: any) => {
    const p = (e.touches && e.touches[0]) || e;
    tx = p.clientX; ty = p.clientY; lastMove = performance.now();
  };
  window.addEventListener('pointermove', onMove as EventListener, { passive: true });
  window.addEventListener('pointerdown', onMove as EventListener, { passive: true });
  window.addEventListener('touchmove', onMove as EventListener, { passive: true });

  const loop = () => {
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    if (now - lastMove > 5200) { // idle: the torch wanders on its own
      const t = now - t0;
      tx = window.innerWidth * (0.5 + 0.34 * Math.sin(t * 0.00021) + 0.09 * Math.sin(t * 0.00059));
      ty = window.innerHeight * (0.44 + 0.30 * Math.sin(t * 0.00017 + 1.7));
    }
    bx += (tx - bx) * 0.09;
    by += (ty - by) * 0.09;
    if (!lit) paintBeam();
    updateEyes();
  };
  raf = requestAnimationFrame(loop);
}

export function destroyAfterHours() {
  if (!bound) return;
  bound = false;
  cancelAnimationFrame(raf); raf = 0;
  if (onResize) window.removeEventListener('resize', onResize);
  if (onMove) {
    window.removeEventListener('pointermove', onMove as EventListener);
    window.removeEventListener('pointerdown', onMove as EventListener);
    window.removeEventListener('touchmove', onMove as EventListener);
  }
  const form = q<HTMLFormElement>('[data-email-form]');
  if (form && onSubmit) form.removeEventListener('submit', onSubmit);
  const cordBtn = q<HTMLButtonElement>('[data-cord]');
  if (cordBtn && onCord) cordBtn.removeEventListener('click', onCord);
  onResize = onMove = onCord = onSubmit = null;
}
