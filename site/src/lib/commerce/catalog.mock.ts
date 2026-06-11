// Placeholder catalog — §5 candidates, real Phase-2 art, old-store price anchors.
// Swapped for the live Fourthwall catalog when PUBLIC_COMMERCE_PROVIDER=fourthwall.
import type { Product } from './types';

const sizes = (base: number) =>
  ['S', 'M', 'L', 'XL'].map((s) => ({ id: s.toLowerCase(), label: s, price: base, available: true }));

const posterSizes = (base: number) => [
  { id: '12x18', label: '12×18″', price: base, available: true },
  { id: '18x24', label: '18×24″', price: base + 8, available: true },
];

const single = (price: number) => [{ id: 'one', label: 'One size', price, available: true }];

export const MOCK_CATALOG: Product[] = [
  {
    slug: 'alien-logo-tee',
    name: 'Alien Logo Tee',
    description:
      'The little guy who started it all. Big back print, chest hit on the front — drawn by hand, scribbles left in on purpose.',
    type: 'apparel', category: 'tees', era: 'og', price: 26,
    artSrc: '/art/alien.svg', artIsPhoto: false,
    lifestylePhoto: 'alien-tee-boat',
    marginNote: 'the logo himself',
    variants: sizes(26), available: true,
  },
  {
    slug: 'nine-eyes-tee',
    name: 'Nine Eyes Tee',
    description:
      'Nine hand-inked eyes in a grid, all looking somewhere slightly wrong. Our most-asked-about back print.',
    type: 'apparel', category: 'tees', era: 'og', price: 24,
    artSrc: 'photo:hero-nine-eyes-sunset', artIsPhoto: true,
    lifestylePhoto: 'hero-nine-eyes-sunset',
    marginNote: 'they’re watching',
    variants: sizes(24), available: true,
  },
  {
    slug: 'gold-swirl-tee',
    name: 'Gold Swirl Tee',
    description:
      'One continuous gold-and-black inkblot, like a thumbprint that got ambitious. No two stares at it are the same.',
    type: 'apparel', category: 'tees', era: 'og', price: 24,
    artSrc: 'photo:swirl-tee-lake', artIsPhoto: true,
    lifestylePhoto: 'swirl-tee-lake',
    variants: sizes(24), available: true,
  },
  {
    slug: 'fly-agaric-tee',
    name: 'Fly Agaric Tee',
    description:
      'A fly agaric mushroom in scientific-illustration stipple — thousands of dots, zero shortcuts.',
    type: 'apparel', category: 'tees', era: 'og', price: 24,
    artSrc: 'photo:mushroom-tee-sea', artIsPhoto: true,
    lifestylePhoto: 'mushroom-tee-sea',
    marginNote: 'dot by dot by dot',
    variants: sizes(24), available: true,
  },
  {
    slug: 'og-rabbit-hoodie',
    name: 'OG Rabbit Pink Hoodie',
    description:
      'The rabbit. The pink. The hoodie people kept asking about for four years. Back from 2020, exactly as weird as you remember.',
    type: 'apparel', category: 'sweats', era: 'og', price: 42,
    artSrc: '/art/rabbit-cameo.webp', artIsPhoto: false,
    marginNote: 'the OG — back from 2020',
    variants: sizes(42), available: true,
  },
  {
    slug: 'figure-2-poster',
    name: 'figure 2 — Poster Print',
    description:
      'Three melted figures in shades, standing on a field of pattern. Part of the figure series. True vector print, sharp at any size.',
    type: 'poster', category: 'prints', era: 'new', price: 24,
    artSrc: 'photo:figure-2-poster', artIsPhoto: true,
    marginNote: 'printed 10 min from my house',
    variants: posterSizes(24), available: true,
  },
  {
    slug: 'nine-heads-poster',
    name: 'The Nine Heads — Poster Print',
    description:
      'Nine ink heads, small to large, drawn in one sitting. The same lineup that draws itself on this site’s front door.',
    type: 'poster', category: 'prints', era: 'new', price: 26,
    artSrc: '/art/nine-heads.svg', artIsPhoto: false,
    marginNote: 'as seen on the homepage',
    variants: posterSizes(26), available: true,
  },
  {
    slug: 'stipple-rabbit-poster',
    name: 'OG Rabbit — Stipple Poster',
    description:
      'The rabbit rendered in pure pointillist ink. Yellow goggle eyes, chartreuse teeth, several thousand dots of patience.',
    type: 'poster', category: 'prints', era: 'new', price: 22,
    artSrc: '/art/rabbit-stipple.png', artIsPhoto: false,
    marginNote: 'printed locally in California',
    variants: posterSizes(22), available: true,
  },
  {
    slug: 'alien-sticker',
    name: 'Alien Sticker',
    description: 'Die-cut vinyl alien for laptops, water bottles, and questionable surfaces.',
    type: 'sticker', category: 'prints', era: 'new', price: 4,
    artSrc: '/art/alien.svg', artIsPhoto: false,
    variants: single(4), available: true,
  },
  {
    slug: 'mandala-creature-sticker',
    name: 'Mandala Creature Sticker',
    description: 'Four birds in shades, spinning forever. Matches the loading spinner — yes, on purpose.',
    type: 'sticker', category: 'prints', era: 'new', price: 4,
    artSrc: '/art/mandala.svg', artIsPhoto: false,
    marginNote: 'it spins (on the site)',
    variants: single(4), available: true,
  },
];
