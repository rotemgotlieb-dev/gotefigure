// Commerce adapter contract tests (§8.3). Mock provider = full behavior;
// Fourthwall provider = mapping logic against recorded API shapes.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockProvider } from '../src/lib/commerce/mock';
import { MOCK_CATALOG } from '../src/lib/commerce/catalog.mock';

// jsdom-free localStorage stub
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

beforeEach(() => store.clear());

describe('mock catalog integrity', () => {
  it('has ≥9 products covering all three types and both eras', () => {
    expect(MOCK_CATALOG.length).toBeGreaterThanOrEqual(9);
    for (const t of ['apparel', 'poster', 'sticker'])
      expect(MOCK_CATALOG.some((p) => p.type === t)).toBe(true);
    for (const e of ['og', 'new'])
      expect(MOCK_CATALOG.some((p) => p.era === e)).toBe(true);
  });
  it('every product has variants, art, and a price matching its first variant', () => {
    for (const p of MOCK_CATALOG) {
      expect(p.variants.length).toBeGreaterThan(0);
      expect(p.artSrc).toBeTruthy();
      expect(p.price).toBe(p.variants[0].price);
    }
  });
});

describe('mock cart behavior', () => {
  it('add → getCart roundtrip with correct subtotal', async () => {
    await mockProvider.createCart();
    await mockProvider.addToCart('mock', 'alien-logo-tee::m', 2);
    const cart = await mockProvider.getCart('mock');
    expect(cart!.items).toHaveLength(1);
    expect(cart!.subtotal).toBe(52);
  });
  it('adding same variant twice merges the line', async () => {
    await mockProvider.createCart();
    await mockProvider.addToCart('mock', 'alien-sticker::one', 1);
    const cart = await mockProvider.addToCart('mock', 'alien-sticker::one', 2);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(3);
  });
  it('updateItem qty 0 removes the line', async () => {
    await mockProvider.createCart();
    const cart = await mockProvider.addToCart('mock', 'figure-2-poster::12x18', 1);
    const after = await mockProvider.updateItem('mock', cart.items[0].lineId, 0);
    expect(after.items).toHaveLength(0);
    expect(after.subtotal).toBe(0);
  });
  it('checkout url is null in mock mode (honest placeholder state)', async () => {
    expect(await mockProvider.getCheckoutUrl('mock')).toBeNull();
  });
  it('unknown variant throws loudly', async () => {
    await expect(mockProvider.addToCart('mock', 'nope::nope', 1)).rejects.toThrow(/unknown variant/);
  });
});

describe('fourthwall provider mapping', () => {
  it('maps a collection products response through the overlay', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        results: [{
          slug: 'real-tee',
          name: 'Real Tee',
          description: 'desc',
          images: [{ url: 'https://cdn.fw/img.jpg' }],
          variants: [
            { id: 'v1', name: 'M', unitPrice: { value: 25 }, available: true },
            { id: 'v2', name: 'L', unitPrice: { value: 25 }, available: false },
          ],
        }],
      }),
    })) as unknown as typeof fetch);
    const { fourthwallProvider } = await import('../src/lib/commerce/fourthwall');
    const products = await fourthwallProvider.getProducts();
    expect(products).toHaveLength(1);
    expect(products[0].slug).toBe('real-tee');
    expect(products[0].price).toBe(25);
    expect(products[0].artIsPhoto).toBe(true);
    expect(products[0].available).toBe(true);
    expect(products[0].variants[1].available).toBe(false);
  });
});
