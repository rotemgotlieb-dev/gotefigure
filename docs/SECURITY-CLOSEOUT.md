# Security close-out: the console steps that finish the hardening (Rotem's, dashboard)

One page, absorbed from the round-1 handoff section B (R2-S6, 2026-07-10). Everything here is a
CONSOLE action: per the Safe Backend Doctrine, provisioning (WAF rules, widget domains, secrets)
never routes through an agent or a browser bot. Each item lists the exact clicks and the check
that proves it took.

## 1. WAF rate-limit rule (one free rule; supplements the D1 limiter, never replaces it)
The gate login already has a durable D1 sliding-window limit (5 failures / 10 min / IP, fail
closed). This edge rule is the cheap outer shell that stops a dumb flood before it bills Worker
requests.

Dashboard path (Cloudflare, zone `gotefigure.com`):
1. Security -> WAF -> Rate limiting rules -> Create rule.
2. Rule name: `api-write-shield`.
3. If incoming requests match: Custom filter expression ->
   `(http.request.uri.path in {"/api/gate" "/api/subscribe" "/api/orders/webhook"}) and (http.request.method eq "POST")`
4. Rate: 10 requests per 10 seconds. Counting characteristics: IP (the free plan's only option).
5. Then take action: Block. Duration: 10 seconds (free-plan fixed timeout is fine).
6. Deploy.

Prove it took: 12 rapid `curl -X POST https://gotefigure.com/api/gate -d 'code=x'` from one shell;
requests 11+ should return HTTP 429 with a Cloudflare block page, and Security -> Events shows the
rule firing. (The D1 limiter underneath keeps enforcing 5-failures/10-min regardless.)

## 2. Bot Fight Mode (free, one toggle)
1. Security -> Bots -> enable **Bot Fight Mode**.
2. Leave "Definitely automated" at Block; do NOT enable Super Bot Fight features that are not on
   the free plan.

Caveats, so this does not bite later: Bot Fight Mode challenges known-bot fingerprints on ALL
paths and cannot be scoped. The order webhook (`POST /api/orders/webhook`) is server-to-server
traffic from Fourthwall; if FW deliveries start failing after enabling (check the webhook's
delivery log in the FW dashboard once webhooks are configured), add a WAF custom rule to SKIP Bot
Fight Mode for `http.request.uri.path eq "/api/orders/webhook"`. The endpoint's own HMAC
signature check is the real authentication either way; Bot Fight Mode is shell, not gate.

Prove it took: Security -> Bots shows the toggle on; a plain `python -c "import urllib.request;..."`
UA fetch of the homepage gets challenged while normal browsers pass.

## 3. Turnstile widget domain cleanup
The invisible widget (sitekey `0x4AAAAAADy13X8xyKOKIi6B`) accumulated preview hostnames during
the cutover saga. Tidy the allowlist so tokens mint only where the real form lives:
1. Turnstile -> the gotefigure widget -> Settings -> Domains.
2. KEEP: `gotefigure.com`, `www.gotefigure.com`.
3. REMOVE: `gotefigure.gotefigure.workers.dev` (the preview host; flagged in the cutover notes)
   and any other `*.workers.dev` entry.

Prove it took: a real signup on gotefigure.com still lands a D1 `subscribers` row; a form served
from the workers.dev preview now fails Turnstile (that is correct behavior, not a bug).

## 4. Stale DNS cleanup (from the cutover, still open, non-urgent)
Zone DNS -> delete the imported Vercel `A` records, the wildcard `*` A, and the `_domainconnect`
CNAME. Optionally convert the two Worker zone routes into proper Custom Domains afterwards (the
attach auto-succeeds once the stale records are gone). Until then the routes keep working as-is.

## 5. `.dev.vars` in the build output: re-verified 2026-07-10 (S4 fix holding)
Observed on the S6 build:
- `dist/client/` (the ONLY directory published as assets): **zero** `.dev.vars` files, and a
  value-grep of every `.dev.vars` secret against `dist/client/**` found **0 hits**.
- `dist/server/.dev.vars` exists BY DESIGN: the adapter copies it there so local `wrangler dev`
  can read dev secrets. It is never uploaded: deploy publishes `dist/client` assets plus the
  bundled worker script only.
- Both misconfiguration nets present: `dist/.assetsignore` (`server/**`, `.dev.vars`,
  `wrangler.json`) and `dist/client/.assetsignore` (`.dev.vars`, `wrangler.json`).
- dist-lint now ALSO pins the built config's `run_worker_first` list + `ASSETS` binding, so a
  config regression cannot silently re-expose gated routes or the vault gallery.

## 6. Turn orders ON (console + one CLI; the code side is DONE and proven)

The order pipeline is built, migration-applied locally, and proven end-to-end against the
built worker (signed -> 1 D1 row, replay/update -> still 1 row, unsigned/wrong-secret ->
401, signed-but-keyless -> 400/no row). Evidence: `docs/evidence/r2-s6-orders/webhook-e2e-proof.md`.
The Fourthwall signing details below were VERIFIED 2026-07-10 against
docs.fourthwall.com/webhooks/signature-verification + /webhooks/webhook-model, so no code
change is needed at cutover. Do these five steps, in order:

1. **Apply the orders migration to the REAL D1** (one CLI, Rotem's authed shell):
   ```sh
   cd site && npx wrangler d1 migrations apply gotefigure --remote
   ```
   Proves it took: `npx wrangler d1 execute gotefigure --remote --command \
   "SELECT name FROM sqlite_master WHERE type='table' AND name='orders';"` returns `orders`.

2. **Create the webhook in Fourthwall** (dashboard -> Settings -> For developers ->
   Webhooks, i.e. `https://<shop>.fourthwall.com/admin/dashboard/settings/for-developers`):
   - Endpoint URL: `https://gotefigure.com/api/orders/webhook`
   - Subscribe ONLY the order events: `ORDER_PLACED` and `ORDER_UPDATED`. (Do not point
     donation/gift events here; the endpoint stores whatever verified event carries an
     order id, so keep it order-only.)
   - Copy the **signing secret** Fourthwall shows for this webhook.

3. **Set the secret on the Worker** (never in the repo):
   ```sh
   npx wrangler secret put FW_WEBHOOK_SECRET   # paste the FW signing secret
   ```
   Do NOT set `FW_WEBHOOK_SIG_HEADER`: the code default `x-fourthwall-hmac-sha256` already
   matches Fourthwall's `X-Fourthwall-Hmac-SHA256` header (lookup is case-insensitive).
   Set it to `x-fourthwall-hmac-apps-sha256` ONLY if this is a Platform App integration
   (it is not for a normal shop webhook). Encoding is base64, already handled.

4. **Redeploy so the live Worker has the secret binding**, then confirm fail-closed is off:
   a signed test send should now write a row (next step). Until the secret is set the
   endpoint correctly returns 500 (fail closed) and writes nothing.

5. **Send a real signed test + read the row back** (deployed != working):
   - Fourthwall webhook config -> "Send test" (or place a $0/test order).
   - Verify: `npx wrangler d1 execute gotefigure --remote --command \
     "SELECT fw_id, friendly_id, email, shipping_status FROM orders ORDER BY id DESC LIMIT 5;"`
     shows the order, keyed on the FW order id (not a `weve_*` event id).
   - Or load `https://gotefigure.com/admin/orders` through the gate.

Bot Fight Mode caveat (from §2): if FW deliveries start failing after enabling it, add a
WAF rule to SKIP Bot Fight for `http.request.uri.path eq "/api/orders/webhook"`. The HMAC
check is the real auth; Bot Fight is shell, not gate.
