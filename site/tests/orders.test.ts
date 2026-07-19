// S6 unit contract for the pure webhook helpers (lib/orders.ts). The OBSERVED end-to-end
// proof (signed POST -> 1 D1 row, replay -> still 1, unsigned -> 401) runs against the
// built worker via wrangler dev; these tests pin the pure logic the endpoint composes.
import { describe, it, expect } from 'vitest';
import {
  verifyWebhookSignature,
  verifyWebhookSignatureBytes,
  signWebhookBody,
  extractOrder,
  eventMicros,
  DEFAULT_SIG_HEADER,
} from '../src/lib/orders';

const SECRET = 'test_webhook_secret_0123456789abcdef';
const BODY = JSON.stringify({ type: 'ORDER_PLACED', data: { id: 'fw-ord-001', email: 'a@b.co' } });

describe('verifyWebhookSignature (HMAC-SHA256 on the RAW body)', () => {
  it('accepts the correct base64 signature', async () => {
    const sig = await signWebhookBody(SECRET, BODY);
    expect(await verifyWebhookSignature(SECRET, BODY, sig)).toBe(true);
  });

  it('accepts the same digest hex-encoded (encoding unverified at FW until cutover)', async () => {
    const b64 = await signWebhookBody(SECRET, BODY);
    const hex = [...Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))]
      .map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(await verifyWebhookSignature(SECRET, BODY, hex)).toBe(true);
  });

  it('rejects a signature over DIFFERENT bytes (raw-body binding)', async () => {
    const sig = await signWebhookBody(SECRET, BODY);
    expect(await verifyWebhookSignature(SECRET, BODY + ' ', sig)).toBe(false);
  });

  it('rejects a signature under the wrong secret', async () => {
    const sig = await signWebhookBody('wrong-secret', BODY);
    expect(await verifyWebhookSignature(SECRET, BODY, sig)).toBe(false);
  });

  it('rejects missing / empty / garbage / oversized headers', async () => {
    expect(await verifyWebhookSignature(SECRET, BODY, null)).toBe(false);
    expect(await verifyWebhookSignature(SECRET, BODY, '')).toBe(false);
    expect(await verifyWebhookSignature(SECRET, BODY, 'not-a-signature!!')).toBe(false);
    expect(await verifyWebhookSignature(SECRET, BODY, 'a'.repeat(200))).toBe(false);
  });

  it('rejects everything when the secret is empty (fail closed)', async () => {
    const sig = await signWebhookBody(SECRET, BODY);
    expect(await verifyWebhookSignature('', BODY, sig)).toBe(false);
  });

  it('default header name is the documented cutover knob', () => {
    expect(DEFAULT_SIG_HEADER).toBe('x-fourthwall-hmac-sha256');
  });
});

describe('extractOrder (defensive envelope walk; never invents values)', () => {
  it('extracts the primary data-envelope shape', () => {
    const o = extractOrder({
      type: 'ORDER_PLACED',
      data: {
        id: 'fw-ord-001', friendlyId: 'GF-1001', email: 'a@b.co',
        offers: [{ name: 'Goggle Rabbit sticker', quantity: 1 }],
        shipping: { status: 'pending' },
      },
    });
    expect(o).toMatchObject({
      fwId: 'fw-ord-001', friendlyId: 'GF-1001', email: 'a@b.co',
      shippingStatus: 'pending', eventType: 'ORDER_PLACED',
    });
    expect(JSON.parse(o!.lineItems)).toHaveLength(1);
  });

  it('falls back across alternate spellings and root envelopes (F5: order-root status is NOT shipping)', () => {
    // F5 OLD-CODE CONTROL. This exact input used to yield shippingStatus:'shipped' via the
    // dropped `?? str(d.status)` fallback, conflating ORDER-LIFECYCLE status with shipping/
    // fulfillment status. Post-F5 the order-root `status` is ignored for shipping_status.
    const o = extractOrder({ event: 'order-updated', order: { id: 'x1', friendly_id: 'GF-2', line_items: [], status: 'shipped' } });
    expect(o).toMatchObject({ fwId: 'x1', friendlyId: 'GF-2', shippingStatus: 'unknown', eventType: 'order-updated' });
    // The OLD walk (with the d.status fallback) returned 'shipped' on the SAME input -- proof the fix changes behavior:
    const oldShippingWalk = (d: any) => d.shipping?.status ?? d.shippingStatus ?? d.status ?? 'unknown';
    expect(oldShippingWalk({ id: 'x1', status: 'shipped' })).toBe('shipped');
    expect(o!.shippingStatus).not.toBe(oldShippingWalk({ id: 'x1', status: 'shipped' }));
  });

  it('F5: real shipping/fulfillment status still wins from shipping.status / shippingStatus', () => {
    expect(extractOrder({ type: 'ORDER_UPDATED', data: { id: 'o1', shipping: { status: 'shipped' } } })!.shippingStatus).toBe('shipped');
    expect(extractOrder({ type: 'ORDER_UPDATED', data: { id: 'o2', shippingStatus: 'fulfilled' } })!.shippingStatus).toBe('fulfilled');
    // shipping.status wins over the alt spelling when both are present
    expect(extractOrder({ type: 'ORDER_UPDATED', data: { id: 'o3', shipping: { status: 'delivered' }, shippingStatus: 'shipped' } })!.shippingStatus).toBe('delivered');
  });

  it('returns null with no usable order id (endpoint rejects, writes nothing)', () => {
    expect(extractOrder({ type: 'ORDER_PLACED', data: { email: 'a@b.co' } })).toBeNull();
    expect(extractOrder('not-an-object')).toBeNull();
    expect(extractOrder(null)).toBeNull();
    expect(extractOrder({ data: { id: 'y'.repeat(200) } })).toBeNull();
  });

  it('NEVER keys an order on the envelope event id (webhook-model: top-level id is the per-delivery event id)', () => {
    // A real Fourthwall envelope has a top-level `id` = event id (weve_...) that changes
    // every delivery; the order id lives in `data.id`. If `data.id` is absent, the event
    // MUST be rejected, never keyed on the event id - else ORDER_PLACED and a later
    // ORDER_UPDATED for the SAME order (different event ids) would write two rows and
    // break idempotency.
    expect(extractOrder({ id: 'weve_event_abc', type: 'ORDER_PLACED', data: { email: 'a@b.co' } })).toBeNull();
    // And when data.id IS present, it wins over the envelope event id.
    const o = extractOrder({ id: 'weve_event_abc', type: 'ORDER_PLACED', data: { id: 'ord_1', friendlyId: 'GF-1001' } });
    expect(o?.fwId).toBe('ord_1');
  });

  it('defaults, never fabricates: unknown status + empty items', () => {
    const o = extractOrder({ data: { id: 'z9' } });
    expect(o).toMatchObject({ fwId: 'z9', friendlyId: null, email: null, lineItems: '[]', shippingStatus: 'unknown' });
  });
});

describe('eventMicros (F2/F3 monotonic key: microsecond resolution, no ms-truncation collision)', () => {
  const SAMPLE = '2023-07-12T15:05:11.078089+00:00'; // Fourthwall webhook-model example createdAt

  it('captures sub-millisecond microseconds (Date.parse alone would drop them)', () => {
    // Date.parse truncates to ms (…078); eventMicros preserves the full …078089 microseconds.
    expect(eventMicros(SAMPLE)).toBe(Date.parse(SAMPLE) * 1000 + 89);
    expect(eventMicros(SAMPLE)).toBeGreaterThan(0);
    expect(Number.isSafeInteger(eventMicros(SAMPLE))).toBe(true);
  });

  it('OLD-CODE CONTROL: two same-millisecond events collide under Date.parse but stay distinct in micros', () => {
    const a = '2023-07-12T15:05:11.078089+00:00';
    const b = '2023-07-12T15:05:11.078129+00:00'; // 40 microseconds later, SAME millisecond
    expect(Date.parse(a)).toBe(Date.parse(b)); // ms truncation: identical -> strict > would DROP the later
    expect(eventMicros(b)).toBeGreaterThan(eventMicros(a)); // micros: distinct -> strict > keeps ordering
    expect(eventMicros(b) - eventMicros(a)).toBe(40);
  });

  it('whole-second timestamps (no fraction) parse with zero sub-ms', () => {
    const s = '2023-07-12T15:05:11+00:00';
    expect(eventMicros(s)).toBe(Date.parse(s) * 1000);
  });

  it('fails safe to 0 on absent / unparseable / non-string input', () => {
    expect(eventMicros(undefined)).toBe(0);
    expect(eventMicros(null)).toBe(0);
    expect(eventMicros(1689174311078)).toBe(0);
    expect(eventMicros('not-a-date')).toBe(0);
    expect(eventMicros('')).toBe(0);
  });

  it('extractOrder keys eventTs off the ENVELOPE createdAt, NEVER the order data.createdAt', () => {
    // Wiring the wrong (constant) data.createdAt would freeze status forever; prove the envelope wins.
    const later = '2023-07-12T15:05:11.078089+00:00';
    const earlier = '2020-01-01T00:00:00.000000+00:00';
    const o = extractOrder({ type: 'ORDER_UPDATED', createdAt: later, data: { id: 'o1', createdAt: earlier } });
    expect(o!.eventTs).toBe(eventMicros(later));
    expect(o!.eventTs).not.toBe(eventMicros(earlier));
    // absent envelope createdAt -> eventTs 0 (the handler logs this and the row can create but not advance)
    expect(extractOrder({ type: 'ORDER_UPDATED', data: { id: 'o2' } })!.eventTs).toBe(0);
  });
});

describe('verifyWebhookSignatureBytes (byte-native HMAC; no UTF-8 round-trip corruption)', () => {
  const MULTIBYTE = JSON.stringify({ type: 'ORDER_PLACED', data: { id: 'x1', note: 'café \u{1F680} Zürich' } });

  it('verifies a signature over the exact UTF-8 bytes', async () => {
    const sig = await signWebhookBody(SECRET, MULTIBYTE);
    const bytes = new TextEncoder().encode(MULTIBYTE);
    expect(await verifyWebhookSignatureBytes(SECRET, bytes, sig)).toBe(true);
  });

  it('string and byte paths agree on a non-ASCII body (round-trip integrity)', async () => {
    const sig = await signWebhookBody(SECRET, MULTIBYTE);
    const bytes = new TextEncoder().encode(MULTIBYTE);
    expect(await verifyWebhookSignature(SECRET, MULTIBYTE, sig)).toBe(true);
    expect(await verifyWebhookSignatureBytes(SECRET, bytes, sig)).toBe(true);
  });

  it('rejects a byte body that differs by one byte', async () => {
    const sig = await signWebhookBody(SECRET, MULTIBYTE);
    const bytes = new TextEncoder().encode(MULTIBYTE + ' ');
    expect(await verifyWebhookSignatureBytes(SECRET, bytes, sig)).toBe(false);
  });
});
