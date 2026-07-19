// S6: Fourthwall order webhook receiver -- THIN ADAPTER. All logic + the Safe Backend Doctrine
// controls live in the PURE handleOrderWebhook (lib/orders.ts) so vitest can drive the full
// pipeline against a node:sqlite-backed D1 shim and read rows back. This file only maps the
// Worker env bindings into that call. Controls enforced there, in order:
//   1. Fail CLOSED on missing config (no DB binding or no FW_WEBHOOK_SECRET = 500, no write).
//   2. F6: a REAL byte-length cap enforced WHILE buffering (413; oversized bodies abandoned early).
//   3. Signature verified on the RAW body BYTES BEFORE any parse (HMAC-SHA256, constant-time).
//   4. F1: in-code event-type allowlist; non-order types acked 200 with NO row write.
//   5. F2/F3: monotonic upsert (two watermarks) so replayed / out-of-order events cannot regress.
//   6. Every untrusted value reaches D1 through a parameterized bind; NO card data (Fourthwall
//      is Merchant of Record; the schema has no card column and the handler never reads one).
// Secrets (Worker secrets, never in the bundle): FW_WEBHOOK_SECRET. Optional plain var:
// FW_WEBHOOK_SIG_HEADER (a header NAME is not a secret). Cutover checklist: docs/webhook-cutover-runbook.md.
export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { handleOrderWebhook } from '../../../lib/orders';

export const POST: APIRoute = async ({ request }) => {
  const b = env as unknown as { DB?: any; FW_WEBHOOK_SECRET?: string; FW_WEBHOOK_SIG_HEADER?: string };
  return handleOrderWebhook(request, { db: b.DB, secret: b.FW_WEBHOOK_SECRET, sigHeader: b.FW_WEBHOOK_SIG_HEADER });
};
