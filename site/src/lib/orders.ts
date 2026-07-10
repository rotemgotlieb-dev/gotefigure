// S6 orders: webhook signature verification + defensive payload extraction.
// PURE module by design (no `cloudflare:workers` import) so vitest can exercise it
// directly; the endpoint owns all env/binding access.
//
// STEP A research basis (2026-07-10, docs.fourthwall.com/llms.txt + /webhooks/getting-started):
// Fourthwall publicly documents webhooks (order-placed, order-updated, donation,
// gift-purchase, ...) and a dedicated /webhooks/signature-verification page. The exact
// header name + digest encoding on that page were NOT readable within this sprint's
// research cap, so both are CONFIGURABLE (env FW_WEBHOOK_SIG_HEADER; base64 AND hex
// digests accepted) and must be aligned to that page at cutover. The mechanism itself
// is the doctrine's required control regardless of vendor detail: HMAC-SHA256 over the
// RAW request body, verified constant-time, before any parsing or write.

const enc = new TextEncoder();

/** Default signature header. NOT verified against Fourthwall docs yet; override via FW_WEBHOOK_SIG_HEADER at cutover. */
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
 * Defensive extraction from a verified, parsed payload. The real order-placed /
 * order-updated payload shape was not readable within the research cap, so this walks
 * the plausible envelope paths (data / order / root) and field spellings; whatever it
 * cannot find stays null/default, and the FULL raw event is persisted alongside so no
 * data is lost while the real shape is unverified. Never invents values.
 */
export function extractOrder(payload: unknown): ExtractedOrder | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const d = ((p.data ?? p.order ?? p) || {}) as Record<string, unknown>;

  const fwId = str(d.id) ?? str(p.id);
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
