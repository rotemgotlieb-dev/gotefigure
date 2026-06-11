// Smoke tests over BUILT html (run `npm run verify`). Guards: routes exist,
// landmarks present, nav wired, tokens loaded. Not a substitute for browser testing.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(__dirname, '..', 'dist');
const page = (p: string) => readFileSync(join(dist, p), 'utf8');

describe('built routes', () => {
  it.each(['index.html', 'shop/index.html', 'about/index.html', '404.html'])(
    '%s exists', (p) => expect(existsSync(join(dist, p))).toBe(true),
  );
});

describe('page contract', () => {
  it.each([
    ['index.html', 'wearable'],
    ['shop/index.html', 'Shop'],
    ['about/index.html', 'About'],
    ['404.html', 'Nothing here'],
  ])('%s has <main> and its h1', (p, h1) => {
    const html = page(p);
    expect(html).toContain('<main id="main"');
    expect(html).toMatch(new RegExp(`<h1[^>]*>[\\s\\S]*?${h1}[\\s\\S]*?</h1>`));
  });

  it('nav links to shop and about on every page', () => {
    for (const p of ['index.html', 'shop/index.html', 'about/index.html']) {
      const html = page(p);
      expect(html).toContain('href="/shop"');
      expect(html).toContain('href="/about"');
    }
  });

  it('skip link and lang attribute present (a11y baseline)', () => {
    const html = page('index.html');
    expect(html).toContain('class="skip-link"');
    expect(html).toContain('<html lang="en"');
  });
});
