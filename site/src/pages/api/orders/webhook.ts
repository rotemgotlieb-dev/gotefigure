// S6: Fourthwall order webhook receiver. Safe Backend Doctrine controls, in order:
//   1. Fail CLOSED on missing config (no DB binding or no FW_WEBHOOK_SECRET = 500, no write).
//   2. Signature verified on the RAW body BEFORE any parsing (HMAC-SHA256, constant-time
//      via crypto.subtle.verify; header name env-configurable until Fourthwall's
//      signature-verification page is read at cutover - see lib/orders.ts).
//   3. Idempotent: fw_id is UNIQUE; a replayed event upserts the SAME row (never a 2nd).
//   4. Every untrusted value reaches D1 through a parameterized bind, never concat.
//   5. NO card data: Fourthwall is Merchant of Record; the schema has no card column and
//      the handler never reads one. (FW webhooks carry order metadata, not PANs; re-verify
//      the payload contract at cutover.)
// Secrets (Worker secrets, never in the bundle): FW_WEBHOOK_SECRET. Optional plain var:
// FW_WEBHOOK_SIG_HEADER (a header NAME is not a secret).
export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { DEFAULT_SIG_HEADER, extractOrder, verifyWebhookSignature } from '../../../lib/orders';

const MAX_BODY_BYTES = 100_000; // sanity cap: an order event is KBs, not a payload dump

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const bindings = env as unknown as { DB?: any; FW_WEBHOOK_SECRET?: string; FW_WEBHOOK_SIG_HEADER?: string };
  if (!bindings.DB || !bindings.FW_WEBHOOK_SECRET) {
    return json({ ok: false, error: 'server_misconfigured' }, 500); // fail closed, never process unsigned
  }

  // RAW body first; the signature covers these exact bytes, so no parse before verify.
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }
  if (!raw || raw.length > MAX_BODY_BYTES) return json({ ok: false, error: 'bad_request' }, 400);

  const headerName = bindings.FW_WEBHOOK_SIG_HEADER || DEFAULT_SIG_HEADER;
  const ok = await verifyWebhookSignature(bindings.FW_WEBHOOK_SECRET, raw, request.headers.get(headerName));
  if (!ok) return json({ ok: false, error: 'invalid_signature' }, 401); // missing and wrong look identical

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  const order = extractOrder(payload);
  if (!order) return json({ ok: false, error: 'bad_request' }, 400); // signed but keyless: reject, write nothing

  try {
    await bindings.DB.prepare(
      `INSERT INTO orders (fw_id, friendly_id, email, line_items, shipping_status, raw_event)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(fw_id) DO UPDATE SET
         friendly_id     = COALESCE(excluded.friendly_id, friendly_id),
         email           = COALESCE(excluded.email, email),
         line_items      = CASE WHEN excluded.line_items != '[]' THEN excluded.line_items ELSE line_items END,
         shipping_status = excluded.shipping_status,
         raw_event       = excluded.raw_event,
         updated_at      = datetime('now')`,
    )
      .bind(order.fwId, order.friendlyId, order.email, order.lineItems, order.shippingStatus, raw)
      .run();
  } catch {
    return json({ ok: false, error: 'storage_failed' }, 500); // fail closed: FW retries per its retry policy
  }

  return json({ ok: true }, 200);
};
