// The mock provider's catalog, DERIVED from content/pieces.json + the window phase so there
// is exactly ONE catalog truth pre-cutover (docs/PRESALE-WINDOW-DESIGN.md). The old 10-item
// placeholder catalog.mock.ts retired with the two-shirt cut; keeping it would have been a
// second truth that drifts. After the Fourthwall flip, product truth moves to the FW
// dashboard and this file stops mattering (the pin + catalog-lint rule F police that).
import { currentPhase, pieces, type Piece } from '../drop';
import { purchasable } from './window';
import type { Product, Variant } from './types';

function toProduct(p: Piece, nowMs: number): Product {
  const buyable = purchasable(currentPhase(nowMs), p.soldOut);
  const variants: Variant[] = (p.sizes.length ? p.sizes : ['One size']).map((s) => ({
    id: s.toLowerCase().replace(/\s+/g, '-'),
    label: s,
    price: p.price,
    available: buyable,
  }));
  return {
    slug: p.id,
    name: p.name,
    description: p.desc,
    type: 'apparel',
    category: 'tees',
    era: 'og', // both drop-1 shirts are 2020 classics pulled back from the vault
    price: p.price,
    artSrc: p.art,
    artIsPhoto: false,
    marginNote: p.note,
    variants,
    available: buyable,
  };
}

/** Build the derived catalog. Phase-dependent, so callers pass a time or accept "now". */
export function buildCatalog(nowMs: number = Date.now()): Product[] {
  return pieces.map((p) => toProduct(p, nowMs));
}
