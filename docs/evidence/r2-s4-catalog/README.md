# R2-S4 catalog-change proof - 2026-07-10

Scenario 4 of `docs/INVENTORY-RUNBOOK.md` (flip stock / pre-order state) run end-to-end
against the BUILT worker (`npm run build` → `wrangler dev --local`, gate passed with the
local `.dev.vars` code, headless Chromium via the repo's Playwright):

| Capture | drop.json `dropState` | Observed at 1280x800 + 390x844 |
|---|---|---|
| `01-live-*` | `live` | Trippy 1.1 hero, XS–XL size row, "Add to bag - $30" |
| `02-between-*` | `between` (the staged change) | "Drop 02 - drying on the desk", face-down art, "The next one lands in" countdown, notify form; no purchase UI |
| `03-reverted-live-*` | `live` (change REVERTED, `git restore`, file byte-identical) | identical to 01 |

Text assertions per capture: `add-to-bag` / `drying on the desk` / `left` label flipped
exactly with the state (true/false/true → false/true/false → true/false/true).

Two defects found and fixed by this proof:
1. `assets.run_worker_first` was missing from `wrangler.jsonc` - browser navigations
   (Sec-Fetch-Mode: navigate) to /store, /piece/*, /vault were served the static 404 page
   and the Worker (and its gate) never ran. curl had always passed; only a real browser
   exposed it.
2. (Documented, not a defect) the client pre-paint bounce requires
   `localStorage['gf-store-open']` in addition to the server cookie - headless verification
   must set both, like the After Hours door does.
