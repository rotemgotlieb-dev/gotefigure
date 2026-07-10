# R2-S8 observed proofs (email capture surface #2 + S6 gate correction)

Date: 2026-07-10 (~03:43-03:45 PDT). All runs against the BUILT worker (`npm run build`
with the TEST Turnstile sitekey, then `wrangler dev` on the adapter's deploy-config
redirect), local D1, TEST Turnstile secret in `.dev.vars`. Baseline: subscribers table
empty, orders table 1 row (`fw-sim-0001` from S6).

## 1. NewsletterForm (/about) path, REAL headless browser (playwright chromium, fresh contexts)
Soft-lobby localStorage flag pre-seeded (pre-launch UX, not security state); cookies cleared per the S6 contamination gotcha. Both widths:

| width | nav | form found | submit result | /api/subscribe | localStorage cache |
|---|---|---|---|---|---|
| 1280x800 | /about renders | 1 | done state shown ("you're on the list · the rabbit wrote it down") | 200 | gf-drops-email set |
| 390x844 | /about renders | 1 | done state shown | 200 | gf-drops-email set |

Rows read back: `browser-proof-1280@example.com` + `browser-proof-390@example.com`, both `source='drops'`, exactly one row each.

## 2. Endpoint battery (browser-shaped curl: content-type json + same-origin Origin + Sec-Fetch headers)
- drops submit (`source:"drops"`, empty `gf_hp`) -> 200 `{ok:true}`; row read back `drops-proof@example.com` / `drops` (lowercased, exactly 1).
- honeypot-filled submit -> 200 `{ok:true}` and ZERO rows stored (bot-harvest@ absent).
- unknown `source:"evil-segment"` -> 400 `{"error":"invalid_source"}`, ZERO rows (poison@ absent).
- legacy body with NO source (deployed After Hours bundle shape) -> 200, row stored as `source='after-hours'`.
- Test-hazard note: an unquoted zsh header variable collapsed all curl headers into one, so the first battery hit Astro's CSRF 403 (non-JSON cross-site POST). Correct behavior by the CSRF layer; rerun with explicit headers.

## 3. S6 gate correction (queued from the S6 review): webhook missing-secret path OBSERVED
`FW_WEBHOOK_SECRET` removed from `.dev.vars`, worker restarted, then a CORRECTLY SIGNED
POST (HMAC-SHA256 over the raw body, `x-fourthwall-hmac-sha256`, secret from the backup):
- Response: **500 `{"ok":false,"error":"server_misconfigured"}`** (fail closed BEFORE signature verification).
- Orders table after: still 1 row; `fw-sim-s8-gatecheck` rows: 0. **ZERO writes.**
`.dev.vars` restored afterward (FW_WEBHOOK_SECRET line count = 1 verified).

## 4. Suite
`npm run verify` exit 0: catalog-lint 6 rules + build + dist-lint (all PASS incl. the 3 gated-route pins) + 59/59 tests.
Em-dash sweep of the touched component: 0 matches. `gf_hp` marker present in built `/about` HTML.
