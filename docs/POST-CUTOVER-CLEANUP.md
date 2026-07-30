# Post-cutover cleanup list (REPORT-ONLY; every item is Rotem's console/dashboard action)

Consolidated 2026-07-29 from the vault Backlog (the Sprint-1 post-cutover bullet and its
neighbors) plus docs/SECURITY-CLOSEOUT.md. None of this blocks drop-1 code work; all of it
is dashboard hygiene left from the 2026-07-10 domain cutover. Statuses were NOT re-probed
tonight (dashboard state is not readable from this repo); verify each when clicking.

## Cloudflare dashboard

1. Remove `gotefigure.gotefigure.workers.dev` from the Turnstile widget's allowed domains
   (the widget should answer for gotefigure.com/www only).
2. Delete the stale `preview` Worker (the pre-cutover deploy target).
3. DNS zone: delete the stale imported Vercel A records, the wildcard `*` A record, and the
   `_domainconnect` CNAME. Optionally convert the two Worker zone routes
   (`gotefigure.com/*`, `www.gotefigure.com/*`) into proper Custom Domains afterwards; the
   attach succeeds once the old records are gone. The routes are also a legitimate
   permanent setup if zero clicks is preferred.
4. SECURITY-CLOSEOUT items still open: the free WAF rate-limit rule (`api-write-shield` on
   the three POST endpoints) and Bot Fight Mode (mind the documented Fourthwall-webhook
   skip caveat when it goes on).

## GitHub

5. Old PRs #4 (sprint-0 hygiene) and #5 (sprint-1 wiring): their content shipped to main
   long ago via later branches; close or merge them so the PR list reads true.
6. CI `CLOUDFLARE_API_TOKEN` remains intentionally unset (merge does not auto-deploy).
   Decide whether that stays policy; today live sits behind main by design and every deploy
   is a manual `npm run deploy`.

## Elsewhere

7. Delete the OLD public Google Sheet of collected emails (pre-D1 era; exposed until
   removed; it is not part of this system).
8. Vercel dashboard: remove the stale gotefigure project/integration (console noise only;
   the 7/23 guard confirmed no backend impact).

## Copy debt discovered tonight (owner call, not cleanup-clicks)

9. `site/src/pages/info/shipping.astro` still carries POD-era promises (printed-to-order
   2-5 day language, 30-day make-it-right, poster/sticker lines). The drop-1 model
   (pre-order window, made-to-order run, no exchange inventory, flat-rate shipping
   recommendation) contradicts most of it. The written exchange/refund policy is already an
   open vault item; this page is where it lands. Flagged, not edited: policy wording is
   Rotem's.
