# INVENTORY RUNBOOK - how to change what the store sells

*Fable R2 Sprint S4, 2026-07-10. Branch `r2-s4-catalog`. Every scenario below names the system
that OWNS the truth, the exact steps, and the one deploy command. Scenario 4 was run
end-to-end (edit, build, observed render at 1280x800 + 390x844, revert) on 2026-07-10;
the other JSON scenarios use the identical mechanism (build-time JSON, rebuild, deploy).*

## 0. The truth map (read this first)

The repo contains TWO catalog systems. Know which one you are editing.

| System | Files | Who renders it | Status |
|---|---|---|---|
| **V3 drop catalog** | `site/src/content/pieces.json` + `drop.json` + `vault.json` + `drops.json`, loaded by `site/src/lib/drop.ts` | `store.astro`, `piece/[id].astro`, `vault.astro`, `SatchelDrawer`, `ProductTile` | **LIVE. This is what visitors see.** |
| **Commerce swap seam** | `site/src/lib/commerce/*` (mock provider + Fourthwall provider + `overlay.ts`), switched by `PUBLIC_COMMERCE_PROVIDER` | Nothing on the live pages. Its only consumers, `CartDrawer.astro` and `ProductCard.astro`, are orphaned (zero imports) | Dormant. Built and tested, waiting for the Fourthwall cutover |

**Truth callout (2026-07-10):** the ask "flip `PUBLIC_COMMERCE_PROVIDER` and the site serves
the real catalog" is NOT true today. The env switch in `site/src/lib/commerce/index.ts` works,
but the live V3 pages read `content/*.json` via `lib/drop.ts` and never touch the provider.
The real cutover is scenario 6 and has a wiring step in it. Until then, every inventory change
is a JSON edit + deploy.

**Access note:** `/store`, `/piece/*`, and `/vault` sit behind the Sprint-2 hard gate
(signed HttpOnly cookie from `POST /api/gate`) PLUS a client-side pre-paint bounce
(`Layout.astro` kicks to `/` unless `localStorage['gf-store-open']` is set; the After Hours
door sets both after a correct code). To SEE a change you must pass the gate first. Locally
the code is in `site/.dev.vars` (`GATE_CODE`).

**Routing note (S4 catch):** the gated routes are listed in `wrangler.jsonc`
`assets.run_worker_first`. Without that list, browser NAVIGATIONS (Sec-Fetch-Mode: navigate)
to any prerender=false route are answered by the static 404 page and the Worker never runs -
curl passes while every real browser 404s. If you add a new server-rendered route, add it to
that list or it will not exist for visitors.

**The one deploy command (all scenarios):**

```sh
cd site && npm run deploy
```

That runs `catalog-lint` (blocks bad catalog states), `astro build`, `wrangler deploy` - in
that order, failing fast. CI equivalent: push to `main` runs `npm run verify` (lint + build +
tests) then a secrets-gated `wrangler deploy` (`.github/workflows/deploy.yml`).

**After every deploy, verify LIVE, not just deployed** (Learnings 2026-07-09, deployed ≠
live-on-the-domain): load gotefigure.com through the gate and see the change with your eyes.
The Worker custom-domain cutover is still pending as of 2026-07-10, so until that lands the
live domain may not serve the newest Worker at all.

---

## 1. Add a piece

**Truth owner: `site/src/content/pieces.json`** (the OWNER ALLOWLIST - only pieces listed
there exist in the store, in listed order). After the Fourthwall cutover: the Fourthwall
dashboard owns the product + price; `overlay.ts` owns site-only fields.

1. Put the art in `site/public/art/v3/` (PNG, transparent, same family as the existing pieces).
2. Add one object to the `pieces` array in `pieces.json`. Required fields (see the `Piece`
   interface in `site/src/lib/drop.ts`): `id` (unique, kebab), `name`, `kind`, `kindShort`,
   `price` (number, USD - REAL prices only, see §7), `art` (path under `/art/v3/`), `artW`,
   `tileArtMax`, `sized` (`true` renders the XS–XL row), `category` (`wear` | `paper`),
   `desc`, `meta`, `note`, `underline`. Optional: `hero: true` (the hero slot on /store),
   `original: true` (changes the CTA to "Claim the original").
3. `cd site && npm run deploy`.
4. Verify through the gate: the new tile on `/store`, its `/piece/<id>` page, add-to-bag.

## 2. Retire a piece

**Truth owner: `pieces.json`** (removal from the allowlist IS retirement - there is no
hidden flag). If the piece moves to the permanent archive, **`vault.json`** owns that.

1. Delete the piece's object from `pieces.json`.
2. Optional (the brand's vaulted-forever ritual): add `{ id, img, name, sub }` to
   `vault.json` `pieces`, and its `id` to `vault.json` `strip` if it should show in the
   /store vault strip.
3. `cd site && npm run deploy`.
4. Verify: tile gone from `/store`; `/piece/<id>` no longer resolves; vault strip shows it
   if vaulted. Catalog-lint will catch any stray hardcoded reference to the retired name.

## 3. Change a price

**Truth owner today: the `price` field in `pieces.json`.** After the Fourthwall cutover:
**the Fourthwall dashboard, ONLY** - never `overlay.ts` (the overlay has no price field by
design; two price sources would drift).

1. Edit the piece's `price` number in `pieces.json`.
2. `cd site && npm run deploy`.
3. Verify through the gate: tile price, `/piece/<id>` price, satchel line price.

**Hard constraint:** real drop-one prices do not exist yet - they await Rotem's written
Vibe Embroidery quote and the Fourthwall draft publish (§7). Do not invent numbers;
catalog-lint fails any UNVERIFIED-marked price that could render.

## 4. Flip stock / pre-order state  *(TESTED end-to-end 2026-07-10)*

**Truth owner: `site/src/content/drop.json`** - the drop state machine.

| Field | Meaning |
|---|---|
| `dropState` | `"live"` (drop on sale: hero + add-to-bag) or `"between"` (everything vaulted: countdown + "drying on the desk" + notify form) |
| `editionSize` | The numbered-run size (the "1 of 50" language) |
| `dropLeft` | Units remaining; `≤ max(3, 20%)` triggers the low-stock urgency label |
| `nextDropDate` | Local-time ISO date the countdown ticks toward |

1. Edit the field (`"dropState": "between"` to close the window; back to `"live"` to open;
   decrement `dropLeft` as units sell).
2. `cd site && npm run deploy`.
3. Verify through the gate: `live` shows the hero piece + size row + "Add to bag";
   `between` shows the countdown block and no purchase UI.

This is also the **pre-order window lever** for the planned made-to-order drops (vault
decision 2026-07-08): open the ~2-week window with `live`, close it with `between`, and the
sold size counts drive the single bulk order to Vibe.

## 5. Swap the drop (Drop N → Drop N+1)

**Truth owners: `pieces.json` (new lineup) + `vault.json` (retired lineup) + `drop.json`
(reset state machine) + `drops.json` (the site-wide announcement banner: `{active, headline,
href}`).** One edit session, one deploy:

1. Move the outgoing drop's pieces: delete from `pieces.json`, append to `vault.json`
   (`pieces` + `strip` for the ones worth showing off).
2. Write the incoming lineup into `pieces.json` (scenario 1 shape, one entry per piece,
   exactly one `hero: true`).
3. Reset `drop.json`: `dropState` (usually `"live"` on launch morning), fresh `editionSize`,
   `dropLeft = editionSize`, next `nextDropDate`.
4. Optionally arm the banner in `drops.json`.
5. `cd site && npm run deploy`, then eyeball every changed surface through the gate:
   `/store` grid + hero, each new `/piece/<id>`, `/vault`.

## 6. The mock-to-Fourthwall cutover (NOT one env flip today - three parts)

**Target truth split after cutover:** Fourthwall dashboard = products, variants, stock,
prices, checkout. `site/src/lib/commerce/overlay.ts` = site-only fields per Fourthwall slug
(era, type/category, margin note, art override). `content/*.json` retires as catalog truth.

Part A - **Rotem (blocking, cannot be done from this repo):**
1. Publish the 4 Fourthwall draft products (they exist as drafts; names/slugs are not
   recorded anywhere in this repo or its research - checked 2026-07-10).
2. Get the written Vibe quote → set REAL prices in the Fourthwall dashboard.
3. Provide `PUBLIC_FW_STOREFRONT_TOKEN` (and `PUBLIC_FW_CHECKOUT_DOMAIN`, plus
   `PUBLIC_FW_COLLECTION` if not `all`).

Part B - **Wiring (a build task, sized small but real):** point the V3 surfaces at the
provider seam: `store.astro` / `piece/[id].astro` / `vault.astro` render from
`lib/commerce` instead of `lib/drop`, and `satchel.ts#seal()` redirects to the Fourthwall
hosted checkout (the adapter comment in `satchel.ts` already anticipates exactly this).
Re-validate the Fourthwall JSON shapes against real published products when they exist
(`fourthwall.ts` header: shapes were verified live 2026-06-11 but defensively parsed).

Part C - **The flip:**
1. Fill `overlay.ts` for every published slug (template is scaffolded in the file,
   commented out) and DELETE the `UNVERIFIED` markers as each price is confirmed real.
2. Set `PUBLIC_COMMERCE_PROVIDER=fourthwall` in `site/.env` (and CI env), AND change the
   committed pin `site/commerce.provider` to `fourthwall` in the same commit. catalog-lint
   fails on ANY mismatch between the two, in either direction.
3. `cd site && npm run deploy`.

**Guardrails (honest status, S4 review 2026-07-10):** the live enforcement is
`catalog-lint`, wired ahead of every build/verify/deploy. It FAILS on: provider=fourthwall
while `overlay.ts` still contains any `UNVERIFIED` marker (rule C); an invalid provider
value or a missing storefront token (rule D); any `PUBLIC_COMMERCE_*` key hiding in a
`.env.local`/`.env.production*` override file (rule E); and any mismatch between the
resolved env and the committed `site/commerce.provider` pin (rule F). The pin is what
stops a CI or scheduled build - which has no `site/.env` - from silently resolving back
to `mock` after the cutover and shipping the mock catalog as the real store.
`lib/commerce/index.ts` carries the same typo/token checks as build-time throws, but the
seam has ZERO importers until Part B lands, so those throws run in no build today; they
become a second net only after the Part B wiring.

## 7. Honest constraints (do not route around these)

- **No real prices exist for drop one.** The ~figures discussed for the hero tee and the
  embroidered hat are directional recommendations pending Vibe Embroidery's written quote
  (vault: Projects/GoteFigure.md, 2026-07-08). They are deliberately NOT written into any
  catalog file. `UNVERIFIED - Vibe quote pending` markers hold their places in `overlay.ts`.
- **The 4 Fourthwall draft slugs are unknown to this repo.** Named dependency on Rotem's
  dashboard; the overlay template carries four TODO slots.
- **The Worker custom-domain cutover is still pending** (2026-07-09 learning) - verify any
  "live" claim against gotefigure.com itself, not the Worker URL.
- **catalog-lint is the enforcement**, wired into `build`, `verify`, and `deploy`. If it
  blocks you, the catalog state is dishonest - fix the state, not the lint.
