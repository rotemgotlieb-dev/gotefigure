# Orders backfill + reconcile runbook (Sprint 4 step 5)

Status: **BUILT + LOCALLY PROVEN, NOT PROVISIONED.** The webhook cutover runbook's step 5
("until a reconcile exists, a dropped delivery is undetectable") is now closed at the code
layer: `POST /api/orders/reconcile` diffs Fourthwall's Platform API List Orders against the
local `orders` mirror and can backfill missed rows. Nothing here has touched remote state;
provisioning is Rotem's console work below.

## What it does
- **Report-only by default.** Pulls every FW order (paginated, `page`/`size`, bounded at
  MAX_PAGES=40 with an explicit `truncated` flag), reads local `fw_id`s, and reports:
  - `missingLocal`: FW has it, D1 does not = the dropped-delivery class.
  - `missingRemote`: D1 has it, FW does not = phantom rows. Reported, NEVER deleted.
  - Windowed pulls (`sinceDays`) suppress `missingRemote` (a window is not full truth).
- **Backfill only on `{"apply": true}`.** Strictly additive `INSERT ... ON CONFLICT DO
  NOTHING`: it can only create rows the webhook missed, never mutate existing ones. A
  backfilled row lands with `event_ts = 0` and `shipping_status = 'unknown'`, so the next
  genuine webhook delivery advances it normally (proven in tests), and its `raw_event`
  carries a `RECONCILE_BACKFILL` provenance marker. FW's lifecycle `status` is never
  mapped into `shipping_status` (the F5 rule).
- **Auth:** `x-reconcile-token` header checked against the `RECONCILE_TOKEN` secret via a
  double-HMAC constant-time-equivalent compare; missing and wrong answer the identical 401
  before any FW call. Missing config (DB, `FW_API_BASIC`, `RECONCILE_TOKEN`) = 500
  fail-closed. An FW non-200 = 502 with the named error, never an empty "no drift" report.

## API contract this is built against (verified 2026-07-23)
`GET https://api.fourthwall.com/open-api/v1.0/order` per
`docs.fourthwall.com/api-reference/platform/orders/list-orders.md`: Basic auth with
shop-level API keys ("API keys have full access to this endpoint"), `page` (default 0),
`size` (default 20), `createdAt[gt]` ISO filter; response `{ results, total, page, size,
totalPages }`; rate limit 100 req / 10 s per shop (our page size 50 = 1-2 requests at this
shop's scale). **Re-verify at cutover:** the exact `user:pass` composition of `FW_API_BASIC`
for a shop-level key is `not verified` here; confirm against one live call (a 401 response
shape from fake creds does not document the split).

## Rotem's console steps (in order, none run yet)
1. Create a shop-level API key in the FW dashboard (for-developers page), least privilege
   if scoping exists.
2. `npx wrangler secret put FW_API_BASIC` (the "user:pass" string; never in the repo).
3. Generate a long random token, `npx wrangler secret put RECONCILE_TOKEN`.
4. Deploy (rides the normal deploy; `/api/*` is already `run_worker_first`).
5. One manual report-only run and read it:
   `curl -s -X POST https://gotefigure.com/api/orders/reconcile -H "x-reconcile-token: $TOKEN" | jq`
6. If `missingLocal` is non-empty after the webhook cutover settles, run once with
   `{"apply": true}` and read the backfilled rows back from D1.

## Cron wiring (the periodic drift alert)
The installed `@astrojs/cloudflare` 13.7.0 entry exports `fetch` only (no `scheduled`
handler; read from `node_modules/@astrojs/cloudflare/dist/entrypoints/server.js`), so
Cloudflare Cron cannot invoke this worker directly. **The companion cron Worker is BUILT
and staged at `cron-reconcile/`** (worker.js + wrangler.jsonc, daily 09:17 UTC = 02:17 PT):
its `scheduled` handler POSTs the reconcile endpoint report-only (it can never send
`apply`; backfill stays a human act), logs a compact drift line (error-level on any
non-200 or non-zero drift so it stands out in `wrangler tail`), and fails closed without
its `RECONCILE_TOKEN` secret. Deploy: `cd cron-reconcile && npx wrangler deploy`, then
`npx wrangler secret put RECONCILE_TOKEN` (same value as the site worker's).

Local proof observed 2026-07-23 (`wrangler dev --local --test-scheduled`, curl
`/__scheduled`): the trigger fires the handler; with no token it logs
`reconcile_cron_misconfigured` and makes zero calls; a fetch failure logs
`reconcile_cron_fetch_failed` and stops. The live report-log line could NOT be observed
locally (two local workerd sandboxes cannot reach each other over loopback, the known
"Network connection lost" limit), so console step 5 doubles as its rehearsal: after
deploying both workers, set the cron worker's `RECONCILE_URL` var to the preview host once,
trigger it, and read the `reconcile_cron_report` line in `wrangler tail` before trusting
the schedule. Alternative rejected: a custom entry wrapper exporting `scheduled` from the
site worker (deploy-config surgery on the adapter's generated config, not worth it).

## Local proof (observed 2026-07-23, this branch)
- `npx vitest run tests/reconcile.test.ts`: 20/20 PASS, covering: report-only writes
  nothing; apply inserts ONLY missing rows (existing webhook row untouched, CANCELLED
  lifecycle did not leak into shipping_status); a backfilled 0-ts row is advanced normally
  by the later real webhook event (same row, upserted); missing_remote reported not
  deleted, suppressed on windowed pulls; 500 on each missing config; 401 identical for
  missing and wrong token with ZERO FW calls made; 400 on malformed JSON; 502 named error
  on FW 401/403; `apply` must be literally `true`; `sinceDays` clamped to 1..365;
  runaway `totalPages` stops at MAX_PAGES with `truncated: true`.
- Wrangler smoke (built worker, no secrets provisioned): a JSON POST to
  `/api/orders/reconcile` answers `500 {"ok":false,"error":"server_misconfigured"}` =
  fail-closed before any remote call, route reachable through the worker (adapter wiring +
  run_worker_first proven). A form-content-type POST gets Astro's built-in CSRF 403 before
  the handler (known behavior, banked S6); FW-style server-to-server JSON passes through.
