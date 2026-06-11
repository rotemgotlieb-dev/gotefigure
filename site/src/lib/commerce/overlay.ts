// Site-only product fields keyed by Fourthwall slug (§5 overlay contract).
// Used ONLY by the fourthwall provider; the mock catalog embeds these directly.
// When real products publish: add one entry per slug. Era/type drive shop filters,
// card sizing, the cart sticker row, and the PDP provenance line.
import type { Era, ProductType } from './types';

export interface OverlayEntry {
  type?: ProductType;
  era?: Era;
  marginNote?: string;
  artSvg?: string;        // path under /art/ — when present, replaces the FW image as card face
  lifestylePhoto?: string;
}

export const OVERLAY: Record<string, OverlayEntry> = {
  // 'real-fourthwall-slug': { type: 'apparel', era: 'og', marginNote: '...', artSvg: '/art/alien.svg' },
};
