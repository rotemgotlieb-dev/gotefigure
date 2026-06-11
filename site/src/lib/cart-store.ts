// Client-side cart store (§8.2 token hygiene). Single source of cart truth in the browser;
// UI pieces (header count, drawer, PDP button) listen to document events:
//   gf:cart   { detail: Cart }      — state changed
//   gf:busy   { detail: boolean }   — async in flight (waiting rabbit)
//   gf:error  { detail: string }    — honest failure (inline retry UI, not the rabbit)
import { commerce, isMockMode, type Cart } from './commerce';

const TOKEN_KEY = 'gf-cart-token';
let cart: Cart | null = null;
let initd = false;

const emit = (name: string, detail: unknown) =>
  document.dispatchEvent(new CustomEvent(name, { detail }));

const setBusy = (b: boolean) => emit('gf:busy', b);
const publish = () => emit('gf:cart', cart);

async function withBusy<T>(fn: () => Promise<T>): Promise<T | undefined> {
  setBusy(true);
  try {
    return await fn();
  } catch (e) {
    emit('gf:error', e instanceof Error ? e.message : 'something went sideways');
    return undefined;
  } finally {
    setBusy(false);
  }
}

export async function initCart(): Promise<Cart | null> {
  if (initd) return cart;
  initd = true;
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    cart = await commerce.getCart(token).catch(() => null);
    if (!cart) localStorage.removeItem(TOKEN_KEY); // expired/invalid -> discard (§8.2)
  }
  publish();
  return cart;
}

async function ensureCart(): Promise<Cart> {
  if (cart) return cart;
  cart = await commerce.createCart();
  localStorage.setItem(TOKEN_KEY, cart.token);
  return cart;
}

export async function add(variantId: string, qty = 1) {
  await withBusy(async () => {
    const c = await ensureCart();
    cart = await commerce.addToCart(c.token, variantId, qty);
  });
  publish();
}

export async function update(lineId: string, qty: number) {
  if (!cart) return;
  await withBusy(async () => {
    cart = await commerce.updateItem(cart!.token, lineId, qty);
  });
  publish();
}

export async function checkout(): Promise<void> {
  if (!cart || cart.items.length === 0) return;
  const url = await withBusy(() => commerce.getCheckoutUrl(cart!.token));
  if (url) {
    localStorage.removeItem(TOKEN_KEY); // Fourthwall owns the cart from here (§8.2)
    window.location.href = url;
  }
}

export function getCartSync(): Cart | null {
  return cart;
}

export const mockMode = isMockMode;
