// Site presentation + owner-config loaders. Commerce truth (price, variants, availability)
// now flows through the provider seam (lib/commerce, docs/PRESALE-WINDOW-DESIGN.md); this
// module keeps the presentation fields (placard voice, art crops, underline squiggles), the
// vault archive, and the validated window config.
//
// PHASE IS PER REQUEST: gated pages run on the Worker (prerender = false); call
// currentPhase() in frontmatter, never cache it at module scope (a long-lived isolate must
// not serve a stale phase across the opensAt/closesAt boundary).
import dropJson from '../content/drop.json';
import piecesJson from '../content/pieces.json';
import vaultJson from '../content/vault.json';
import {
  validatePricing,
  validateWindowConfig,
  windowPhase,
  type Pricing,
  type WindowConfig,
  type WindowPhase,
} from './commerce/window';

export interface PieceSizeRow { size: string; width: number; length: number; }

export interface Piece {
  id: string;
  name: string;
  kind: string;
  kindShort: string;
  price: number;
  art: string;
  artW: string;
  tileArtMax: string;
  sized: boolean;
  category: 'wear' | 'paper';
  hero?: boolean;
  original?: boolean;
  desc: string;
  meta: string;
  note: string;
  underline: string;
  sizes: string[];
  fitNote: string;
  sizing: PieceSizeRow[];
  soldOut: boolean;
}

export interface VaultPiece { id: string; img: string; name: string; sub: string; }

// Validated at module load: a dishonest owner edit fails the BUILD, loudly.
export const windowConfig: WindowConfig = validateWindowConfig((dropJson as { window?: unknown }).window);
export const pricing: Pricing = validatePricing((dropJson as { pricing?: unknown }).pricing);

/** The current window phase. Call per request; do not cache the result. */
export const currentPhase = (nowMs: number = Date.now()): WindowPhase => windowPhase(windowConfig, nowMs);

export const pieces = piecesJson.pieces as Piece[];
export const pieceById = (id: string) => pieces.find((p) => p.id === id);
export const heroPiece = (): Piece => pieces.find((p) => p.hero) ?? pieces[0];

/** Categories that actually contain pieces; tabs render only for these (types.ts law). */
export const presentCategories = (): Array<Piece['category']> =>
  [...new Set(pieces.map((p) => p.category))];

export const vault = vaultJson.pieces as VaultPiece[];
export const vaultStrip = vaultJson.strip
  .map((id) => vault.find((v) => v.id === id))
  .filter(Boolean) as VaultPiece[];

export const money = (n: number) => `$${n}`;
