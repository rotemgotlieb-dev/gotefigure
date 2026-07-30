# PR #13 one-click merge + post-merge cutover (orders backfill + reconcile lane)

Status: NOTHING HERE HAS BEEN EXECUTED. This doc is the click list. Every remote-touching
step is Rotem's console action (Safe Backend Doctrine: secrets and remote writes are never
routed through automation). Written 2026-07-29 by the W2 backend lane.

## Merge readiness, re-proven 2026-07-29

- PR: https://github.com/rotemgotlieb-dev/gotefigure/pull/13 (`feat/orders-reconcile` @ `1d86bde`).
- Merge base is `16ee26a`, which IS the current `origin/main` tip, so the merge applies
  cleanly with zero conflicts (3 commits: `d3ca080`, `33c0e89`, `1d86bde`).
- `npm run verify` re-run tonight in a fresh worktree after `npm ci`: exit 0,
  catalog-lint PASS, dist-lint PASS, **124/124 tests (6 files)**. Same counts the 2026-07-23
  guard pre-merge battery observed.
- Guard verdict 2026-07-23 (PRE-MERGE scope): every branch-attributable check PASS; the one
  AMBER is `npm audit` high=4 on main-inherited build deps (astro XSS advisories and
  friends). It merges unchanged whether or not PR #13 lands; it has its own assessment in
  `docs/ASTRO-UPGRADE-ASSESSMENT.md`. Not a merge blocker.
- Zero new npm dependencies; the cron worker is dependency-free vanilla JS and does NOT
  ride `npm run deploy` (it deploys only by its own explicit command, step 8).

## The click list, in this exact order

Ordering matters because Fourthwall's retry budget is tiny (about 5 attempts over seconds).
A receiver that is live but misconfigured burns real deliveries permanently. Full reasoning:
`docs/webhook-cutover-runbook.md` and `docs/reconcile-runbook.md`.

1. **Merge PR #13** on GitHub (one click). Merges are NOT auto-deployed (CI
   `CLOUDFLARE_API_TOKEN` is intentionally unset), so nothing goes live yet.

2. **Apply the D1 migrations remotely BEFORE any deploy of the new handler:**
   ```
   cd site && npx wrangler d1 migrations apply gotefigure --remote
   ```
   This applies ALL pending migrations. As of the 2026-07-18 guard read, the remote D1 has
   NO `orders` table at all, so both `0003_orders.sql` and `0004_orders_event_ts.sql` are
   pending there. Until they land, every webhook INSERT would 500 and burn retries.

3. **Set the secrets** (console/CLI, values never touch the repo or automation):
   ```
   npx wrangler secret put FW_WEBHOOK_SECRET    # exact value shown by Fourthwall for THIS webhook
   npx wrangler secret put FW_API_BASIC         # shop-level API key for the Platform API (Basic auth)
   npx wrangler secret put RECONCILE_TOKEN      # long random string you generate; used by the cron/curl caller
   npx wrangler secret put GATE_CODE            # guard 2026-07-29 RED 2: the live Worker holds ONLY
   npx wrangler secret put GATE_SIGNING_KEY     # TURNSTILE_SECRET_KEY; the gate secrets were never set,
                                                # so nobody (Rotem included) can open /store or /vault today
   ```
   If the webhook is created as a Platform App (not a dashboard webhook), also set the
   non-secret header name: `FW_WEBHOOK_SIG_HEADER=x-fourthwall-hmac-apps-sha256`.
   Re-verify at cutover (flagged `not verified` in the runbook): the exact `user:pass`
   composition of `FW_API_BASIC` for a shop-level key. Confirm with one live List Orders call.
   After step 4, re-probe the gate: `POST /api/gate` with a wrong code should answer 403
   `wrong_code`, not 500 `server_misconfigured` (the guard's 4e check). Note the migrations
   in step 2 are also what create `gate_attempts`; without them the gate 500s even with
   secrets set.

4. **Deploy:** `cd site && npm run deploy` (catalog-lint, build, dist-lint gate the deploy).

5. **Prove the receiver with ONE signed test delivery from Fourthwall**, then read the row back:
   ```
   npx wrangler d1 execute gotefigure --remote --command \
     "SELECT fw_id, shipping_status, event_ts, status_event_ts, created_at FROM orders ORDER BY id DESC LIMIT 5"
   ```
   A 200 with no row means acked-but-skipped: check the worker log for
   `webhook_type_skipped` / `webhook_no_event_ts` before going further.

6. **Register the webhook for order events only** (`ORDER_PLACED`, `ORDER_UPDATED`) in the
   Fourthwall dashboard, pointed at `https://gotefigure.com/api/orders/webhook`. Then place
   one real low-value test order and read its row back (same SELECT). Only after a real
   order lands is the path trusted. Watch the skip log during this step.

7. **Run one report-only reconcile** and read the drift report:
   ```
   curl -sS -X POST https://gotefigure.com/api/orders/reconcile \
     -H "content-type: application/json" \
     -H "x-reconcile-token: <RECONCILE_TOKEN value>" \
     -d '{}'
   ```
   Report-only is the default; it writes nothing. If `missingLocal` shows drift after the
   cutover, run it once with `-d '{"apply":true}'` (strictly additive backfill; it can only
   create rows the webhook missed, never mutate existing ones).

8. **Optional, recommended: the daily report-only cron.** Separate worker, separate deploy,
   never rides the site deploy:
   ```
   cd cron-reconcile && npx wrangler secret put RECONCILE_TOKEN && npx wrangler deploy
   ```

## What this cutover does NOT change

- `site/commerce.provider` stays `mock`. The storefront still sells nothing; no Fourthwall
  products exist yet. The webhook/orders path going live only makes the mirror trustworthy
  for the day the store opens.
- Guard check 4d flips from PENDING (fail-closed 500) to PASS (401 unsigned) once
  `FW_WEBHOOK_SECRET` exists. Run a full guard battery after step 6.

## Rotem-only list for this doc

Merge click (1) · remote migrations (2) · three secret values (3) · deploy (4) · the FW
dashboard test delivery + webhook registration + test order (5, 6) · the reconcile curl and
optional cron deploy (7, 8).
