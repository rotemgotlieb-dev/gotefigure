#!/usr/bin/env node
// Delivery proof for the order webhook against the BUILT worker under `wrangler dev --local`.
// vitest proves the SQL + pure pipeline; THIS proves what vitest structurally cannot: the
// cloudflare:workers env -> handleOrderWebhook adapter wiring, the real workerd request stream,
// and the real D1 binding. Rows are read back with `wrangler d1 execute --local`.
// Local only: local test secret, local D1, no remote state. Not wired into npm scripts.
import { execFileSync } from 'node:child_process';

const URL_ = process.env.SMOKE_URL || 'http://127.0.0.1:8788/api/orders/webhook';
const SECRET = process.env.SMOKE_SECRET || 'local_test_only_not_a_real_secret_0123456789';
const HEADER = 'x-fourthwall-hmac-sha256';

const sign = async (body) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Buffer.from(new Uint8Array(mac)).toString('base64');
};

const post = async (body, { sig, raw } = {}) => {
  const b = raw ?? JSON.stringify(body);
  const headers = { 'content-type': 'application/json' };
  const s = sig === null ? null : (sig ?? (await sign(b)));
  if (s !== null) headers[HEADER] = s;
  const res = await fetch(URL_, { method: 'POST', body: b, headers });
  return { status: res.status, body: await res.text() };
};

const d1 = (sql) => {
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'gotefigure', '--local', '--json', '--command', sql], { encoding: 'utf8' });
  return JSON.parse(out.slice(out.indexOf('[')))[0].results;
};

const rowOf = (id) => d1(`SELECT fw_id, shipping_status, event_ts, status_event_ts, updated_at FROM orders WHERE fw_id='${id}'`)[0];
const countOf = (id) => d1(`SELECT COUNT(*) AS n FROM orders WHERE fw_id='${id}'`)[0].n;

const T1 = '2026-07-18T10:00:00.100000+00:00';
const T2 = '2026-07-18T11:00:00.200000+00:00';
const env = (type, id, createdAt, data = {}) => ({ type, id: `weve_${createdAt}`, createdAt, data: { id, ...data } });

let failures = 0;
const check = (name, cond, detail) => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${detail}` : ''}`);
  if (!cond) failures++;
};

const ID = `smoke_${Date.now()}`;
d1(`DELETE FROM orders WHERE fw_id LIKE 'smoke_%'`);

console.log('\n== delivery proof: built worker + real D1 binding ==');

// 1. unsigned -> 401, no row
check('unsigned POST rejected 401', (await post(env('ORDER_PLACED', ID, T1), { sig: null })).status === 401);
check('  ... and wrote no row', countOf(ID) === 0);

// 2. wrong signature -> 401
check('wrong-signature POST rejected 401', (await post(env('ORDER_PLACED', ID, T1), { sig: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' })).status === 401);

// 3. signed ORDER_PLACED -> 200 + exactly 1 row (adapter wiring + D1 binding proven here)
const placed = env('ORDER_PLACED', ID, T1, { friendlyId: 'GF-S1', email: 'smoke@example.com', shipping: { status: 'pending' } });
const r3 = await post(placed);
check('signed ORDER_PLACED -> 200', r3.status === 200, r3.body);
check('  ... exactly 1 row', countOf(ID) === 1);
check('  ... shipping_status=pending', rowOf(ID)?.shipping_status === 'pending', JSON.stringify(rowOf(ID)));
// T1's fraction ".100000" is 100 MILLIseconds + 0 microseconds, so micros == Date.parse(T1)*1000.
// T2 (".200000") is the same shape; the sub-ms path is proven by the vitest eventMicros cases.
check('  ... event_ts recorded in MICROseconds (envelope createdAt)', Number(rowOf(ID)?.event_ts) === Date.parse(T1) * 1000, String(rowOf(ID)?.event_ts));

// 4. byte-identical replay -> still 1 row (idempotent)
await post(placed);
check('byte-identical replay -> still exactly 1 row', countOf(ID) === 1);

// 5. newer ORDER_UPDATED -> status advances
await post(env('ORDER_UPDATED', ID, T2, { shipping: { status: 'shipped' } }));
const shippedRow = rowOf(ID);
check('newer ORDER_UPDATED advances status to shipped', shippedRow?.shipping_status === 'shipped', JSON.stringify(shippedRow));

// 6. replay the OLDER placed -> must NOT regress (the F2/F3 headline)
await post(placed);
const afterReplay = rowOf(ID);
check('replayed OLDER event does NOT regress shipped->pending', afterReplay?.shipping_status === 'shipped', JSON.stringify(afterReplay));
check('  ... updated_at stable (true no-op)', afterReplay?.updated_at === shippedRow?.updated_at);

// 7. F1: signed non-order type -> 200 ack, NO row
const PID = `smoke_phantom_${Date.now()}`;
const r7 = await post(env('PRODUCT_UPDATED', PID, T1, { title: 'a shirt' }));
check('signed non-order type acked 200', r7.status === 200, r7.body);
check('  ... wrote NO phantom row', countOf(PID) === 0);

// 8. F6: oversized body -> 413, no row (bytes, not code units: multibyte chars)
const OID = `smoke_big_${Date.now()}`;
const bigNote = 'ä'.repeat(60_000); // 60k UTF-16 units, 120k UTF-8 bytes: old check would ACCEPT
const r8 = await post(null, { raw: JSON.stringify(env('ORDER_PLACED', OID, T1, { note: bigNote })) });
check('oversized (multibyte) body rejected 413', r8.status === 413, `status=${r8.status}`);
check('  ... wrote no row', countOf(OID) === 0);
// KNOWN, NOT A REGRESSION: rejecting a large POST without consuming its body resets that
// keep-alive connection, so the NEXT request on it gets a one-shot 503 before recovering.
// Proven inherent, not caused by the early abort: a drain-fully-then-reject variant (which is
// main's pre-F6 behavior) reproduces the identical 413 -> 503 -> 200 sequence. Different clients
// use different connections, so one sender's oversized POST cannot disturb another's delivery.
// Absorb the casualty here so the assertions below test the handler, not the socket.
await post(env('ORDER_PLACED', `smoke_settle_${Date.now()}`, T1, { email: 'a@b.co' }));

// 9. multibyte body UNDER the cap still verifies (byte round-trip integrity through workerd)
const MID = `smoke_utf8_${Date.now()}`;
const r9 = await post(env('ORDER_PLACED', MID, T1, { email: 'a@b.co', note: 'café \u{1F680} Zürich' }));
check('signed multibyte body under cap -> 200', r9.status === 200, r9.body);
check('  ... wrote its row', countOf(MID) === 1);

d1(`DELETE FROM orders WHERE fw_id LIKE 'smoke_%'`);
console.log(`\n${failures === 0 ? 'SMOKE PASS' : `SMOKE FAIL (${failures})`}\n`);
process.exit(failures === 0 ? 0 : 1);
