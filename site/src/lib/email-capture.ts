// Shared email-capture client helpers (Sprint 1 build, extracted R2-S8 so the /about
// NewsletterForm reuses the SAME implementation as After Hours instead of forking one).
// Submit posts to the own-the-data endpoint (/api/subscribe -> Cloudflare D1, no external
// email service). The server verifies an invisible Turnstile token (fails closed), reads
// the gf_hp honeypot, allowlists `source`, and does a parameterized insert.
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
export function createTurnstile(container: HTMLElement) {
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

export interface EmailCaptureOptions {
  /** Server-allowlisted list segment this form feeds ('after-hours' | 'drops'). */
  source?: string;
  /** localStorage key for the per-browser remembered-success UX (never security state). */
  storageKey?: string;
}

// Wire a notify-me form inside `root` to the capture endpoint. `root` must contain the
// [data-email-form]/[data-email-input]/[data-email-wrap]/[data-email-done]/[data-hp]/
// [data-turnstile]/[data-email-error] contract. Returns a disposer (removes the listener
// + the Turnstile widget) for the mount lifecycle.
export function wireEmailCapture(root: HTMLElement, opts: EmailCaptureOptions = {}) {
  const source = opts.source || 'after-hours';
  const storageKey = opts.storageKey || 'gf-soon-email';
  const form = root.querySelector<HTMLFormElement>('[data-email-form]');
  const input = root.querySelector<HTMLInputElement>('[data-email-input]');
  const emailWrap = root.querySelector<HTMLElement>('[data-email-wrap]');
  const emailDone = root.querySelector<HTMLElement>('[data-email-done]');
  const hp = root.querySelector<HTMLInputElement>('[data-hp]');
  const tsBox = root.querySelector<HTMLElement>('[data-turnstile]');
  const errEl = root.querySelector<HTMLElement>('[data-email-error]');
  if (!form || !input) return () => { /* nothing to dispose */ };

  // Remembered success (per-browser UX, independent of the server): already on the list -> show done.
  let signed = false; try { signed = !!localStorage.getItem(storageKey); } catch { /* private mode */ }
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
        body: JSON.stringify({ email: v, gf_hp: hpVal, 'cf-turnstile-response': token, source }),
      });
      const data = (await res.json().catch(() => ({ ok: false }))) as { ok?: boolean };
      // The server also answers {ok:true} for a honeypot trip (storing nothing). Only treat it as a
      // real signup when OUR honeypot was empty, so an autofilled hidden field cannot cache a false success.
      if (res.ok && data.ok && !hpVal) {
        try { localStorage.setItem(storageKey, v); } catch { /* private mode */ }
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
