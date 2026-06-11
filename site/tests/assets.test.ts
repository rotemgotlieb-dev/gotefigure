// §4.1 contract: every production asset exists, parses, and matches its animation class.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const art = (f: string) => join(__dirname, '..', 'public', 'art', f);
const read = (f: string) => readFileSync(art(f), 'utf8');

describe('production art exists and is non-trivial', () => {
  it.each(['silhouette.svg', 'nine-heads.svg', 'alien.svg', 'glyphs.svg',
           'rabbit-eyes.svg', 'mandala.svg', 'figure-2.svg', 'rabbit-stipple.png',
           'rabbit-cameo.webp', 'alien-textured.webp'])('%s', (f) => {
    expect(existsSync(art(f))).toBe(true);
    expect(statSync(art(f)).size).toBeGreaterThan(200); // floor catches silent optimizer wipes
  });
});

describe('animation-class contracts (§4.1)', () => {
  it('glyphs are STROKED (true DrawSVG class)', () => {
    const s = read('glyphs.svg');
    expect(s).toContain('stroke="currentColor"');
    expect(s).toContain('fill="none"');
  });
  it('silhouette is filled currentColor (mask-wipe class, recolorable)', () => {
    const s = read('silhouette.svg');
    expect(s).toContain('currentColor');
    expect(s).not.toContain('fill="none"');
  });
  it('rabbit eyes expose pupil ids for cursor tracking (§7.5)', () => {
    const s = read('rabbit-eyes.svg');
    for (const id of ['pupil-l', 'pupil-r', 'eye-l', 'eye-r']) expect(s).toContain(`id="${id}"`);
  });
  it('every svg keeps its viewBox (scaling contract)', () => {
    for (const f of ['silhouette.svg', 'nine-heads.svg', 'alien.svg', 'mandala.svg',
                     'figure-2.svg', 'glyphs.svg', 'rabbit-eyes.svg'])
      expect(read(f)).toContain('viewBox');
  });
});
