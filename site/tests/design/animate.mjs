// Capture human-watchable evidence of EVERY After Hours animation (design-shipper Proof B).
// Records short clips (torch, lights, email) + a flick-on frame series + a clean-console check.
// Run: node tests/design/animate.mjs   (dev server on :4321)
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const IMPL = 'http://127.0.0.1:4321/after-hours';
const OUT = path.resolve('tests/design/out');
const VID = path.join(OUT, 'vid');
fs.mkdirSync(VID, { recursive: true });
const V = { width: 1512, height: 946 };
const report = { clips: [], frames: [], consoleErrorsOnLoad: [] };

const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function clip(name, steps, { lit = false, reduce = false } = {}) {
  const ctx = await browser.newContext({ viewport: V, deviceScaleFactor: 1, reducedMotion: reduce ? 'reduce' : 'no-preference', recordVideo: { dir: VID, size: V } });
  if (lit) await ctx.addInitScript(() => { try { localStorage.setItem('gf-ah-found', '1'); localStorage.removeItem('gf-soon-email'); } catch {} });
  else await ctx.addInitScript(() => { try { localStorage.removeItem('gf-ah-found'); localStorage.removeItem('gf-soon-email'); } catch {} });
  const page = await ctx.newPage();
  await page.goto(IMPL, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await steps(page);
  const video = page.video();
  await ctx.close();
  const raw = await video.path();
  const dest = path.join(VID, name + '.webm');
  fs.renameSync(raw, dest);
  report.clips.push({ name, webm: dest });
}

// 1) TORCH: beam follows the cursor, eyes fade near it, hint pulses (dark)
await clip('torch', async (page) => {
  const pts = [[756, 400], [400, 300], [300, 620], [1100, 260], [1180, 640], [560, 500], [756, 400]];
  for (const [x, y] of pts) { await page.mouse.move(x, y, { steps: 24 }); await page.waitForTimeout(500); }
});

// 2) LIGHTS: pull the cord -> flick-on, copy crossfade, glow, cord sway (dark -> lit -> dark)
await clip('lights', async (page) => {
  await page.waitForTimeout(900);
  await page.click('[data-cord]'); await page.waitForTimeout(1800);
  await page.click('[data-cord]'); await page.waitForTimeout(1400);
});

// 3) EMAIL: invalid -> wobble, valid -> pop done (lit so the card is lit without the torch)
await clip('email', async (page) => {
  await page.waitForTimeout(500);
  await page.fill('[data-email-input]', 'nope'); await page.click('.ah-email-btn'); await page.waitForTimeout(700);
  await page.fill('[data-email-input]', ''); await page.fill('[data-email-input]', 'rotem@example.com');
  await page.click('.ah-email-btn'); await page.waitForTimeout(1100);
}, { lit: true });

// 4) FLICK-ON frame series (proves the gfah-flickon keyframes) + clean-console load
{
  const ctx = await browser.newContext({ viewport: V, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(IMPL, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  report.consoleErrorsOnLoad = errs.slice();
  await page.click('[data-cord]');
  for (const t of [60, 140, 240, 360, 520, 760, 980]) {
    await page.waitForTimeout(t === 60 ? 60 : 0);
    const f = `flickon-${t}.png`;
    await page.screenshot({ path: path.join(OUT, f) });
    report.frames.push(f);
    if (t !== 980) await page.waitForTimeout([80, 100, 120, 160, 240, 220][[140,240,360,520,760,980].indexOf(t)] || 100);
  }
  await ctx.close();
}

await browser.close();

// webm -> gif (downscaled, 14fps) via ffmpeg
import { execSync } from 'node:child_process';
for (const c of report.clips) {
  const gif = path.join(VID, c.name + '.gif');
  try {
    execSync(`ffmpeg -y -i "${c.webm}" -vf "fps=14,scale=756:-1:flags=lanczos" "${gif}"`, { stdio: 'ignore' });
    c.gif = gif; c.gifBytes = fs.statSync(gif).size;
  } catch (e) { c.gifError = String(e); }
}
fs.writeFileSync(path.join(OUT, 'animate-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
