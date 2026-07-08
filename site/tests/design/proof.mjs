// After Hours fidelity proof. Baselines come FROM THE MOCK (gate 6), never the impl.
// Deterministic comparison uses the LIT state (torch off) so there is no rAF variability.
// Run: node tests/design/proof.mjs   (mock server on :8899, dev server on :4321)
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const MOCK = 'http://127.0.0.1:8899/mock.html';
const IMPL = 'http://127.0.0.1:4321/after-hours';
const OUT = path.resolve('tests/design/out');
fs.mkdirSync(OUT, { recursive: true });
const VIEWPORTS = [{ n: '1512', w: 1512, h: 946 }, { n: '1440', w: 1440, h: 900 }];
const results = { shots: [], diffs: [], form: {}, console: {}, nav: {} };

async function shot(browser, url, { w, h }, file, { lit = false, reduce = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  if (lit) await ctx.addInitScript(() => { try { localStorage.setItem('gf-ah-found', '1'); } catch {} });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(lit ? 500 : 1200); // lit: settle; dark: keep beam near centre (pre idle-wander)
  const p = path.join(OUT, file);
  await page.screenshot({ path: p, animations: 'disabled' });
  await ctx.close();
  results.shots.push({ file, url, w, h, lit, reduce, consoleErrors: errs });
  return { p, errs };
}

async function diff(a, b, outName) {
  const A = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) {
    return { outName, error: `dim mismatch ${A.info.width}x${A.info.height} vs ${B.info.width}x${B.info.height}` };
  }
  const { width, height } = A.info;
  const da = A.data, db = B.data, n = width * height;
  const out = Buffer.alloc(n * 4);
  let changed = 0; const TH = 24; // per-channel tolerance (AA/subpixel noise)
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const dr = Math.abs(da[o] - db[o]), dg = Math.abs(da[o + 1] - db[o + 1]), dbb = Math.abs(da[o + 2] - db[o + 2]);
    const bad = dr > TH || dg > TH || dbb > TH;
    if (bad) { changed++; out[o] = 255; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = 255; }
    else { out[o] = da[o]; out[o + 1] = da[o + 1]; out[o + 2] = da[o + 2]; out[o + 3] = 60; }
  }
  const p = path.join(OUT, outName);
  await sharp(out, { raw: { width, height, channels: 4 } }).png().toFile(p);
  return { outName, ratio: +(changed / n).toFixed(5), changed, total: n };
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  // 1) LIT baselines from the mock + impl lit, per viewport, then diff
  for (const v of VIEWPORTS) {
    const m = await shot(browser, MOCK, v, `mock-${v.n}-lit.png`, { lit: true });
    const i = await shot(browser, IMPL, v, `impl-${v.n}-lit.png`, { lit: true });
    results.diffs.push(await diff(m.p, i.p, `diff-${v.n}-lit.png`));
  }
  // 2) evidence: impl dark + reduced-motion at native
  await shot(browser, IMPL, VIEWPORTS[0], 'impl-1512-dark.png', {});
  await shot(browser, IMPL, VIEWPORTS[0], 'impl-1512-reduced.png', { reduce: true });

  // 3) form end-to-end (impl, lit so the card is visible without the torch)
  {
    const ctx = await browser.newContext({ viewport: { width: 1512, height: 946 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => { try { localStorage.setItem('gf-ah-found', '1'); localStorage.removeItem('gf-soon-email'); } catch {} });
    const page = await ctx.newPage();
    const errs = []; page.on('console', m => m.type() === 'error' && errs.push(m.text())); page.on('pageerror', e => errs.push(String(e)));
    await page.goto(IMPL, { waitUntil: 'networkidle' });
    // invalid submit -> stays on form, no done state
    await page.fill('[data-email-input]', 'not-an-email');
    await page.click('.ah-email-btn');
    await page.waitForTimeout(200);
    const doneAfterInvalid = await page.isVisible('[data-email-done]');
    // valid submit -> done state + persisted
    await page.fill('[data-email-input]', 'rotem@example.com');
    await page.click('.ah-email-btn');
    await page.waitForTimeout(300);
    const doneAfterValid = await page.isVisible('[data-email-done]');
    const stored = await page.evaluate(() => localStorage.getItem('gf-soon-email'));
    results.form = { doneAfterInvalid, doneAfterValid, stored, consoleErrors: errs };
    await ctx.close();
  }

  // 4) client-side nav re-assert: simulate a ClientRouter swap cycle, torch must re-init clean
  {
    const ctx = await browser.newContext({ viewport: { width: 1512, height: 946 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errs = []; page.on('console', m => m.type() === 'error' && errs.push(m.text())); page.on('pageerror', e => errs.push(String(e)));
    await page.goto(IMPL, { waitUntil: 'networkidle' });
    const before = await page.getAttribute('[data-dark]', 'style');
    // simulate swap away + back (the lifecycle events ClientRouter fires)
    await page.evaluate(() => { document.dispatchEvent(new Event('astro:before-swap')); document.dispatchEvent(new Event('astro:page-load')); });
    await page.mouse.move(760, 400); await page.mouse.move(500, 300);
    await page.waitForTimeout(400);
    const after = await page.getAttribute('[data-dark]', 'style');
    results.nav = { beamRepaintsAfterNav: !!after && after.includes('radial-gradient'), changed: before !== after, consoleErrors: errs };
    await ctx.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
