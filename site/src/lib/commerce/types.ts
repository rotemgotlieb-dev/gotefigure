// Neutral commerce domain types (§8.3). No provider types leak past this directory.

export type ProductType = 'apparel' | 'poster' | 'sticker';
export type Era = 'og' | 'new';
// Owner's store categories (2026-06-11): one store, category-led. Categories render
// only when they contain products — 'hats' exists for the day embroidered hats land.
export type Category = 'tees' | 'sweats' | 'hats' | 'prints';
export const CATEGORY_LABELS: Record<Category, string> = {
  tees: 'Tees',
  sweats: 'Sweatshirts & Jackets',
  hats: 'Hats',
  prints: 'Prints & Stickers',
};

export interface Variant {
  id: string;
  label: string;          // "M", "18×24″", "Vinyl"
  price: number;          // USD
  available: boolean;
}

export interface Product {
  slug: string;
  name: string;
  description: string;
  type: ProductType;
  category: Category;
  era: Era;
  price: number;          // base/from price, USD
  artSrc: string;         // card face (site art or product image)
  artIsPhoto: boolean;    // photo faces get different card treatment than flat art
  lifestylePhoto?: string;
  marginNote?: string;    // handwritten-voice annotation (§3.2)
  variants: Variant[];
  available: boolean;
}

export interface LineItem {
  lineId: string;
  slug: string;
  name: string;
  variantId: string;
  variantLabel: string;
  unitPrice: number;
  quantity: number;
  artSrc: string;
}

export interface Cart {
  token: string;
  items: LineItem[];
  subtotal: number;
}

export interface CommerceProvider {
  getProducts(): Promise<Product[]>;
  getProduct(slug: string): Promise<Product | null>;
  createCart(): Promise<Cart>;
  getCart(token: string): Promise<Cart | null>;
  addToCart(token: string, variantId: string, qty: number): Promise<Cart>;
  updateItem(token: string, lineId: string, qty: number): Promise<Cart>; // qty 0 = remove
  getCheckoutUrl(token: string): Promise<string | null>; // null = checkout not available (mock mode)
}
