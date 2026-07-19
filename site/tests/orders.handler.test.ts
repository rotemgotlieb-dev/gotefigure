// Integration proof for the Fourthwall order webhook, driven through the PURE handleOrderWebhook
// against a node:sqlite-backed D1 shim (SQLite == D1 dialect). "Observation at the right layer":
// signed POSTs in, D1 rows read back. Each hardening ticket carries an OLD-CODE CONTROL that runs
// the pre-fix logic on the SAME input and shows it producing the WRONG observable. The env->handler
// adapter wiring and the workerd body stream are proven separately by the wrangler-dev smoke
// (docs/webhook-cutover-runbook.md + running log); this suite owns the SQL + pure pipeline.
import { describe, it, expect, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  handleOrderWebhook,
  signWebhookBody,
  extractOrder,
  DEFAULT_SIG_HEADER,
  MAX_BODY_BYTES,
} from '../src/lib/orders';

const SECRET = 'test_webhook_secret_0123456789abcdef';
const MIG = join(__dirname, '..', 'migrations');

// ---- minimal D1-compatible shim over node:sqlite (prepare().bind(...).run()/.first()/.all()) ----
function makeShim(db: InstanceType<typeof DatabaseSync>) {
  const wrap = (sql: string, args: unknown[]) => ({
    async run() {
      const r = db.prepare(sql).run(...(args as any[]));
      return { success: true, meta: { changes: r.changes, last_row_id: r.lastInsertRowid } };
    },
    async first() {
      const row = db.prepare(sql).get(...(args as any[]));
      return row === undefined ? null : row; // D1 .first() -> null; node:sqlite .get() -> undefined
    },
    async all() {
      const results = db.prepare(sql).all(...(args as any[]));
      return { success: true, results };
    },
  });
  return {
    prepare(sql: string) {
      return { bind: (...args: unknown[]) => wrap(sql, args), ...wrap(sql, []) };
    },
  };
}

function applyMigrations(db: InstanceType<typeof DatabaseSync>, prefixes: string[]) {
  const files = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
  for (const pfx of prefixes) {
    const f = files.find((x) => x.startsWith(pfx));
    if (!f) throw new Error('migration not found: ' + pfx);
    db.exec(readFileSync(join(MIG, f), 'utf8'));
  }
}

function newDb(prefixes = ['0001', '0002', '0003', '0004']) {
  const db = new DatabaseSync(':memory:');
  applyMigrations(db, prefixes);
  return db;
}

const deps = (db: InstanceType<typeof DatabaseSync>) => ({ db: makeShim(db), secret: SECRET });
const rowOf = (db: any, fwId: string) => db.prepare('SELECT * FROM orders WHERE fw_id = ?1').get(fwId);
const count = (db: any) => (db.prepare('SELECT COUNT(*) AS n FROM orders').get() as any).n;

// build a signed Request over a JSON envelope (string bodies stream through undici's ReadableStream)
async function signedReq(body: unknown, opts: { signWith?: string; headerName?: string; sig?: string | null } = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const headerName = opts.headerName ?? DEFAULT_SIG_HEADER;
  const sig = opts.sig !== undefined ? opts.sig : await signWebhookBody(opts.signWith ?? SECRET, raw);
  const headers: Record<string, string> = {};
  if (sig != null) headers[headerName] = sig;
  return new Request('https://x/api/orders/webhook', { method: 'POST', body: raw, headers });
}

// Fourthwall envelope helpers. Top-level createdAt = EVENT time (the monotonic key).
const T1 = '2026-07-18T10:00:00.100000+00:00';
const T2 = '2026-07-18T11:00:00.200000+00:00';
const T3 = '2026-07-18T12:00:00.300000+00:00';
const envelope = (type: string, dataId: string, createdAt: string, data: Record<string, unknown> = {}) => ({
  type,
  id: `weve_${type}_${createdAt}`,
  createdAt,
  data: { id: dataId, ...data },
});
const placed = (id: string, ts: string) =>
  envelope('ORDER_PLACED', id, ts, { friendlyId: 'GF-1', email: 'a@b.co', shipping: { status: 'pending' }, offers: [{ name: 'x', quantity: 1 }] });
const shipped = (id: string, ts: string) => envelope('ORDER_UPDATED', id, ts, { shipping: { status: 'shipped' } });
const unknownUpd = (id: string, ts: string) => envelope('ORDER_UPDATED', id, ts, {}); // no shipping status -> 'unknown'

describe('handleOrderWebhook: fail-closed + signature (preserved controls)', () => {
  it('fail-closed 500 on missing DB', async () => {
    const res = await handleOrderWebhook(await signedReq(placed('o', T1)), { db: undefined, secret: SECRET });
    expect(res.status).toBe(500);
  });
  it('fail-closed 500 on missing secret', async () => {
    const db = newDb();
    const res = await handleOrderWebhook(await signedReq(placed('o', T1)), { db: makeShim(db), secret: undefined });
    expect(res.status).toBe(500);
    expect(count(db)).toBe(0);
  });
  it('401 on a signature under the wrong secret, writes nothing', async () => {
    const db = newDb();
    const res = await handleOrderWebhook(await signedReq(placed('o', T1), { signWith: 'wrong-secret' }), deps(db));
    expect(res.status).toBe(401);
    expect(count(db)).toBe(0);
  });
  it('401 on a missing signature header', async () => {
    const db = newDb();
    const res = await handleOrderWebhook(await signedReq(placed('o', T1), { sig: null }), deps(db));
    expect(res.status).toBe(401);
    expect(count(db)).toBe(0);
  });
  it('400 on a signed-but-invalid JSON body', async () => {
    const db = newDb();
    const res = await handleOrderWebhook(await signedReq('{not json'), deps(db));
    expect(res.status).toBe(400);
    expect(count(db)).toBe(0);
  });
  it('happy path: signed ORDER_PLACED -> 200 + exactly 1 row; replay -> still 1 (idempotent)', async () => {
    const db = newDb();
    const r1 = await handleOrderWebhook(await signedReq(placed('ord_h', T1)), deps(db));
    expect(r1.status).toBe(200);
    expect(await r1.json()).toMatchObject({ ok: true });
    expect(count(db)).toBe(1);
    await handleOrderWebhook(await signedReq(placed('ord_h', T1)), deps(db)); // byte-identical replay
    expect(count(db)).toBe(1);
  });
});

describe('F1: event-type allowlist (ack-200-no-write for non-order types)', () => {
  it('signed non-order type (PRODUCT_UPDATED) with a valid data.id -> 200 skipped + 0 rows', async () => {
    const db = newDb();
    const product = envelope('PRODUCT_UPDATED', 'prod_1', T1, { title: 'A shirt' });
    // OLD-CODE CONTROL: the pre-F1 handler had no allowlist, so it extracted and WROTE this event.
    expect(extractOrder(product)).not.toBeNull(); // a writable order id existed -> old code wrote a phantom row
    const res = await handleOrderWebhook(await signedReq(product), deps(db));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, skipped: true });
    expect(count(db)).toBe(0); // NEW: no phantom row
  });
  it('signed NEWSLETTER_SUBSCRIBED carrying an email -> 200 + 0 rows (no subscriber leaks into orders)', async () => {
    const db = newDb();
    const news = envelope('NEWSLETTER_SUBSCRIBED', 'sub_1', T1, { email: 'leak@example.com' });
    const res = await handleOrderWebhook(await signedReq(news), deps(db));
    expect(res.status).toBe(200);
    expect(count(db)).toBe(0);
  });
  it('logs the dropped TYPE only (no PII) so a renamed/added FW order type surfaces', async () => {
    const db = newDb();
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await handleOrderWebhook(await signedReq(envelope('PRODUCT_UPDATED', 'p', T1, { email: 'secret@x.com' })), deps(db));
    const logged = spy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('webhook_type_skipped');
    expect(logged).toContain('PRODUCT_UPDATED');
    expect(logged).not.toContain('secret@x.com'); // TYPE only, never the payload
    spy.mockRestore();
  });
  it('signed but MISSING type -> 200 + 0 rows (not allowlisted; F4 reconcile is the backstop)', async () => {
    const db = newDb();
    const res = await handleOrderWebhook(await signedReq({ data: { id: 'ord_x' }, createdAt: T1 }), deps(db));
    expect(res.status).toBe(200);
    expect(count(db)).toBe(0);
  });
  it('allowlisted ORDER_PLACED but KEYLESS (no data.id) -> 400, writes nothing', async () => {
    const db = newDb();
    const res = await handleOrderWebhook(await signedReq({ type: 'ORDER_PLACED', createdAt: T1, data: { email: 'a@b.co' } }), deps(db));
    expect(res.status).toBe(400);
    expect(count(db)).toBe(0);
  });
});

describe('F2/F3: monotonic upsert (two watermarks) -- replay + out-of-order cannot regress', () => {
  it('advances on a newer event, HOLDS on replay/older, never regresses shipped->pending', async () => {
    const db = newDb();
    await handleOrderWebhook(await signedReq(placed('ord_m', T1)), deps(db)); // pending @T1
    expect(rowOf(db, 'ord_m').shipping_status).toBe('pending');

    await handleOrderWebhook(await signedReq(shipped('ord_m', T2)), deps(db)); // shipped @T2 (advances)
    const afterShip = rowOf(db, 'ord_m');
    expect(afterShip.shipping_status).toBe('shipped');
    const updatedAtAfterShip = afterShip.updated_at;

    await handleOrderWebhook(await signedReq(placed('ord_m', T1)), deps(db)); // replay OLDER placed
    const afterReplay = rowOf(db, 'ord_m');
    expect(afterReplay.shipping_status).toBe('shipped'); // NO regression
    expect(afterReplay.updated_at).toBe(updatedAtAfterShip); // idempotent: updated_at STABLE
    expect(count(db)).toBe(1);

    await handleOrderWebhook(await signedReq(unknownUpd('ord_m', T3)), deps(db)); // newer but status 'unknown'
    const afterUnknown = rowOf(db, 'ord_m');
    expect(afterUnknown.shipping_status).toBe('shipped'); // 'unknown' never overwrites a known status
    expect(afterUnknown.event_ts).toBeGreaterThan(afterShip.event_ts); // envelope freshness DID advance
  });

  it('out-of-order recovery: a genuinely-earlier real-status event still heals status after a newer unknown', async () => {
    const db = newDb();
    await handleOrderWebhook(await signedReq(placed('ord_o', T1)), deps(db)); // pending @T1
    await handleOrderWebhook(await signedReq(unknownUpd('ord_o', T3)), deps(db)); // unknown @T3 (advances envelope, holds status)
    expect(rowOf(db, 'ord_o').shipping_status).toBe('pending');
    await handleOrderWebhook(await signedReq(shipped('ord_o', T2)), deps(db)); // real shipped @T2 (T1<T2<T3) arrives LATE
    // Single-watermark would DROP this (T2 < envelope T3); two-watermark heals via status_event_ts.
    expect(rowOf(db, 'ord_o').shipping_status).toBe('shipped');
  });

  it('OLD-CODE CONTROL: the pre-fix unconditional upsert REGRESSES shipped->pending on the same replay', () => {
    const db = newDb();
    const oldUpsert = (o: any, raw: string) =>
      db
        .prepare(
          `INSERT INTO orders (fw_id, friendly_id, email, line_items, shipping_status, raw_event)
           VALUES (?1,?2,?3,?4,?5,?6)
           ON CONFLICT(fw_id) DO UPDATE SET
             shipping_status = excluded.shipping_status,
             raw_event = excluded.raw_event,
             updated_at = datetime('now')`,
        )
        .run(o.fwId, o.friendlyId, o.email, o.lineItems, o.shippingStatus, raw);
    const p = extractOrder(placed('ord_c', T1))!;
    const s = extractOrder(shipped('ord_c', T2))!;
    oldUpsert(p, JSON.stringify(placed('ord_c', T1)));
    oldUpsert(s, JSON.stringify(shipped('ord_c', T2)));
    expect(rowOf(db, 'ord_c').shipping_status).toBe('shipped');
    oldUpsert(p, JSON.stringify(placed('ord_c', T1))); // replay older under OLD code
    expect(rowOf(db, 'ord_c').shipping_status).toBe('pending'); // the REGRESSION F2/F3 fixes
  });
});

describe('F6: real byte-length cap enforced while buffering', () => {
  it('OLD-CODE CONTROL: a body whose UTF-16 length <= cap but UTF-8 bytes > cap is rejected (413)', async () => {
    const db = newDb();
    const heavy = 'ä'.repeat(60_000); // 60000 UTF-16 code units, 120000 UTF-8 bytes
    expect(heavy.length).toBeLessThanOrEqual(MAX_BODY_BYTES); // OLD `raw.length > MAX` -> false -> ACCEPTED
    expect(new TextEncoder().encode(heavy).length).toBeGreaterThan(MAX_BODY_BYTES); // NEW byte check -> reject
    const res = await handleOrderWebhook(await signedReq(heavy), deps(db));
    expect(res.status).toBe(413);
    expect(count(db)).toBe(0);
  });

  it('early abort: an oversized streamed body (no Content-Length) is abandoned before full drain', async () => {
    const db = newDb();
    const CHUNK = new Uint8Array(20_000);
    const totalChunks = 10; // 200KB total, cap 100KB
    let pulled = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (pulled >= totalChunks) return controller.close();
        pulled++;
        controller.enqueue(CHUNK);
      },
    });
    const req = new Request('https://x/api/orders/webhook', {
      method: 'POST',
      body: stream,
      // @ts-expect-error duplex is required for a stream body in undici/Node
      duplex: 'half',
      headers: { [DEFAULT_SIG_HEADER]: 'x' },
    });
    const res = await handleOrderWebhook(req, deps(db));
    expect(res.status).toBe(413);
    expect(pulled).toBeLessThan(totalChunks); // reader cancelled; the whole oversized body was NOT drained
    expect(count(db)).toBe(0);
  });

  it('empty body -> 400 (never proceeds to a 200)', async () => {
    const db = newDb();
    const res = await handleOrderWebhook(await signedReq(''), deps(db));
    expect(res.status).toBe(400);
  });

  it('a mid-stream reader error -> 400, never a partial-body success', async () => {
    const db = newDb();
    const stream = new ReadableStream({
      pull() {
        throw new Error('boom');
      },
    });
    const req = new Request('https://x/api/orders/webhook', {
      method: 'POST',
      body: stream,
      // @ts-expect-error duplex is required for a stream body in undici/Node
      duplex: 'half',
      headers: { [DEFAULT_SIG_HEADER]: 'x' },
    });
    const res = await handleOrderWebhook(req, deps(db));
    expect(res.status).toBe(400);
    expect(count(db)).toBe(0);
  });

  it('a valid signed multibyte (emoji/accented) body under the cap verifies and writes (round-trip integrity)', async () => {
    const db = newDb();
    const body = envelope('ORDER_PLACED', 'ord_u', T1, { email: 'a@b.co', note: 'café \u{1F680} Zürich' });
    const res = await handleOrderWebhook(await signedReq(body), deps(db));
    expect(res.status).toBe(200);
    expect(count(db)).toBe(1);
    expect(JSON.parse(rowOf(db, 'ord_u').raw_event).data.note).toBe('café \u{1F680} Zürich'); // bytes round-tripped intact
  });
});

describe('migration 0004 applies on top of an existing 0003 orders table', () => {
  it('backfills a legacy row to event_ts=0 / status_event_ts=0, and that row can still advance', async () => {
    const db = newDb(['0001', '0002', '0003']); // pre-0004 schema
    db.prepare("INSERT INTO orders (fw_id, shipping_status) VALUES ('legacy_1','pending')").run(); // legacy row, no event_ts column yet
    applyMigrations(db, ['0004']); // the ALTER under test
    const legacy = rowOf(db, 'legacy_1');
    expect(legacy.event_ts).toBe(0);
    expect(legacy.status_event_ts).toBe(0);
    // a real event advances the backfilled legacy row (real event_ts > 0)
    await handleOrderWebhook(await signedReq(shipped('legacy_1', T2)), deps(db));
    expect(rowOf(db, 'legacy_1').shipping_status).toBe('shipped');
  });
});
