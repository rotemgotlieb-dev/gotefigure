# Pre-sale window mechanics: design decision note

Written 2026-07-29 (W2 backend lane), BEFORE implementation, per the sprint contract.
Everything here builds against decisions already on Rotem's record; nothing re-litigates them.

## Decisions of record this encodes

| Decision | Source |
|---|---|
| Drop 1 sells exactly two shirts: mushroom tee + rabbit tee | Rotem verbatim 2026-07-25 |
| $40 list, $35 waitlist ("if you join the waitlist, you get it for $35", loud, never percent-off) | vault Projects/GoteFigure.md line 27 (2026-07-23) |
| Pre-sale window T-0 through T+13; pay-upfront; sales engine, not a production gate (committed-GO) | vault Projects/GoteFigure.md (2026-07-23) |
| Post-window: remaining stock sells at $40 until gone, THEN vault; sold-out copy only when true | vault Projects/GoteFigure.md (2026-07-23) |
| NO countdown widgets, ever | vault WNM Plan line 85 (research-backed) |
| NO live numeric stock count on the site for drop 1; Fourthwall per-size caps carry scarcity | vault WNM Plan line 87 (2026-07-25) |
| CC1717 sizing table + runs-small note on PDPs | vault WNM Plan line 84 (numbers are reseller-published, official spec confirm owed at the WNM visit) |
| Stickers stay OUT of the catalog | Rotem (SKU call still his) |

## The model

**Config** (`src/content/drop.json`, the owner control surface):

```json
{
  "window":  { "opensAt": null, "closesAt": null },
  "pricing": { "list": 40, "waitlist": 35 }
}
```

- Dates are ISO-8601 with an explicit offset (America/Los_Angeles). Both null today: T-0 is
  honestly unpicked (the production lane is unconfirmed until the WNM visit). When Rotem picks
  T-0 he sets BOTH; the decided length is 14 days (T-0 through T+13).
- Validation fails the build loudly: `opensAt` without `closesAt`, unparseable dates, or
  `closesAt <= opensAt` throw at module load (fail-loud ethos, same as the provider seam).

**Three phases** (`src/lib/commerce/window.ts`, pure, unit-tested):

| Phase | When | Store behavior |
|---|---|---|
| `pre` | `opensAt` null, or now < opensAt | Nothing purchasable. Waitlist capture is the page's one CTA, framed exactly as decided: join the waitlist, get it for $35. If a date exists it is shown as a plain date, never a ticking widget. |
| `open` | opensAt <= now < closesAt | Pre-order at $40 list; the waitlist line stays loud; close date shown as a plain date. |
| `post` | now >= closesAt | Sells what remains at $40. Sold-out state comes from a per-piece boolean `soldOut` flag in `pieces.json`, flipped by the owner (post-cutover, by Fourthwall stock). Copy claims "sold out / vaulted" ONLY when that flag is true. |

- **Phase is computed per request** in page frontmatter (`prerender = false` pages run on the
  Worker), never cached at module scope: a long-lived isolate must not serve a stale phase
  across the opensAt boundary.
- **No numeric scarcity anywhere.** The old `editionSize`/`dropLeft` fields (a hardcoded lie:
  live/50/31 with no orders wired) are deleted, not migrated. WNM Plan line 87: a second count
  truth that can disagree with the first is worse than none.
- **No countdowns.** The `animations/countdown.ts` module and its markup are removed with the
  fields that fed them. The module's own "ethics floor" comment was already uneasy about this;
  the owner decision settles it.

## Catalog truth and the provider seam

- `content/pieces.json` is the ONE catalog truth pre-cutover: the two real shirts at the
  decided $40, with CC1717 sizing data and the runs-small fit note. The 5 demo SKUs are
  deleted, not kept as dead entries.
- The 10-item placeholder `lib/commerce/catalog.mock.ts` retires. The mock provider now
  DERIVES its `Product[]` from `pieces.json` + the window phase (`lib/commerce/catalog.ts`),
  so the store pages can consume the seam without a second catalog that can drift.
- Store pages (`store.astro`, `piece/[id].astro`) render commerce truth (name, price,
  variants, availability) from `commerce.getProducts()` / `getProduct(slug)`; presentation
  fields (art crop widths, placard voice, underline squiggles) stay site-side keyed by slug.
  After the Fourthwall flip the same join runs against real FW slugs via `overlay.ts`,
  exactly as `docs/INVENTORY-RUNBOOK.md` section 6 already specifies.
- `vault.astro` deliberately does NOT move to the seam (a refinement of runbook section 6
  Part B): the vault is a sold-out archive, not sellable inventory; no provider will ever
  carry those pieces, and wiring them through one would force inventing products.
- Checkout: the satchel stays the cart UI. On seal, the drawer reads a server-rendered
  `data-provider` flag; in mock mode the existing ritual runs unchanged, in fourthwall mode a
  dynamically imported bridge (`lib/commerce/checkout-fourthwall.ts`) maps satchel rows to
  live FW variants and redirects to hosted checkout, failing LOUD (visible error, no fake
  "sealed" state) if the catalog or a size is missing. The bridge chunk contains zero
  catalog literals, so the public-artifact leak tripwire keeps holding.
- The provider pin stays `mock`. Zero real-provider calls happen in this build; the FW path
  is code plus unit-level mapping only, honestly tiered PENDING-VERIFY until real products
  exist.

## Honesty repairs this build makes (found while wiring, same class as prior costed lessons)

1. `store-ui.ts` faked the store notify/subscribe forms (success state only, stored
   nothing). That is the third instance of the silent email-loss class this repo already
   paid for twice (After Hours, /about). With the waitlist now carrying the $35 promise,
   both store forms wire to the real `/api/subscribe` boundary (shared
   `email-capture.ts` helpers, `source: 'drops'`, Turnstile + honeypot, done-state only on a
   true `{ok:true}`).
2. Unverified promises leave the copy: "free US shipping", "30-day size swaps", and the
   drawer's "shipping free (US)" line claim policies nobody has decided (the M8 shipping
   pack and the exchange policy are open vault items). They are removed or replaced with
   neutral truth, and the policy decision stays flagged for Rotem.
3. `store-ui.ts` hardcoded the hero add-to-bag to piece id `'tee'`; it now reads the hero
   product from the page.

## Sizing data provenance

The PDP table ships the CC1717 measurements staged in the vault 2026-07-23 (width x length,
S 18.25x26.6 / M 20.25x28 / L 22x29.4 / XL 24x30.75), which are RESELLER-PUBLISHED numbers,
consistent across CC1717 reseller size pages, with the official spec-sheet confirmation owed
at the WNM visit. The runs-small note ships next to the table as decided. The orderable size
set (S-XL, no XS since CC1717 has none, 2XL not offered) is flagged for Rotem's ratification.
