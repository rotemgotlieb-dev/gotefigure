# Fourthwall order-webhook cutover runbook (F4, PREP ONLY)

Status: **NOT EXECUTED.** This documents the ordering; nothing here has been run against remote
state. Setting the secret and registering the webhook are Rotem's console tasks. The receiver is
fail-closed until `FW_WEBHOOK_SECRET` exists, so an unprovisioned endpoint writes nothing and
returns 500 rather than accepting unsigned traffic.

Why ordering matters (Safe Webhook Receiver Doctrine, costed on this repo): Fourthwall's retry
budget is small (roughly 5 attempts over seconds, success = 200 only). An order that arrives while
the receiver is misconfigured is dropped permanently and is invisible in the local mirror. A
MISSET secret 401s genuine deliveries identically to an unset one, so "registered but wrong value"
looks exactly like "quiet day".

## Do these in order

1. **Apply the D1 migration BEFORE the new handler is live.**
   ```
   npx wrangler d1 migrations apply gotefigure --remote
   ```
   `wrangler deploy` does NOT apply migrations. This command applies ALL pending migrations, which
   matters more than it first appears: as of 2026-07-18 the remote database has no `orders` table
   at all (`pragma_table_info('orders')` returns empty on prod D1), so `0003` is unapplied there
   too, not only `0004`. Until both land, every INSERT fails (`no such table: orders`, or
   `no such column: event_ts` if only 0003 is applied) and returns 500, burning Fourthwall's
   retries on every delivery. Where rows already exist, they backfill to `event_ts = 0` /
   `status_event_ts = 0` and advance normally on their next real event. No manual backfill needed.

2. **Set the secret** (Rotem, console or CLI; never routed through automation):
   ```
   npx wrangler secret put FW_WEBHOOK_SECRET
   ```
   Use the exact value Fourthwall shows for THIS webhook. If the webhook is a Platform App, also
   set `FW_WEBHOOK_SIG_HEADER=x-fourthwall-hmac-apps-sha256` (a header name is not a secret).

3. **Deploy the worker**, then verify the endpoint is fail-closed no longer:
   send ONE signed test delivery from Fourthwall and confirm a row lands:
   ```
   npx wrangler d1 execute gotefigure --remote --command \
     "SELECT fw_id, shipping_status, event_ts, status_event_ts, created_at FROM orders ORDER BY id DESC LIMIT 5"
   ```
   A 200 with no row means the event was acked but not stored: check the skip log (step 5) before
   registering anything else.

4. **Register the webhook** for order events only, then place one real low-value test order and
   read the row back. Only after a real order lands is the path trusted.

5. **Backfill + reconcile: BUILT (2026-07-23, `feat/orders-reconcile`).** `POST
   /api/orders/reconcile` (token-gated, report-only by default, strictly-additive backfill on
   `{"apply": true}`) diffs FW List Orders against local `fw_id`s in both directions. Console
   provisioning (`FW_API_BASIC` + `RECONCILE_TOKEN` secrets) and the Cron wiring choice are in
   `docs/reconcile-runbook.md`. Until PROVISIONED, a dropped delivery is still undetectable in
   prod; the code no longer promises anything it does not perform.

## Re-verify at cutover (V1_BETA: the contract can change without notice)

Every item below is hard-coded from documentation, not from a live delivery. Capture ONE real
signed delivery and byte-compare before trusting any of it.

| Hard-coded | Where | If it is wrong |
|---|---|---|
| `ORDER_PLACED` / `ORDER_UPDATED` | `ALLOWED_EVENT_TYPES`, lib/orders.ts | **Worst case.** Every real order is acked 200 and silently dropped. Fourthwall never retries, so "no orders" and "all orders dropped" look identical. The skip log (below) is the only tell. |
| shipping status at `shipping.status` / `shippingStatus` | `extractOrder` | Status extracts as `unknown`, and the monotonic guard holds it, so orders freeze at their first-seen status. |
| envelope `createdAt` is EVENT time | `eventMicros(p.createdAt)` | Two ways to lose here, same outcome. **Wrong field:** using the order's constant `data.createdAt` makes `event_ts` identical across an order's events, freezing status forever. **Absent or renamed:** if the envelope stops carrying `createdAt` (or renames it), every event parses to `0`, so each order sticks at its first-seen status permanently. Both are visible only as log lines, so check them at cutover: `webhook_no_event_ts` fires on the unparseable case, and `webhook_status_not_applied` names every status that did not land, with a reason of `no_event_ts`, `timestamp_tie`, or `stale_event`. |
| `x-fourthwall-hmac-sha256`, base64 digest | `DEFAULT_SIG_HEADER` | Every delivery 401s. |
| 100 KB cap | `MAX_BODY_BYTES` | An oversized order 413s and burns its retries. Order metadata is KBs, so confirm the largest realistic order plus envelope sits well under the cap. |

**Watch the skip log at cutover.** A non-allowlisted event logs
`{"evt":"webhook_type_skipped","type":"..."}` (type only, never payload or PII). If real orders are
being dropped because a type string differs, this line is what surfaces it. An allowlisted event
whose `createdAt` did not parse logs `{"evt":"webhook_no_event_ts",...}`.

## Known behavior, not a bug

Rejecting an oversized body (413) without consuming it resets that keep-alive connection, so the
next request on the SAME connection gets a one-shot 503 before recovering. This was verified as
inherent to early rejection, not caused by the streaming abort: a drain-fully-then-reject variant
(the pre-F6 behavior) reproduces the identical `413 -> 503 -> 200` sequence. Separate senders use
separate connections, so one client's oversized POST cannot disturb another's delivery.

## Local proof harness

`site/scripts/webhook-smoke.mjs` drives the BUILT worker under `wrangler dev --local` against a
local D1 and reads rows back. It is local-only (test secret, local database, no remote state) and
is deliberately not wired into `npm run deploy`.
```
npx wrangler d1 migrations apply gotefigure --local
npm run build && npx wrangler dev --local --port 8788   # in one shell
node scripts/webhook-smoke.mjs                          # in another
```
