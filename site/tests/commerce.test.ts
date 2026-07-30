// Commerce adapter contract tests (§8.3). Mock provider = full behavior over the DERIVED
// two-shirt catalog (pieces.json is the one truth, docs/PRESALE-WINDOW-DESIGN.md);
// Fourthwall provider = mapping logic against recorded API shapes.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockProvider } from '../src/lib/commerce/mock';
import { buildCatalog } from '../src/lib/commerce/catalog';
import piecesJson from '../src/content/pieces.json';
import dropJson from '../src/content/drop.json';

// jsdom-free localStorage stub
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

beforeEach(() => store.clear());

describe('derived catalog integrity (the two-shirt truth)', () => {
  const catalog = buildCatalog();

  it('carries exactly the pieces.json pieces, in order (one truth, no drift)', () => {
    expect(catalog.map((p) => p.slug)).toEqual(piecesJson.pieces.map((p) => p.id));
    expect(catalog.map((p) => p.name)).toEqual(piecesJson.pieces.map((p) => p.name));
  });

  it('drop 1 is exactly two shirts at the decided list price (GoteFigure.md:27)', () => {
    expect(catalog).toHaveLength(2);
    expect(catalog.map((p) => p.slug).sort()).toEqual(['mushroom-tee', 'rabbit-tee']);
    for (const p of catalog) {
      expect(p.type).toBe('apparel');
      expect(p.price).toBe(40);
    }
    expect((dropJson as { pricing: { list: number; waitlist: number } }).pricing).toEqual({ list: 40, waitlist: 35 });
  });

  it('every product has variants, art, and a price matching its first variant', () => {
    for (const p of catalog) {
      expect(p.variants.length).toBeGreaterThan(0);
      expect(p.artSrc).toBeTruthy();
      expect(p.price).toBe(p.variants[0].price);
    }
  });

  it('variants are the per-piece size run (S-XL, lowercased ids)', () => {
    for (const p of catalog) {
      expect(p.variants.map((v) => v.label)).toEqual(['S', 'M', 'L', 'XL']);
      expect(p.variants.map((v) => v.id)).toEqual(['s', 'm', 'l', 'xl']);
    }
  });

  it('honest pre state: window unset means nothing is purchasable', () => {
    // drop.json ships with a null window until Rotem picks T-0; the derived catalog must
    // say so rather than pretend a live store. Phase-boundary coverage lives in window.test.ts.
    const w = (dropJson as { window: { opensAt: string | null } }).window;
    if (w.opensAt === null) {
      for (const p of catalog) {
        expect(p.available).toBe(false);
        for (const v of p.variants) expect(v.available).toBe(false);
      }
    }
  });

  it('carries no numeric scarcity fields (counts live in Fourthwall, WNM Plan line 87)', () => {
    expect(dropJson).not.toHaveProperty('editionSize');
    expect(dropJson).not.toHaveProperty('dropLeft');
    for (const raw of piecesJson.pieces) {
      expect(raw).not.toHaveProperty('editionSize');
      expect(raw).not.toHaveProperty('stockCount');
      expect(typeof raw.soldOut).toBe('boolean');
    }
  });
});

describe('mock cart behavior', () => {
  it('add then getCart roundtrip with correct subtotal', async () => {
    await mockProvider.createCart();
    await mockProvider.addToCart('mock', 'mushroom-tee::m', 2);
    const cart = await mockProvider.getCart('mock');
    expect(cart!.items).toHaveLength(1);
    expect(cart!.subtotal).toBe(80);
  });
  it('adding same variant twice merges the line', async () => {
    await mockProvider.createCart();
    await mockProvider.addToCart('mock', 'rabbit-tee::l', 1);
    const cart = await mockProvider.addToCart('mock', 'rabbit-tee::l', 2);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(3);
  });
  it('updateItem qty 0 removes the line', async () => {
    await mockProvider.createCart();
    const cart = await mockProvider.addToCart('mock', 'mushroom-tee::s', 1);
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
