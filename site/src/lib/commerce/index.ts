// Provider switch (§8.3 swap seam). PUBLIC_COMMERCE_PROVIDER=mock|fourthwall (default mock
// until the owner's real catalog is published — see docs/superpowers/plans/2026-06-11-overnight-sprint.md).
import type { CommerceProvider } from './types';
import { mockProvider } from './mock';
import { fourthwallProvider } from './fourthwall';

const which = (import.meta.env.PUBLIC_COMMERCE_PROVIDER as string) || 'mock';

export const commerce: CommerceProvider = which === 'fourthwall' ? fourthwallProvider : mockProvider;
export const isMockMode = which !== 'fourthwall';
export type { Product, Variant, Cart, LineItem, ProductType, Era } from './types';
