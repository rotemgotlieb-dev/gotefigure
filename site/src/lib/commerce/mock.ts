// Mock provider — placeholder catalog + a working local cart so the whole UX is real
// except payment. Cart ops run only in the browser (island); products at build time too.
import type { Cart, CommerceProvider, LineItem } from './types';
import { MOCK_CATALOG } from './catalog.mock';

const CART_KEY = 'gf-mock-cart';

const emptyCart = (token: string): Cart => ({ token, items: [], subtotal: 0 });

const recalc = (cart: Cart): Cart => ({
  ...cart,
  subtotal: Math.round(cart.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) * 100) / 100,
});

function load(token: string): Cart {
  if (typeof localStorage === 'undefined') return emptyCart(token);
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (raw) return JSON.parse(raw) as Cart;
  } catch { /* corrupted cart -> start fresh */ }
  return emptyCart(token);
}

function save(cart: Cart): Cart {
  if (typeof localStorage !== 'undefined') localStorage.setItem(CART_KEY, JSON.stringify(cart));
  return cart;
}

// variantId format used by the UI: "<slug>::<variant.id>"
function findVariant(variantId: string) {
  const [slug, vid] = variantId.split('::');
  const product = MOCK_CATALOG.find((p) => p.slug === slug);
  const variant = product?.variants.find((v) => v.id === vid);
  if (!product || !variant) throw new Error(`unknown variant: ${variantId}`);
  return { product, variant };
}

export const mockProvider: CommerceProvider = {
  async getProducts() {
    return MOCK_CATALOG;
  },
  async getProduct(slug) {
    return MOCK_CATALOG.find((p) => p.slug === slug) ?? null;
  },
  async createCart() {
    return save(emptyCart('mock'));
  },
  async getCart(token) {
    return recalc(load(token));
  },
  async addToCart(token, variantId, qty) {
    const cart = load(token);
    const { product, variant } = findVariant(variantId);
    const existing = cart.items.find((i) => i.variantId === variantId);
    if (existing) {
      existing.quantity += qty;
    } else {
      const line: LineItem = {
        lineId: `${variantId}@${cart.items.length}-${cart.items.reduce((m, i) => m + i.quantity, 0)}`,
        slug: product.slug,
        name: product.name,
        variantId,
        variantLabel: variant.label,
        unitPrice: variant.price,
        quantity: qty,
        artSrc: product.artSrc,
      };
      cart.items.push(line);
    }
    return save(recalc(cart));
  },
  async updateItem(token, lineId, qty) {
    const cart = load(token);
    if (qty <= 0) {
      cart.items = cart.items.filter((i) => i.lineId !== lineId);
    } else {
      const item = cart.items.find((i) => i.lineId === lineId);
      if (item) item.quantity = qty;
    }
    return save(recalc(cart));
  },
  async getCheckoutUrl() {
    return null; // mock mode: checkout not connected (honest UI state)
  },
};
