# Orders backfill + reconcile runbook (Sprint 4 step 5)

Status: **BUILT + LOCALLY PROVEN, NOT PROVISIONED.** The webhook cutover runbook's step 5
("until a reconcile exists, a dropped delivery is undetectable") is now closed at the code
layer: `POST /api/orders/reconcile` diffs Fourthwall's Platform API List Orders against the
local `orders` mirror and can backfill missed rows. Nothing here has touched remote state;
provisioning is Rotem's console work below.

## What it does
- **Report-only by default.** Pulls every FW order (paginated `page`/`size`, 10s per-page
  timeout, 429 surfaced as `fw_rate_limited`, ids deduped across pages) and verifies its own
  completeness: `truncated: true` whenever the pull is not provably complete (MAX_PAGES=40
  hit, unreadable `totalPages` on a full page, or the aggregate short of FW's own `total`,
  which is cross-checked, not thrown away). Reports:
  - `missingLocal` / `missingLocalCount`: FW has it, D1 does not = the dropped-delivery
    class (id list caps at 200 entries; the count is always exact).
  - `missingRemote` / `missingRemoteCount`: D1 has it, FW does not = phantom rows.
    Reported, NEVER deleted.
  - Windowed (`sinceDays`) AND truncated pulls suppress `missingRemote` (a partial pull is
    not full truth, so it must not report false phantoms).
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
- `npx vitest run tests/reconcile.test.ts`: **30/30 PASS** (20 original + 10
  failure-to-fixture cases from the fresh-context paranoid review, verdict
  SHIP_WITH_FIXES, all findings applied). Coverage: report-only writes nothing; apply
  inserts ONLY missing rows (existing webhook row untouched, CANCELLED lifecycle did not
  leak into shipping_status) and `applied` counts D1 `meta.changes`, not attempts; a
  backfilled 0-ts row is advanced normally by the later real webhook event; missing_remote
  reported not deleted, suppressed on windowed AND truncated pulls; 500 on each missing
  config and on local D1 failure (never mislabeled 502); 401 identical for missing and
  wrong token with ZERO FW calls; 400 malformed JSON; 413 oversized body; 502 named on FW
  401/403, 429 as `fw_rate_limited`; absent/stringified `totalPages` handled (full page +
  unreadable = truncated, "2" still paginates, partial single page = clean); aggregate
  short of FW's `total` = truncated; duplicate ids deduped; non-JSON 200 = `fw_fetch_failed`
  with no error-page text leaking; error strings allowlisted.
- **Scale footnote (reviewer catch, no code change needed today):** a full 40-page pull
  spends ~41 of the Workers free plan's 50 subrequests, leaving ~9 for backfill INSERTs per
  invocation; a large `apply` run past that dies loudly (`storage_failed` with partial
  `applied`) and re-runs make additive progress. Irrelevant at this shop's scale; revisit
  if the shop ever holds thousands of orders.
- Wrangler smoke (built worker, no secrets provisioned): a JSON POST to
  `/api/orders/reconcile` answers `500 {"ok":false,"error":"server_misconfigured"}` =
  fail-closed before any remote call, route reachable through the worker (adapter wiring +
  run_worker_first proven). A form-content-type POST gets Astro's built-in CSRF 403 before
  the handler (known behavior, banked S6); FW-style server-to-server JSON passes through.
