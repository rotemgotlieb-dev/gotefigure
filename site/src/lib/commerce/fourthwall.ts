// Fourthwall Storefront API provider (§8.3). Verified live 2026-06-11:
// GET /v1/collections?storefront_token=...   -> { results: [{ slug, name, ... }] }
// GET /v1/collections/{slug}/products        -> { results: [Product...] }
// GET /v1/products/{slug}                    -> product by slug
// POST /v1/carts                              -> create cart
// Carts: POST /v1/carts/{id}/add, /v1/carts/{id}/change, GET /v1/carts/{id}
// Checkout: https://{shop-domain}/checkout/?cartCurrency=USD&cartId={id}
// NOTE: exact product/cart JSON shapes defensively parsed; re-validate when real
// products publish (see REPORT.md).
import type { Cart, CommerceProvider, Product, Variant } from './types';
import { OVERLAY } from './overlay';

const API = 'https://storefront-api.fourthwall.com/v1';
const TOKEN = import.meta.env.PUBLIC_FW_STOREFRONT_TOKEN as string;
const COLLECTION = (import.meta.env.PUBLIC_FW_COLLECTION as string) || 'all';
const CHECKOUT_DOMAIN = import.meta.env.PUBLIC_FW_CHECKOUT_DOMAIN as string | undefined;

async function fw(path: string, init?: RequestInit) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${API}${path}${sep}storefront_token=${TOKEN}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = new Error(`Fourthwall ${res.status} on ${path}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return res.json();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function money(m: any): number {
  if (typeof m === 'number') return m;
  if (m && typeof m.value === 'number') return m.value;
  if (m && typeof m.amount === 'number') return m.amount;
  return 0;
}

function mapProduct(raw: any): Product {
  const slug: string = raw.slug;
  const o = OVERLAY[slug] ?? {};
  const variants: Variant[] = (raw.variants ?? []).map((v: any) => ({
    id: v.id,
    label: v.name ?? v.title ?? 'One size',
    price: money(v.unitPrice ?? v.price),
    available: v.available !== false && v.stock?.type !== 'SoldOut',
  }));
  const firstImage: string | undefined = raw.images?.[0]?.url;
  return {
    slug,
    name: raw.name,
    description: raw.description ?? '',
    type: o.type ?? 'apparel',
    era: o.era ?? 'new',
    price: variants[0]?.price ?? money(raw.unitPrice),
    artSrc: o.artSvg ?? firstImage ?? '/art/alien.svg',
    artIsPhoto: o.artSvg ? false : true,
    lifestylePhoto: o.lifestylePhoto,
    marginNote: o.marginNote,
    variants,
    available: variants.some((v) => v.available),
  };
}

function mapCart(raw: any): Cart {
  const items = (raw.items ?? []).map((i: any, idx: number) => ({
    lineId: i.id ?? String(idx),
    slug: i.variant?.product?.slug ?? '',
    name: i.variant?.product?.name ?? i.variant?.name ?? 'Item',
    variantId: i.variant?.id ?? '',
    variantLabel: i.variant?.name ?? '',
    unitPrice: money(i.variant?.unitPrice),
    quantity: i.quantity ?? 1,
    artSrc: i.variant?.images?.[0]?.url ?? i.variant?.product?.images?.[0]?.url ?? '',
  }));
  return {
    token: raw.id,
    items,
    subtotal: items.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0),
  };
}

export const fourthwallProvider: CommerceProvider = {
  async getProducts() {
    // No list-all endpoint: list via the collection (§8.3)
    const data = await fw(`/collections/${COLLECTION}/products?size=100`);
    return (data.results ?? []).map(mapProduct);
  },
  async getProduct(slug) {
    try {
      const raw = await fw(`/products/${slug}`);
      return mapProduct(raw);
    } catch (e) {
      if ((e as { status?: number }).status === 404) return null;
      throw e;
    }
  },
  async createCart() {
    const raw = await fw(`/carts`, { method: 'POST', body: JSON.stringify({ items: [] }) });
    return mapCart(raw);
  },
  async getCart(token) {
    try {
      return mapCart(await fw(`/carts/${token}`));
    } catch (e) {
      if ((e as { status?: number }).status && (e as { status?: number }).status! < 500) return null; // expired/invalid -> discard (§8.2)
      throw e;
    }
  },
  async addToCart(token, variantId, qty) {
    const raw = await fw(`/carts/${token}/add`, {
      method: 'POST',
      body: JSON.stringify({ items: [{ variantId, quantity: qty }] }),
    });
    return mapCart(raw);
  },
  async updateItem(token, lineId, qty) {
    const raw = await fw(`/carts/${token}/change`, {
      method: 'POST',
      body: JSON.stringify({ items: [{ id: lineId, quantity: qty }] }),
    });
    return mapCart(raw);
  },
  async getCheckoutUrl(token) {
    if (!CHECKOUT_DOMAIN) return null;
    return `https://${CHECKOUT_DOMAIN}/checkout/?cartCurrency=USD&cartId=${token}`;
  },
};
