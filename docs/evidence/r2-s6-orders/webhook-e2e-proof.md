# Orders webhook: observed end-to-end proof (2026-07-10, W1 Opus sprint)

The S6 order pipeline (`POST /api/orders/webhook` -> D1 `orders`) exercised against the
**built worker** (`wrangler dev -c dist/server/wrangler.json`, local D1 with migrations
0001-0003 applied, `.dev.vars` `FW_WEBHOOK_SECRET`). Signatures computed exactly as
Fourthwall does: base64 HMAC-SHA256 over the entire raw body, header
`X-Fourthwall-Hmac-SHA256` (both VERIFIED against docs.fourthwall.com this sprint; see
`docs/SECURITY-CLOSEOUT.md` §6). Harness: `scratchpad/webhook-proof.mjs`.

## POST battery (HTTP responses observed)

```
1. valid ORDER_PLACED (signed)             -> HTTP 200 {"ok":true}
2. replay same event (idempotent)          -> HTTP 200 {"ok":true}
3. ORDER_UPDATED same order, new event     -> HTTP 200 {"ok":true}
4. unsigned (no signature header)          -> HTTP 401 {"ok":false,"error":"invalid_signature"}
5. wrong-secret signature                  -> HTTP 401 {"ok":false,"error":"invalid_signature"}
6. signed but keyless (event-id bug)       -> HTTP 400 {"ok":false,"error":"bad_request"}
```

Event ids used: `weve_evt_PLACED_1`, `weve_evt_UPDATED_2` (same order `ord_local_0001`),
`weve_evt_KEYLESS_3` (order object with no `id`).

## D1 read-back (the authoritative observation)

```json
[
  {
    "id": 1,
    "fw_id": "ord_local_0001",
    "friendly_id": "GF-1042",
    "email": "Buyer@Example.com",
    "shipping_status": "shipped",
    "line_items": "[{\"name\":\"Rose Pour tee\",\"variant\":\"M\",\"quantity\":1},{\"name\":\"Goggle Rabbit sticker\",\"variant\":\"One size\",\"quantity\":2}]",
    "created_at": "2026-07-10 21:40:49",
    "updated_at": "2026-07-10 21:40:49"
  }
]
```

```
total_rows   = 1     (placed + replay + cross-event update collapsed to ONE row)
event_id_rows = 0    (no row keyed on any weve_* EVENT id)
```

## What each line proves

- **Idempotent on the ORDER id, not the delivery.** Three signed deliveries (placed,
  exact replay, and an ORDER_UPDATED under a DIFFERENT event id) produced exactly one
  row, keyed on `data.id` (`ord_local_0001`). The update flipped `shipping_status`
  pending -> shipped in place (`ON CONFLICT(fw_id) DO UPDATE`).
- **Fail closed on auth.** Unsigned and wrong-secret deliveries returned 401 and wrote
  nothing (missing and wrong signatures are indistinguishable to the caller).
- **Event-id defect fixed + proven.** A correctly SIGNED event whose order carries no
  `id` (only a top-level `weve_*` event id) was rejected 400 and wrote nothing;
  `event_id_rows = 0` confirms the handler never keys an order on the per-delivery event
  id. Regression is locked by `tests/orders.test.ts` ("NEVER keys an order on the
  envelope event id").
- **No card data anywhere.** The schema has no card column; `line_items` holds
  name/variant/quantity only. Fourthwall is Merchant of Record (SAQ A posture).

## Not done here (Rotem's console + real cutover, by design)

- Remote migration apply (`wrangler d1 migrations apply gotefigure --remote`) and
  `wrangler secret put FW_WEBHOOK_SECRET` are console actions (Safe Backend Doctrine:
  secrets never route through automation). Steps in `docs/SECURITY-CLOSEOUT.md` §6.
- A real signed delivery from Fourthwall (dashboard -> webhook -> "Send test") lands the
  first real row once the webhook is configured; verify then with the same read-back.
