// Sprint 4 step 5: orders reconcile endpoint -- THIN ADAPTER. All logic and every Safe
// Backend Doctrine control live in the PURE handleReconcileRequest (lib/reconcile.ts) so
// vitest drives the full pipeline against the node:sqlite D1 shim and a stubbed fetch.
// Controls enforced there, in order:
//   1. Fail CLOSED on missing config (no DB, no FW_API_BASIC, or no RECONCILE_TOKEN = 500).
//   2. Caller token (x-reconcile-token) verified via a double-HMAC constant-time-equivalent
//      compare BEFORE any work; missing and wrong are the same 401.
//   3. Report-only by default; writes only when the body carries apply === true, and the
//      backfill is strictly additive (ON CONFLICT DO NOTHING; the webhook stays the only
//      mutating writer).
//   4. FW lifecycle status is never mapped into shipping_status (F5), and missing_remote
//      rows are reported, never deleted.
// Secrets (Worker secrets, never in the bundle): FW_API_BASIC ("user:pass" for the FW
// Platform API Basic auth), RECONCILE_TOKEN (shared with the companion cron Worker).
// Cron wiring + console steps: docs/reconcile-runbook.md.
export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { handleReconcileRequest } from '../../../lib/reconcile';

export const POST: APIRoute = async ({ request }) => {
  const b = env as unknown as { DB?: any; FW_API_BASIC?: string; RECONCILE_TOKEN?: string };
  return handleReconcileRequest(request, { db: b.DB, fwBasic: b.FW_API_BASIC, token: b.RECONCILE_TOKEN });
};
