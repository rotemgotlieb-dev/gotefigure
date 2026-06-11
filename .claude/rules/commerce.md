# Commerce rules (spec §8.3, §8.2, §5)

- ALL commerce via src/lib/commerce/ adapter: getProducts(), getProduct(handle), createCart(),
  getCart(token), addToCart(token, variantId, qty), updateItem(token, lineId, qty) [qty 0 = remove],
  getCheckoutUrl(token). Neutral types Product/Variant/Cart/LineItem. No Fourthwall types
  escape the directory.
- Fourthwall reality: NO list-all-products endpoint — getProducts = List Collections →
  Get Collection Products; PDP = Get Product by Slug; auth = storefront_token query param.
- Cart token: localStorage; validate via getCart() on island init; discard on 4xx; clear when
  checkout CTA fires. API failures → honest inline retry, not the loading rabbit (§8.2).
- Overlay (src/content/overlay/products.json): keyed by Fourthwall slug; required type
  (apparel|poster|sticker) + era (og|new); build FAILS LOUDLY on unmatched key (§5).
- Checkout is Fourthwall-hosted. Card data never touches our code (§9).
