// Smoke tests over BUILT html (run `npm run verify`). Guards the routing contract:
// `/` is the pre-launch After Hours gate (v3 skin); `/store` renders ON the Worker
// behind the signed-cookie hard gate (Sprint 2) and must never exist as a static file.
// Static assets live under dist/client; the adapter emits the worker + its own
// wrangler.json under dist/server (verified via `wrangler deploy --dry-run`).
// Not a substitute for browser verification.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(__dirname, '..', 'dist', 'client');
const page = (p: string) => readFileSync(join(dist, p), 'utf8');

describe('built routes', () => {
  it.each([
    'index.html',            // After Hours (the gate)
    'vault/index.html',
    'piece/sticker/index.html',
    'piece/print/index.html',
    'piece/tee/index.html',
    'piece/sweat/index.html',
    'piece/original/index.html',
    '404.html',
    'about/index.html',
  ])('%s exists', (p) => {
    expect(existsSync(join(dist, p))).toBe(true);
  });

  it('/store is NOT statically built (the hard gate: Worker-rendered only, no file to fetch around it)', () => {
    expect(existsSync(join(dist, 'store', 'index.html'))).toBe(false);
    expect(existsSync(join(__dirname, '..', 'dist', 'store', 'index.html'))).toBe(false);
  });

  it('the gate code never ships in the client bundle', () => {
    // The old client gate hardcoded the passphrase; assert no bundle carries it again.
    const astroDir = join(dist, '_astro');
    if (!existsSync(astroDir)) return;
    const { readdirSync } = require('node:fs') as typeof import('node:fs');
    for (const f of readdirSync(astroDir)) {
      if (!f.endsWith('.js')) continue;
      expect(readFileSync(join(astroDir, f), 'utf8')).not.toContain('timnertimner');
    }
  });

  it('/shop redirects home (old links survive — now via the platform _redirects file)', () => {
    expect(page('_redirects')).toMatch(/\/shop\s+\/\s+301/);
  });
});

describe('home — After Hours (the pre-launch gate)', () => {
  const html = page('index.html');

  it('has landmarks and skip link', () => {
    expect(html).toContain('id="main"');
    expect(html).toContain('skip-link');
    expect(html).toContain('lang="en"');
  });

  it('mounts the dark-salon stage + torch overlay + light cord + hero states', () => {
    expect(html).toContain('data-room-stage');
    expect(html).toContain('data-dark');
    expect(html).toContain('data-cord');
    expect(html).toContain('the lights aren');   // "the lights aren't on yet."
    expect(html).toContain('there, that');        // lit-state headline
  });

  it('hangs the four framed pieces with catalog numbers', () => {
    for (const name of ['the committee', 'the hare', 'brain weather', 'the regular']) {
      expect(html).toContain(name);
    }
    for (const no of ['NO 001', 'NO 002', 'NO 003', 'NO 004']) {
      expect(html).toContain(no);
    }
    expect(html).toContain('works on paper');
  });

  it('captures email (the whole point of the page)', () => {
    expect(html).toContain('data-email-form');
    expect(html).toContain('tell me when the shop opens');
    expect(html).toContain('data-email-done');
  });

  it('carries the hidden author access gate', () => {
    expect(html).toContain('data-gate');
    expect(html).toContain('data-gate-input');
  });

  it('is chromeless: no store nav / cart / flood on the gate', () => {
    expect(html).not.toContain('data-cart-count');
    expect(html).not.toContain('data-home-main');
    expect(html).not.toContain('gf-flood');
  });

  it('no daily-cadence claims anywhere', () => {
    expect(html.toLowerCase()).not.toContain('drawn every day');
    expect(html.toLowerCase()).not.toContain('drawing every day');
    expect(html).not.toMatch(/Day \d+ of/);
  });
});

// /store no longer exists as static HTML (the hard gate renders it on the Worker),
// so its content contract is asserted against the compiled SERVER bundle: the page
// template strings must survive into dist/server. Proves the 1:1 port content shipped
// into the Worker without needing a live render in the smoke tier.
const serverDir = join(__dirname, '..', 'dist', 'server');
const serverBundle = (() => {
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  let out = '';
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.mjs') || f.endsWith('.js')) out += readFileSync(p, 'utf8');
    }
  };
  if (existsSync(serverDir)) walk(serverDir);
  return out;
})();

describe('store — the drop (Worker-rendered behind the gate; content asserted in the server bundle)', () => {
  const html = serverBundle;

  it('the gate wiring compiled into the worker (cookie name + login route)', () => {
    expect(html).toContain('gf_gate');
    expect(html).toContain('gate_attempts');
  });

  it('mounts the scroll brush-stroke + arrival + home main', () => {
    expect(html).toContain('data-home-main');
    expect(html).toContain('id="gf-line"');
    expect(html).toContain('id="gf-word"');
    expect(html).toContain('data-arrival-root');
    expect(html).toContain('data-next-drop');
  });

  it('renders the nav + bag + flood overlay', () => {
    expect(html).toContain('The Drop');
    expect(html).toContain('The Vault');
    expect(html).toContain('data-cart-count');
    expect(html).toContain('gf-flood');
  });

  it('renders all allowlisted pieces with ink CTAs + quick add', () => {
    for (const name of ['Goggle Rabbit', 'Kaleido Plate', 'Trippy 1.1', 'Pink Rabbit', 'Bloom Study no.4']) {
      expect(html).toContain(name);
    }
    expect(html).toContain('data-ink-btn');
    expect(html).toContain('data-quickadd');
    expect(html).toContain('This month');
  });

  it('countdown teaser template compiled into the worker (hero CTA + stock badge are runtime-computed, not assertable as literals)', () => {
    expect(html).toContain('next drop');
    expect(html).toContain('data-count-dd');
  });

  it('maker is visible: portrait + first person + signature', () => {
    expect(html).toContain('rotem-portrait');
    expect(html).toContain('drawn by me, once');
    expect(html).toContain('signature.png');
  });
});

describe('piece pages', () => {
  it('tee PDP: placard, sizes, scarcity, ink CTA', () => {
    const html = page('piece/tee/index.html');
    expect(html).toContain('data-piece-id="tee"');
    expect(html).toContain('data-sized="1"');
    expect(html).toContain('never reprinted');
    expect(html).toContain('data-add="pdp"');
    expect(html).toContain('measurements');
    expect(html).toContain('heavyweight cotton tee');
  });

  it('original PDP: 1 of 1, claim CTA, no sizes', () => {
    const html = page('piece/original/index.html');
    expect(html).toContain('1 of 1');
    expect(html).toContain('Claim the original');
    expect(html).not.toContain('data-sized="1"');
  });
});

describe('the vault', () => {
  const html = page('vault/index.html');
  it('lists all 11 vaulted pieces, never-reprinted voice, dark room', () => {
    for (const name of ['OG Rabbit', 'Twin Figs', 'Fly Agaric', 'The Alien', 'Azrieli Cat']) {
      expect(html).toContain(name);
    }
    expect(html).toContain('never reprinted');
    expect(html).toContain('not for sale');
    expect(html).toContain('Back to the living');
  });
});

describe('satchel drawer (store, in the server bundle)', () => {
  const html = serverBundle;
  it('drawer shell with seal ritual + honest prototype note', () => {
    expect(html).toContain('data-satchel');
    expect(html).toContain('Seal the order');
    expect(html).toContain('nothing is charged');
    expect(html).toContain('the ink dries fast');
  });
});
