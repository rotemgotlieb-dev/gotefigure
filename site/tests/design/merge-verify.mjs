import { chromium } from '@playwright/test';
const OUT = '/Users/rotemgotlieb/conductor/workspaces/gotefigure/luxembourg/.context/merge-verify';
const B = 'http://127.0.0.1:8790';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const out = {};
const mkctx = (w, h, opts = {}) => b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ...opts });
const errsOf = (p, e) => { p.on('console', m => m.type() === 'error' && e.push(m.text())); p.on('pageerror', x => e.push(String(x))); };

// 1) MOBILE home 375
{
  const c = await mkctx(375, 812); const p = await c.newPage(); const e = []; errsOf(p, e);
  await p.goto(B + '/', { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(700);
  out.mobile375 = {
    mobileVisible: await p.isVisible('[data-ah-block="mobile"] [data-room-stage]'),
    desktopHidden: !(await p.isVisible('[data-ah-block="desktop"] #ah-root').catch(() => false)),
    gate: await p.isVisible('[data-gate-btn]'), errors: e,
  };
  await p.screenshot({ path: OUT + '/home-375-mobile.png' }); await c.close();
}
// 2) DESKTOP home 1440 dark + lit
{
  const c = await mkctx(1440, 900); const p = await c.newPage(); const e = []; errsOf(p, e);
  await p.goto(B + '/', { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready); await p.mouse.move(720, 380); await p.waitForTimeout(900);
  out.desktop1440 = {
    desktopVisible: await p.isVisible('[data-ah-block="desktop"] #ah-root'),
    frames: await p.locator('[data-ah-block="desktop"] .ah-frame').count(),
    beam: (await p.getAttribute('[data-ah-block="desktop"] [data-dark]', 'style') || '').includes('radial-gradient'),
    errors: e,
  };
  await p.screenshot({ path: OUT + '/home-1440-desktop-dark.png' }); await c.close();
}
{
  const c = await mkctx(1440, 900); await c.addInitScript(() => { try { localStorage.setItem('gf-ah-found', '1'); } catch {} });
  const p = await c.newPage(); await p.goto(B + '/', { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(700);
  await p.screenshot({ path: OUT + '/home-1440-desktop-lit.png' }); await c.close();
}
// 3) /store guard (no flag) -> bounce to /
{
  const c = await mkctx(1440, 900); const p = await c.newPage(); await p.goto(B + '/store/', { waitUntil: 'networkidle' }).catch(() => {}); await p.waitForTimeout(400);
  out.storeNoFlag = { endedAt: p.url(), bounced: p.url().replace(/\/$/, '').endsWith(':8790') }; await c.close();
}
// 4) gate flow: wrong then right code -> /store
{
  const c = await mkctx(1440, 900); const p = await c.newPage(); const e = []; errsOf(p, e);
  await p.goto(B + '/', { waitUntil: 'networkidle' }); await p.click('[data-gate-btn]'); const formShown = await p.isVisible('[data-gate-form]');
  await p.fill('[data-gate-input]', 'nope'); await p.click('.ah-gate-go'); await p.waitForTimeout(150); const afterWrong = p.url();
  await p.fill('[data-gate-input]', 'timnertimner'); await p.click('.ah-gate-go'); await p.waitForTimeout(700);
  out.gate = { formShown, wrongStayed: afterWrong.replace(/\/$/, '').endsWith(':8790'), afterRight: p.url(), flag: await p.evaluate(() => localStorage.getItem('gf-store-open')), storeMain: await p.isVisible('main').catch(() => false), errors: e };
  await p.screenshot({ path: OUT + '/store-after-gate.png' }); await c.close();
}
// 5) nav round-trip: torch survives a ClientRouter swap cycle
{
  const c = await mkctx(1440, 900); const p = await c.newPage(); const e = []; errsOf(p, e);
  await p.goto(B + '/', { waitUntil: 'networkidle' }); await p.mouse.move(600, 400); await p.waitForTimeout(400);
  await p.evaluate(() => { document.dispatchEvent(new Event('astro:before-swap')); document.dispatchEvent(new Event('astro:page-load')); });
  await p.mouse.move(900, 500); await p.mouse.move(650, 360); await p.waitForTimeout(400);
  out.navRoundTrip = { beamRepaints: (await p.getAttribute('[data-ah-block="desktop"] [data-dark]', 'style') || '').includes('radial-gradient'), errors: e }; await c.close();
}
// 6) reduced-motion 1440 -> lit static (dark layer opacity 0)
{
  const c = await mkctx(1440, 900, { reducedMotion: 'reduce' }); const p = await c.newPage();
  await p.goto(B + '/', { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  out.reducedLit = { darkOpacity: await p.evaluate(() => { const d = document.querySelector('[data-ah-block="desktop"] [data-dark]'); return d ? getComputedStyle(d).opacity : null; }) };
  await p.screenshot({ path: OUT + '/home-1440-reduced.png' }); await c.close();
}
console.log(JSON.stringify(out, null, 2));
await b.close();
