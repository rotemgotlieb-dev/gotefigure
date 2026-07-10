// Site-only product fields keyed by Fourthwall slug (§5 overlay contract).
// Used ONLY by the fourthwall provider; the mock catalog embeds these directly.
// PRICE IS NEVER SET HERE: the Fourthwall dashboard owns price truth (one source,
// no drift - docs/INVENTORY-RUNBOOK.md §3/§6). Era/type drive shop filters, card
// sizing, the cart sticker row, and the PDP provenance line.
//
// GUARDRAIL: scripts/catalog-lint.mjs BLOCKS the provider=fourthwall flip while any
// "UNVERIFIED" marker remains in this file. Delete each marker only when that piece's
// real price is confirmed in the Fourthwall dashboard from the written Vibe quote.
import type { Category, Era, ProductType } from './types';

export interface OverlayEntry {
  type?: ProductType;
  category?: Category;
  era?: Era;
  marginNote?: string;
  artSvg?: string;        // path under /art/ - when present, replaces the FW image as card face
  lifestylePhoto?: string;
}

export const OVERLAY: Record<string, OverlayEntry> = {
  // 'real-fourthwall-slug': { type: 'apparel', era: 'og', marginNote: '...', artSvg: '/art/alien.svg' },

  // ── PLANNED DROP-ONE PIECES - TEMPLATE ONLY, all line-commented = excluded from render.
  // Uncomment an entry ONLY after: (a) its Fourthwall product is PUBLISHED, (b) the entry
  // key is replaced with the REAL Fourthwall slug, (c) its price is set in the Fourthwall
  // dashboard from Vibe Embroidery's WRITTEN quote, (d) its UNVERIFIED marker below is
  // deleted. Directional price targets exist in the vault (Projects/GoteFigure.md,
  // 2026-07-08) but are deliberately not written here - no invented prices in the repo.

  // 1. Hero screen-print tee - figure-2 flagship, front + back print, MADE-TO-ORDER via
  //    the ~2-week pre-order window (vault decision 2026-07-08). Art source: `figure 2.pdf`
  //    (print-ready vector, §5).
  // price: OWNED BY FOURTHWALL DASHBOARD /* UNVERIFIED - Vibe quote pending */
  // 'TODO-real-fw-slug-hero-figure-2-tee': {
  //   type: 'apparel',
  //   category: 'tees',
  //   era: 'new',
  //   marginNote: 'made to order - ships 2-4 weeks after the window closes',
  //   artSvg: '/art/v3/…',  // TODO: figure-2 site art export
  // },

  // 2. Embroidered hat - one colorway, one-size, HELD STOCK ~15-25 (the only held-inventory
  //    piece in drop one; vault decision 2026-07-08).
  // price: OWNED BY FOURTHWALL DASHBOARD /* UNVERIFIED - Vibe quote pending */
  // 'TODO-real-fw-slug-embroidered-hat': {
  //   type: 'apparel',
  //   category: 'hats',   // CATEGORY_LABELS already ships 'hats' for exactly this day
  //   era: 'new',
  //   marginNote: 'embroidered in Tracy, CA',
  //   artSvg: '/art/v3/…',  // TODO: hat art export
  // },

  // 3-6. The 4 Fourthwall DRAFT products - NAMED DEPENDENCY on Rotem: their names/slugs are
  //    recorded nowhere in this repo or its research (REPORT.md, research/,
  //    .storefront_research - checked 2026-07-10). Publish the drafts, then replace these
  //    four keys with the real slugs and fill the fields.
  //    Type/category/era below are NOT guessed - fill them from the real products.
  // price: OWNED BY FOURTHWALL DASHBOARD /* UNVERIFIED - Vibe quote pending */
  // 'TODO-fw-draft-slug-1': { /* type: …, category: …, era: … */ },
  // 'TODO-fw-draft-slug-2': { /* type: …, category: …, era: … */ },
  // 'TODO-fw-draft-slug-3': { /* type: …, category: …, era: … */ },
  // 'TODO-fw-draft-slug-4': { /* type: …, category: …, era: … */ },
};
