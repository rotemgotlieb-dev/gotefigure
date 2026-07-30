// Fourthwall checkout bridge: maps satchel rows (piece id + size label) to live FW variants
// and returns the hosted-checkout URL. Loaded ONLY via dynamic import when the drawer's
// server-rendered data-provider says "fourthwall", so this chunk never ships catalog
// literals (the public-artifact tripwire stays meaningful) and the mock build never runs it.
//
// PENDING-VERIFY: no real Fourthwall products exist yet (provider pin = mock), so this path
// is exercised only at the unit level against the recorded API shapes in fourthwall.ts.
// Re-validate on real published products at runbook §6 Part C, before any flip.
import { fourthwallProvider } from './fourthwall';
import type { SatchelRow } from '../satchel';

/**
 * Build a Fourthwall cart from the satchel and return the hosted checkout URL.
 * Throws (fail LOUD, never a fake success) when a piece or size has no live variant.
 */
export async function sealViaFourthwall(rows: SatchelRow[]): Promise<string | null> {
  if (!rows.length) return null;
  const products = await fourthwallProvider.getProducts();
  const cart = await fourthwallProvider.createCart();
  for (const r of rows) {
    const product = products.find((p) => p.slug === r.id);
    if (!product) throw new Error(`checkout: "${r.id}" is not in the live catalog`);
    const variant = r.size
      ? product.variants.find((v) => v.label.toLowerCase() === r.size!.toLowerCase())
      : product.variants[0];
    if (!variant || !variant.available) {
      throw new Error(`checkout: size ${r.size ?? '(one size)'} of "${r.id}" is not available`);
    }
    await fourthwallProvider.addToCart(cart.token, variant.id, r.qty);
  }
  return fourthwallProvider.getCheckoutUrl(cart.token);
}
