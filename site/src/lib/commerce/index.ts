// Provider switch (§8.3 swap seam). PUBLIC_COMMERCE_PROVIDER=mock|fourthwall (default mock
// until the owner's real catalog is published - cutover steps: docs/INVENTORY-RUNBOOK.md §6).
// TRUTH CALLOUT (R2-S4, 2026-07-10): the live V3 store (store.astro / piece/[id].astro /
// satchel.ts) does NOT consume this seam yet - it renders src/content/*.json via lib/drop.ts.
// Flipping this env var alone does not change what visitors see; the cutover includes a
// wiring step (runbook §6 Part B).
import type { CommerceProvider } from './types';
import { mockProvider } from './mock';
import { fourthwallProvider } from './fourthwall';

const which = (import.meta.env.PUBLIC_COMMERCE_PROVIDER as string | undefined) || 'mock';

// Fail LOUDLY at build time (§5 fail-loudly ethos): a typo like "forthwall" or a missing
// storefront token must never silently ship the mock catalog as the "real" one.
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
