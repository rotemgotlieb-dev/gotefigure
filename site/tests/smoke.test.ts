// Smoke tests over BUILT html (run `npm run verify`). Guards: routes exist,
// landmarks present, nav wired, tokens loaded. Not a substitute for browser testing.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(__dirname, '..', 'dist');
const page = (p: string) => readFileSync(join(dist, p), 'utf8');

describe('built routes', () => {
  it.each(['index.html', 'about/index.html', '404.html', 'info/shipping/index.html',
           'info/contact/index.html', 'info/privacy/index.html', 'shop/alien-logo-tee/index.html'])(
    '%s exists', (p) => expect(existsSync(join(dist, p))).toBe(true),
  );
  it('/shop redirects home (the homepage IS the shop)', () => {
    const html = page('shop/index.html');
    expect(html).toMatch(/(http-equiv="refresh"|content=".*url=\/)/i);
  });
});

describe('page contract', () => {
  it.each([
    ['index.html', 'pen on paper'],
    ['about/index.html', 'About'],
    ['404.html', 'Nothing here'],
  ])('%s has <main> and its h1', (p, h1) => {
    const html = page(p);
    expect(html).toContain('<main id="main"');
    expect(html).toMatch(new RegExp(`<h1[^>]*>[\\s\\S]*?${h1}[\\s\\S]*?</h1>`));
  });

  it('home is the store: category sections, hand-drawn frames, prices, announcement bar', () => {
    const html = page('index.html');
    for (const id of ['id="tees"', 'id="sweats"', 'id="prints"']) expect(html).toContain(id);
    expect(html).toContain('rough-frame');
    expect(html).toMatch(/\$\d+/);
    expect(html).toContain('class="announce');
  });

  it('nav links to about on every page; header cart button present', () => {
    for (const p of ['index.html', 'about/index.html']) {
      const html = page(p);
      expect(html).toContain('href="/about"');
      expect(html).toContain('data-cart-count');
    }
  });

  it('skip link and lang attribute present (a11y baseline)', () => {
    const html = page('index.html');
    expect(html).toContain('class="skip-link"');
    expect(html).toContain('<html lang="en"');
  });
});
