// Provider switch (§8.3 swap seam). PUBLIC_COMMERCE_PROVIDER=mock|fourthwall (default mock
// until the owner's real catalog is published - cutover steps: docs/INVENTORY-RUNBOOK.md §6).
// Part B wiring LANDED 2026-07-29: store.astro / piece/[id].astro / SatchelDrawer consume
// this seam (products, availability, checkout mode), so the mock-to-fourthwall flip is the
// env change + committed pin swap of runbook §6 Part C. vault.astro deliberately stays
// content-driven (an archive is not sellable inventory; docs/PRESALE-WINDOW-DESIGN.md).
import type { CommerceProvider } from './types';
import { mockProvider } from './mock';
import { fourthwallProvider } from './fourthwall';

const which = (import.meta.env.PUBLIC_COMMERCE_PROVIDER as string | undefined) || 'mock';

// Fail LOUDLY at build time (§5 fail-loudly ethos): a typo like "forthwall" or a missing
// storefront token must never silently ship the mock catalog as the "real" one. These
// throws now RUN in every build (the seam has importers since Part B); catalog-lint rules
// D/E/F (incl. the committed site/commerce.provider pin) stay the first net.
if (which !== 'mock' && which !== 'fourthwall') {
  throw new Error(
    `PUBLIC_COMMERCE_PROVIDER must be "mock" or "fourthwall", got "${which}" - see docs/INVENTORY-RUNBOOK.md`,
  );
}
if (which === 'fourthwall' && !import.meta.env.PUBLIC_FW_STOREFRONT_TOKEN) {
  throw new Error(
    'PUBLIC_COMMERCE_PROVIDER=fourthwall requires PUBLIC_FW_STOREFRONT_TOKEN - see docs/INVENTORY-RUNBOOK.md §6',
  );
}

export const commerce: CommerceProvider = which === 'fourthwall' ? fourthwallProvider : mockProvider;
export const isMockMode = which !== 'fourthwall';
export type { Product, Variant, Cart, LineItem, ProductType, Era } from './types';
export {
  windowPhase, purchasable, windowCopy, scarcityLine, dateLabel,
  type WindowPhase, type WindowConfig, type Pricing,
} from './window';
