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
 * Verify an HMAC-SHA256 signature over the RAW body. The provided signature may be
 * base64 or hex encoded (both decoded to bytes; comparison is constant-time via
 * crypto.subtle.verify, never a string ===). Empty/garbage input verifies false.
 */
export async function verifyWebhookSignature(secret: string, rawBody: string, signature: string | null): Promise<boolean> {
  if (!secret || !signature) return false;
  const sig = signature.trim();
  if (!sig || sig.length > 128) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const body = enc.encode(rawBody);
  for (const bytes of [b64ToBytes(sig), hexToBytes(sig.toLowerCase())]) {
    if (bytes && bytes.length === 32) {
      // Uint8Array is a valid BufferSource; cast keeps TS's ArrayBufferLike variance happy.
      if (await crypto.subtle.verify('HMAC', key, bytes as unknown as BufferSource, body)) return true;
    }
  }
  return false;
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
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

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
    shippingStatus: str(shipping.status) ?? str(d.shippingStatus) ?? str(d.status) ?? 'unknown',
    eventType: str(p.type) ?? str(p.event) ?? str(p.topic),
  };
}
