// Build-time hand-drawn frame generation (research-validated: rough.js geometry beats
// SVG filters — zero client JS, zero filter rasterization, deterministic via seed).
// Each frame ships 3 wobble variants; the "boil" steps between them at ~6fps via a
// single class toggle (see animations/boil.ts). Stroke stays constant under stretch
// thanks to vector-effect + preserveAspectRatio="none".
import rough from 'roughjs';

const gen = rough.generator();

export interface FrameOpts {
  w?: number; h?: number;       // viewBox design size (stretches to fit)
  seed: number;                 // determinism — derive from slug/content
  roughness?: number;
  strokeWidth?: number;
  inset?: number;
}

/** 3 boil variants of a hand-drawn rectangle, as inline-SVG path data. */
export function roughRectPaths(opts: FrameOpts): string[][] {
  const { w = 300, h = 380, seed, roughness = 1.5, strokeWidth = 2, inset = 5 } = opts;
  return [0, 1, 2].map((i) => {
    const d = gen.rectangle(inset, inset, w - inset * 2, h - inset * 2, {
      seed: seed + i * 1013,
      roughness,
      strokeWidth,
      bowing: 1.2,
      preserveVertices: true,
      disableMultiStroke: false,
    });
    return gen.toPaths(d).map((p) => p.d);
  });
}

/** A hand-drawn horizontal rule (divider), 3 boil variants. */
export function roughLinePaths(seed: number, w = 600): string[][] {
  return [0, 1, 2].map((i) => {
    const d = gen.line(4, 8, w - 4, 8, { seed: seed + i * 977, roughness: 1.8, strokeWidth: 2, bowing: 2 });
    return gen.toPaths(d).map((p) => p.d);
  });
}

/** Stable small hash for seeds from strings. */
export function seedFrom(s: string): number {
  let h = 9;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x5f356495);
  return Math.abs(h % 100000) + 1;
}
