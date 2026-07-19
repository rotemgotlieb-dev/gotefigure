// S6 orders: webhook signature verification + defensive payload extraction.
// PURE module by design (no `cloudflare:workers` import) so vitest can exercise it
// directly; the endpoint owns all env/binding access.
//
// VERIFIED 2026-07-10 against docs.fourthwall.com/webhooks/signature-verification +
// /webhooks/webhook-model + /api-reference/order-events/order-placed:
//   - Signature header: `X-Fourthwall-Hmac-SHA256` (Platform Apps use
//     `X-Fourthwall-Hmac-Apps-SHA256`). Header lookup is case-insensitive (Fetch API),
//     so the lowercased default below matches. Override via FW_WEBHOOK_SIG_HEADER only
//     for the Platform-Apps variant.
//   - Algorithm: HMAC-SHA256 over the ENTIRE raw request body, digest BASE64-encoded
//     (FW's own sample: `base64.b64encode(hmac.new(secret, body, sha256).digest())`,
//     compared with `hmac.compare_digest`). We decode to bytes and verify constant-time
//     via crypto.subtle.verify. Hex is also accepted defensively; FW ships base64.
//   - Envelope: { testMode, id (EVENT id, weve_...), webhookId, shopId, type
//     (e.g. "ORDER_PLACED"), apiVersion, createdAt, data: <the order> }. The ORDER id is
//     data.id; friendlyId is data.friendlyId. See extractOrder for the field walk.
// The mechanism is the doctrine's required control regardless: HMAC-SHA256 over the RAW
// body, verified constant-time, before any parse or write.

const enc = new TextEncoder();

/** Fourthwall signature header (standard webhooks). Case-insensitive lookup; override via
 * FW_WEBHOOK_SIG_HEADER only for the Platform-Apps `X-Fourthwall-Hmac-Apps-SHA256` variant. */
export const DEFAULT_SIG_HEADER = 'x-fourthwall-hmac-sha256';

const b64ToBytes = (s: string): Uint8Array | null => {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s) || s.length % 4 !== 0) return null;
  try {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
};

const hexToBytes = (s: string): Uint8Array | null => {
  if (!/^[0-9a-fA-F]+$/.test(s) || s.length % 2) return null;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
};

/**
 * Verify an HMAC-SHA256 signature over the RAW body BYTES. The provided signature may be
 * base64 or hex encoded (both decoded to bytes; comparison is constant-time via
 * crypto.subtle.verify, never a string ===). Empty/garbage input verifies false.
 * Byte-native so the endpoint HMACs the EXACT received bytes with no UTF-8 round-trip
 * (a bytes->string->bytes round-trip would corrupt any non-ASCII body, e.g. an accented
 * shipping address or an emoji in a product name, and break verification).
 */
export async function verifyWebhookSignatureBytes(secret: string, body: Uint8Array, signature: string | null): Promise<boolean> {
  if (!secret || !signature) return false;
  const sig = signature.trim();
  if (!sig || sig.length > 128) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  for (const bytes of [b64ToBytes(sig), hexToBytes(sig.toLowerCase())]) {
    if (bytes && bytes.length === 32) {
      // Uint8Array is a valid BufferSource; casts keep TS's ArrayBufferLike variance happy.
      if (await crypto.subtle.verify('HMAC', key, bytes as unknown as BufferSource, body as unknown as BufferSource)) return true;
    }
  }
  return false;
}

/** String convenience wrapper over verifyWebhookSignatureBytes (encodes to UTF-8 bytes). */
export async function verifyWebhookSignature(secret: string, rawBody: string, signature: string | null): Promise<boolean> {
  return verifyWebhookSignatureBytes(secret, enc.encode(rawBody), signature);
}

/** Test/simulation helper: produce the base64 HMAC-SHA256 of a body under a secret. */
export async function signWebhookBody(secret: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  let bin = '';
  for (const b of new Uint8Array(mac)) bin += String.fromCharCode(b);
  return btoa(bin);
}

export interface ExtractedOrder {
  fwId: string;
  friendlyId: string | null;
  email: string | null;
  lineItems: string;       // JSON array string, [] when absent
  shippingStatus: string;  // 'unknown' when absent
  eventType: string | null;
  eventTs: number;         // ENVELOPE createdAt as microseconds since epoch; 0 when absent/unparseable
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Parse an event's ENVELOPE createdAt into an integer of MICROSECONDS since the Unix epoch.
 * Fourthwall stamps microsecond ISO-8601 (e.g. "2023-07-12T15:05:11.078089+00:00"); Date.parse
 * truncates to milliseconds, so two events in the SAME millisecond (plausible on bulk
 * fulfillment) would collide and the strict monotonic gate could drop the later one. We keep
 * sub-millisecond precision: epoch-ms * 1000 plus the microsecond remainder from the fractional
 * seconds. Result stays under Number.MAX_SAFE_INTEGER (~9.0e15) until ~year 2255. Both Node 22
 * and workerd are V8, which TRUNCATES Date.parse to ms, so the ms part and the parsed digits
 * agree. Returns 0 for absent/unparseable input: a 0-ts event can CREATE a row but never
 * ADVANCES one, so a bad timestamp fails safe (never regresses a known status).
 */
export function eventMicros(createdAt: unknown): number {
  if (typeof createdAt !== 'string') return 0;
  const ms = Date.parse(createdAt);
  if (!Number.isFinite(ms)) return 0;
  let subMs = 0; // microseconds within the millisecond, 0..999
  const frac = createdAt.match(/\.(\d+)/); // fractional-seconds group, e.g. "078089"
  if (frac) {
    const micros6 = (frac[1] + '000000').slice(0, 6); // pad/truncate to 6-digit microseconds
    subMs = parseInt(micros6.slice(3), 10) || 0;       // digits 4..6 = sub-millisecond micros
  }
  return ms * 1000 + subMs;
}

/**
 * Defensive extraction from a verified, parsed payload. The order object lives in the
 * event envelope's `data` (verified 2026-07-10 against Fourthwall's webhook-model:
 * { id: <EVENT id, weve_...>, type, data: <order> }); `order` is accepted as a defensive
 * alt spelling. We NEVER fall back to the envelope root, because p.id is the per-delivery
 * EVENT id: keying an order on it would break cross-event idempotency (an ORDER_PLACED
 * and a later ORDER_UPDATED for the SAME order carry different event ids and would write
 * two rows). Field spellings inside the order are walked defensively; whatever is absent
 * stays null/default and the FULL raw event is persisted alongside so no data is lost.
 * Never invents values.
 */
export function extractOrder(payload: unknown): ExtractedOrder | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const d = (p.data ?? p.order) as Record<string, unknown> | undefined;
  if (!d || typeof d !== 'object') return null; // no order envelope = nothing to store

  const fwId = str(d.id); // the ORDER id (data.id), never the envelope event id (p.id)
  if (!fwId || fwId.length > 128) return null; // no order id = nothing to key on; reject upstream

  const shipping = (d.shipping ?? {}) as Record<string, unknown>;
  const customer = (d.customer ?? {}) as Record<string, unknown>;
  const rawItems = d.offers ?? d.lineItems ?? d.line_items ?? d.items;

  return {
    fwId,
    friendlyId: str(d.friendlyId) ?? str(d.friendly_id),
    email: str(d.email) ?? str(customer.email),
    lineItems: Array.isArray(rawItems) ? JSON.stringify(rawItems) : '[]',
    // F5: shipping/fulfillment status ONLY from shipping.status / shippingStatus. The
    // order-root `d.status` is order-LIFECYCLE status (PLACED / CONFIRMED / CANCELLED etc.),
    // NOT fulfillment; mapping it into shipping_status mislabels the admin view. Dropped.
    // The exact live-wire fulfillment field path is a cutover re-verify item (V1_BETA
    // contract) -- see docs/webhook-cutover-runbook.md.
    shippingStatus: str(shipping.status) ?? str(d.shippingStatus) ?? 'unknown',
    eventType: str(p.type) ?? str(p.event) ?? str(p.topic),
    // F2/F3 monotonic key: ENVELOPE createdAt (event time, advances per delivery), NEVER the
    // order's own data.createdAt (constant across an order's events -> would freeze status).
    eventTs: eventMicros(p.createdAt ?? p.created_at),
  };
}

// ---------------------------------------------------------------------------------------------
// The webhook HANDLER, PURE (no `cloudflare:workers` import) so vitest can drive the full
// pipeline against a node:sqlite-backed D1 shim and read rows back. webhook.ts is the thin
// adapter that supplies env bindings. See docs/webhook-cutover-runbook.md for the V1_BETA
// re-verify items (type strings, status field path, sig header + encoding, createdAt semantics).
// ---------------------------------------------------------------------------------------------

export const MAX_BODY_BYTES = 100_000; // sanity cap: an order event is KBs, not a payload dump
// F1: Fourthwall's ONLY order events (docs verified this session; status changes, incl.
// shipping, arrive as ORDER_UPDATED - there are no separate ship/deliver/refund events).
// V1_BETA contract: re-verify the exact wire strings against one real delivery at cutover.
export const ALLOWED_EVENT_TYPES = new Set(['ORDER_PLACED', 'ORDER_UPDATED']);

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const pickType = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  return str(p.type) ?? str(p.event) ?? str(p.topic);
};

/** Minimal structural D1 surface the handler needs (real D1 and the node:sqlite test shim both satisfy it). */
export interface WebhookDeps {
  db?: { prepare(sql: string): { bind(...values: unknown[]): { run(): Promise<unknown> } } };
  secret?: string;
  sigHeader?: string;
}

class BodyTooLargeError extends Error {}

/**
 * F6: read the body into bytes, enforcing maxBytes WHILE streaming. The moment accumulated
 * length exceeds the cap we CANCEL the reader and throw, so an oversized body is abandoned
 * before it is fully buffered (bounded memory), not measured after a full drain. Falls back to
 * request.text() only when the body is not a stream (still byte-capped after encode).
 */
async function readCappedBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  const body = request.body as ReadableStream<Uint8Array> | null;
  if (!body || typeof body.getReader !== 'function') {
    const bytes = enc.encode(await request.text());
    if (bytes.length > maxBytes) throw new BodyTooLargeError();
    return bytes;
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel(); // abandon: do NOT drain the rest of an oversized body
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

/**
 * The Fourthwall order-webhook pipeline. Controls in order:
 *   1. Fail CLOSED on missing config (no DB or no secret = 500, no processing).
 *   2. F6 byte-length cap enforced WHILE buffering (413; abandons an oversized body early).
 *   3. HMAC-SHA256 over the EXACT received bytes, BEFORE any parse (401 on bad/missing).
 *   4. F1 event-type allowlist: ack non-order types 200 with NO write (kills phantom rows);
 *      log the dropped TYPE only (no PII) so a renamed/added FW order type surfaces.
 *   5. Signed+allowlisted but keyless (no order id) -> 400, write nothing.
 *   6. F2/F3 monotonic upsert (two watermarks). Every error path returns a rejection, never 200.
 */
export async function handleOrderWebhook(request: Request, deps: WebhookDeps): Promise<Response> {
  if (!deps.db || !deps.secret) {
    return json({ ok: false, error: 'server_misconfigured' }, 500); // fail closed, never process unsigned
  }

  // F6: fast-reject an over-cap Content-Length, then hard-cap the actual stream so a
  // lying/absent CL cannot bypass the limit (CL is an optimization; the stream cap is truth).
  const clRaw = request.headers.get('content-length');
  const cl = clRaw == null ? NaN : Number(clRaw);
  if (Number.isFinite(cl) && cl > MAX_BODY_BYTES) {
    return json({ ok: false, error: 'payload_too_large' }, 413);
  }

  let bodyBytes: Uint8Array;
  try {
    bodyBytes = await readCappedBody(request, MAX_BODY_BYTES);
  } catch (e) {
    if (e instanceof BodyTooLargeError) return json({ ok: false, error: 'payload_too_large' }, 413);
    return json({ ok: false, error: 'bad_request' }, 400); // reader error: never treat a partial body as complete
  }
  if (bodyBytes.length === 0) return json({ ok: false, error: 'bad_request' }, 400);

  // Signature over the EXACT received bytes, BEFORE parse. Missing and wrong look identical.
  const headerName = deps.sigHeader || DEFAULT_SIG_HEADER;
  const verified = await verifyWebhookSignatureBytes(deps.secret, bodyBytes, request.headers.get(headerName));
  if (!verified) return json({ ok: false, error: 'invalid_signature' }, 401);

  // Decode ONCE for parsing (the HMAC already covered the raw bytes). `raw` is the stored payload.
  const raw = new TextDecoder('utf-8', { fatal: false }).decode(bodyBytes);
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  // F1: allowlist the event type IN CODE. A signed non-order event (product.updated,
  // newsletter.subscribed, ...) must NOT write an orders row. Ack 200 so FW does not retry.
  const evType = pickType(payload);
  if (!evType || !ALLOWED_EVENT_TYPES.has(evType)) {
    console.warn(JSON.stringify({ evt: 'webhook_type_skipped', type: evType })); // TYPE only: no PII
    return json({ ok: true, skipped: true }, 200);
  }

  const order = extractOrder(payload);
  if (!order) return json({ ok: false, error: 'bad_request' }, 400); // signed+allowlisted but keyless: write nothing

  if (order.eventTs === 0) {
    // Silent-freeze tripwire: an allowlisted event whose envelope createdAt did not parse can
    // create a row but never advance one. Surface it (type + order id; neither is card/PII).
    console.warn(JSON.stringify({ evt: 'webhook_no_event_ts', type: evType, fwId: order.fwId }));
  }

  // F2/F3: monotonic upsert with TWO watermarks. event_ts = envelope freshness (guards
  // raw_event / event_ts / updated_at, so the row reflects the latest DELIVERED event).
  // status_event_ts = status freshness (guards shipping_status). statusEventTs is 0 for an
  // 'unknown' status, so an unknown event never advances the status high-water mark nor
  // overwrites a known status, while a later correctly-typed event STILL heals it (even if it
  // arrives out of order). friendly_id / email / line_items keep their additive (COALESCE /
  // non-empty) guards; they are order-invariant and intentionally NOT event_ts gated.
  const statusEventTs = order.shippingStatus === 'unknown' ? 0 : order.eventTs;
  try {
    await deps.db
      .prepare(
        `INSERT INTO orders (fw_id, friendly_id, email, line_items, shipping_status, raw_event, event_ts, status_event_ts)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(fw_id) DO UPDATE SET
           friendly_id     = COALESCE(excluded.friendly_id, friendly_id),
           email           = COALESCE(excluded.email, email),
           line_items      = CASE WHEN excluded.line_items != '[]' THEN excluded.line_items ELSE line_items END,
           shipping_status = CASE WHEN excluded.status_event_ts > status_event_ts THEN excluded.shipping_status ELSE shipping_status END,
           status_event_ts = CASE WHEN excluded.status_event_ts > status_event_ts THEN excluded.status_event_ts ELSE status_event_ts END,
           raw_event       = CASE WHEN excluded.event_ts > event_ts THEN excluded.raw_event ELSE raw_event END,
           event_ts        = CASE WHEN excluded.event_ts > event_ts THEN excluded.event_ts ELSE event_ts END,
           updated_at      = CASE WHEN excluded.event_ts > event_ts THEN datetime('now') ELSE updated_at END`,
      )
      .bind(order.fwId, order.friendlyId, order.email, order.lineItems, order.shippingStatus, raw, order.eventTs, statusEventTs)
      .run();
  } catch {
    return json({ ok: false, error: 'storage_failed' }, 500); // fail closed: FW retries per its retry policy
  }

  return json({ ok: true }, 200);
}
