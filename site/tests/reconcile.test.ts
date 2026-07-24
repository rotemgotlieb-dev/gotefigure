// Integration proof for the Sprint 4 backfill + reconcile lane, driven through the PURE
// handleReconcileRequest / runReconcile against the node:sqlite D1 shim and a stubbed
// Fourthwall fetch. Observation at the right layer: requests in, rows and reports read
// back. The load-bearing safety claims each get an adversarial case:
//   - report-only never writes; apply is strictly additive (DO NOTHING on conflict)
//   - a backfilled row (event_ts 0) never blocks a later real webhook event
//   - FW lifecycle status never lands in shipping_status
//   - fail closed on missing config, bad token, and FW non-200s (an auth failure must not
//     read as "no drift")
//   - missing_remote is reported, never deleted, and suppressed on a windowed pull
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  runReconcile,
  handleReconcileRequest,
  extractRemoteOrder,
  fetchAllRemoteOrders,
  tokensEqual,
  MAX_PAGES,
  PAGE_SIZE,
} from '../src/lib/reconcile';
import { handleOrderWebhook, signWebhookBody, DEFAULT_SIG_HEADER } from '../src/lib/orders';

const MIG = join(__dirname, '..', 'migrations');
const SECRET = 'test_webhook_secret_0123456789abcdef';
const TOKEN = 'reconcile_token_fedcba9876543210';
const BASIC = 'shopkey:shhh';

function makeShim(db: InstanceType<typeof DatabaseSync>) {
  const wrap = (sql: string, args: unknown[]) => ({
    async run() {
      const r = db.prepare(sql).run(...(args as any[]));
      return { success: true, meta: { changes: r.changes, last_row_id: r.lastInsertRowid } };
    },
    async first() {
      const row = db.prepare(sql).get(...(args as any[]));
      return row === undefined ? null : row;
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

function newDb() {
  const db = new DatabaseSync(':memory:');
  const files = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) db.exec(readFileSync(join(MIG, f), 'utf8'));
  return db;
}

const rowOf = (db: any, fwId: string) => db.prepare('SELECT * FROM orders WHERE fw_id = ?1').get(fwId);
const count = (db: any) => (db.prepare('SELECT COUNT(*) AS n FROM orders').get() as any).n;

/** Stub FW List Orders: serves `orders` split into PAGE_SIZE pages; records every request URL. */
function fwStub(orders: Record<string, unknown>[], opts: { status?: number } = {}) {
  const calls: string[] = [];
  const fetchFn = (async (input: any) => {
    const url = String(input);
    calls.push(url);
    if (opts.status && opts.status !== 200) return new Response('nope', { status: opts.status });
    const page = Number(new URL(url).searchParams.get('page') ?? '0');
    const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
    const results = orders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    return new Response(JSON.stringify({ results, total: orders.length, page, size: PAGE_SIZE, totalPages }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

const remoteOrder = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  friendlyId: `GF-${id}`,
  email: `${id}@example.com`,
  status: 'CONFIRMED',
  createdAt: '2026-07-20T10:00:00.000000+00:00',
  offers: [{ name: 'tee', variant: { size: 'M' } }],
  ...extra,
});

const deps = (db: InstanceType<typeof DatabaseSync>, fetchFn: typeof fetch) => ({
  db: makeShim(db),
  fwBasic: BASIC,
  fetchFn,
  apiBase: 'https://fw.test',
});

async function seedWebhookOrder(db: InstanceType<typeof DatabaseSync>, fwId: string, ts: string, status = 'pending') {
  const raw = JSON.stringify({
    type: 'ORDER_PLACED',
    id: `weve_${fwId}`,
    createdAt: ts,
    data: { id: fwId, friendlyId: `GF-${fwId}`, email: 'a@b.co', shipping: { status } },
  });
  const req = new Request('https://x/api/orders/webhook', {
    method: 'POST',
    body: raw,
    headers: { [DEFAULT_SIG_HEADER]: await signWebhookBody(SECRET, raw) },
  });
  const res = await handleOrderWebhook(req, { db: makeShim(db), secret: SECRET });
  expect(res.status).toBe(200);
}

describe('extractRemoteOrder', () => {
  it('walks a documented item and rejects keyless/oversized ids', () => {
    const o = extractRemoteOrder(remoteOrder('ord_1'));
    expect(o).toMatchObject({ id: 'ord_1', friendlyId: 'GF-ord_1', status: 'CONFIRMED' });
    expect(extractRemoteOrder({ friendlyId: 'no-id' })).toBeNull();
    expect(extractRemoteOrder({ id: 'x'.repeat(129) })).toBeNull();
    expect(extractRemoteOrder('junk')).toBeNull();
  });
});

describe('fetchAllRemoteOrders', () => {
  it('paginates to totalPages and aggregates', async () => {
    const orders = Array.from({ length: PAGE_SIZE + 3 }, (_, i) => remoteOrder(`p${i}`));
    const { fetchFn, calls } = fwStub(orders);
    const db = newDb();
    const got = await fetchAllRemoteOrders(deps(db, fetchFn));
    expect(got.orders.length).toBe(PAGE_SIZE + 3);
    expect(got.truncated).toBe(false);
    expect(calls.length).toBe(2);
    expect(calls[0]).toContain('page=0');
    expect(calls[1]).toContain('page=1');
  });
  it('throws on a non-200 so an auth failure never reads as an empty shop', async () => {
    const { fetchFn } = fwStub([], { status: 401 });
    const db = newDb();
    await expect(fetchAllRemoteOrders(deps(db, fetchFn))).rejects.toThrow('fw_list_orders_401');
  });
  it('passes the createdAt[gt] window through', async () => {
    const { fetchFn, calls } = fwStub([remoteOrder('w1')]);
    const db = newDb();
    await fetchAllRemoteOrders(deps(db, fetchFn), '2026-07-01T00:00:00.000Z');
    expect(decodeURIComponent(calls[0])).toContain('createdAt[gt]=2026-07-01');
  });
});

describe('runReconcile: report-only (the default)', () => {
  it('reports drift in both directions and writes NOTHING', async () => {
    const db = newDb();
    await seedWebhookOrder(db, 'local_only', '2026-07-18T10:00:00.100000+00:00');
    const { fetchFn } = fwStub([remoteOrder('remote_only'), remoteOrder('local_only')]);
    const before = count(db);

    const report = await runReconcile(deps(db, fetchFn));
    expect(report.ok).toBe(true);
    expect(report.remoteCount).toBe(2);
    expect(report.localCount).toBe(1);
    expect(report.missingLocal).toEqual([{ fwId: 'remote_only', friendlyId: 'GF-remote_only' }]);
    expect(report.missingRemote).toEqual([]);
    expect(report.applied).toBe(0);
    expect(count(db)).toBe(before); // report-only wrote nothing
  });
  it('reports a local phantom (missing_remote) and never deletes it', async () => {
    const db = newDb();
    await seedWebhookOrder(db, 'phantom', '2026-07-18T10:00:00.100000+00:00');
    const { fetchFn } = fwStub([]);
    const report = await runReconcile(deps(db, fetchFn));
    expect(report.missingRemote).toEqual([{ fwId: 'phantom', friendlyId: 'GF-phantom' }]);
    expect(rowOf(db, 'phantom')).toBeTruthy(); // still there
  });
  it('suppresses missing_remote on a windowed (sinceIso) pull: a window is not full truth', async () => {
    const db = newDb();
    await seedWebhookOrder(db, 'old_row', '2026-07-01T10:00:00.100000+00:00');
    const { fetchFn } = fwStub([]); // window returns nothing
    const report = await runReconcile(deps(db, fetchFn), { sinceIso: '2026-07-15T00:00:00.000Z' });
    expect(report.ok).toBe(true);
    expect(report.missingRemote).toEqual([]); // NOT reported as drift
  });
  it('fails closed on missing config', async () => {
    const { fetchFn } = fwStub([]);
    expect((await runReconcile({ fetchFn })).error).toBe('server_misconfigured');
    const db = newDb();
    expect((await runReconcile({ db: makeShim(db), fetchFn })).error).toBe('server_misconfigured');
  });
});

describe('runReconcile: apply (backfill)', () => {
  it('inserts ONLY missing rows: event_ts 0, shipping_status unknown, provenance marker; lifecycle status never lands', async () => {
    const db = newDb();
    await seedWebhookOrder(db, 'existing', '2026-07-18T10:00:00.100000+00:00', 'shipped');
    const { fetchFn } = fwStub([remoteOrder('dropped', { status: 'SHIPPED' }), remoteOrder('existing', { status: 'CANCELLED' })]);

    const report = await runReconcile(deps(db, fetchFn), { apply: true });
    expect(report.ok).toBe(true);
    expect(report.applied).toBe(1);
    expect(count(db)).toBe(2);

    const backfilled = rowOf(db, 'dropped');
    expect(backfilled.shipping_status).toBe('unknown'); // F5: SHIPPED lifecycle NOT mapped
    expect(backfilled.event_ts).toBe(0);
    expect(backfilled.status_event_ts).toBe(0);
    expect(String(backfilled.raw_event)).toContain('RECONCILE_BACKFILL');
    expect(String(backfilled.line_items)).toContain('tee');

    // the existing webhook-delivered row is untouched (CANCELLED did not leak in, status intact)
    const existing = rowOf(db, 'existing');
    expect(existing.shipping_status).toBe('shipped');
    expect(String(existing.raw_event)).not.toContain('RECONCILE_BACKFILL');
  });
  it('a backfilled 0-ts row never blocks the later real webhook event', async () => {
    const db = newDb();
    const { fetchFn } = fwStub([remoteOrder('late_delivery')]);
    await runReconcile(deps(db, fetchFn), { apply: true });
    expect(rowOf(db, 'late_delivery').shipping_status).toBe('unknown');

    // now the genuine webhook delivery finally arrives and must advance normally
    await seedWebhookOrder(db, 'late_delivery', '2026-07-19T09:00:00.500000+00:00', 'shipped');
    const row = rowOf(db, 'late_delivery');
    expect(row.shipping_status).toBe('shipped');
    expect(Number(row.event_ts)).toBeGreaterThan(0);
    expect(count(db)).toBe(1); // upsert, not a second row
  });
  it('apply on a clean shop applies zero', async () => {
    const db = newDb();
    await seedWebhookOrder(db, 'clean', '2026-07-18T10:00:00.100000+00:00');
    const { fetchFn } = fwStub([remoteOrder('clean')]);
    const report = await runReconcile(deps(db, fetchFn), { apply: true });
    expect(report.applied).toBe(0);
    expect(count(db)).toBe(1);
  });
});

describe('tokensEqual', () => {
  it('accepts equal, rejects different and prefix strings', async () => {
    expect(await tokensEqual(TOKEN, TOKEN)).toBe(true);
    expect(await tokensEqual(TOKEN, TOKEN + 'x')).toBe(false);
    expect(await tokensEqual(TOKEN, TOKEN.slice(0, -1))).toBe(false);
    expect(await tokensEqual(TOKEN, '')).toBe(false);
  });
});

describe('handleReconcileRequest (the endpoint pipeline)', () => {
  const req = (body: unknown, token: string | null = TOKEN) => {
    const headers: Record<string, string> = {};
    if (token != null) headers['x-reconcile-token'] = token;
    return new Request('https://x/api/orders/reconcile', {
      method: 'POST',
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      headers,
    });
  };
  const edeps = (db: InstanceType<typeof DatabaseSync>, fetchFn: typeof fetch) => ({
    ...deps(db, fetchFn),
    token: TOKEN,
  });

  it('500 on missing config (db / credentials / token), before any token check', async () => {
    const { fetchFn } = fwStub([]);
    const db = newDb();
    expect((await handleReconcileRequest(req({}), { fetchFn, token: TOKEN, fwBasic: BASIC })).status).toBe(500);
    expect((await handleReconcileRequest(req({}), { db: makeShim(db), fetchFn, token: TOKEN })).status).toBe(500);
    expect((await handleReconcileRequest(req({}), { db: makeShim(db), fetchFn, fwBasic: BASIC })).status).toBe(500);
  });
  it('401 on missing or wrong token, identical bodies, zero FW calls made', async () => {
    const db = newDb();
    const { fetchFn, calls } = fwStub([remoteOrder('x')]);
    const r1 = await handleReconcileRequest(req({}, null), edeps(db, fetchFn));
    const r2 = await handleReconcileRequest(req({}, 'wrong'), edeps(db, fetchFn));
    expect(r1.status).toBe(401);
    expect(r2.status).toBe(401);
    expect(await r1.text()).toBe(await r2.text()); // missing and wrong are indistinguishable
    expect(calls.length).toBe(0); // rejected before any remote work
  });
  it('400 on a malformed JSON body', async () => {
    const db = newDb();
    const { fetchFn } = fwStub([]);
    expect((await handleReconcileRequest(req('{nope'), edeps(db, fetchFn))).status).toBe(400);
  });
  it('valid token, empty body -> report-only 200; apply must be LITERALLY true', async () => {
    const db = newDb();
    const { fetchFn } = fwStub([remoteOrder('r1')]);
    const res = await handleReconcileRequest(req({ apply: 'yes' }), edeps(db, fetchFn)); // truthy string is NOT true
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.applied).toBe(0);
    expect(count(db)).toBe(0);
  });
  it('apply: true backfills and reads back', async () => {
    const db = newDb();
    const { fetchFn } = fwStub([remoteOrder('r2')]);
    const res = await handleReconcileRequest(req({ apply: true }), edeps(db, fetchFn));
    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
    expect(body.applied).toBe(1);
    expect(rowOf(db, 'r2')).toBeTruthy();
  });
  it('502 with a named error when FW answers non-200 (auth failure is not "no drift")', async () => {
    const db = newDb();
    const { fetchFn } = fwStub([], { status: 403 });
    const res = await handleReconcileRequest(req({}), edeps(db, fetchFn));
    expect(res.status).toBe(502);
    expect(((await res.json()) as any).error).toBe('fw_list_orders_403');
    expect(count(db)).toBe(0);
  });
  it('sinceDays is clamped: invalid values fall back to a full pull', async () => {
    const db = newDb();
    const { fetchFn, calls } = fwStub([]);
    await handleReconcileRequest(req({ sinceDays: 30 }), edeps(db, fetchFn));
    expect(decodeURIComponent(calls[0])).toContain('createdAt[gt]=');
    calls.length = 0;
    await handleReconcileRequest(req({ sinceDays: -5 }), edeps(db, fetchFn));
    expect(calls[0]).not.toContain('createdAt');
    calls.length = 0;
    await handleReconcileRequest(req({ sinceDays: 9999 }), edeps(db, fetchFn));
    expect(calls[0]).not.toContain('createdAt');
  });
});

describe('paranoid-review fixtures (each reviewed defect becomes a test)', () => {
  const pageResp = (results: unknown[], extra: Record<string, unknown> = {}) =>
    new Response(JSON.stringify({ results, ...extra }), { status: 200, headers: { 'content-type': 'application/json' } });

  it('MED: totalPages ABSENT on a FULL page marks truncated (never a silent under-pull)', async () => {
    const fetchFn = (async () =>
      pageResp(Array.from({ length: PAGE_SIZE }, (_, i) => remoteOrder(`f${i}`)), { total: 120 })) as unknown as typeof fetch;
    const got = await fetchAllRemoteOrders(deps(newDb(), fetchFn));
    expect(got.truncated).toBe(true);
    expect(got.orders.length).toBe(PAGE_SIZE);
  });
  it('totalPages ABSENT on a PARTIAL page is a complete single-page pull (no false alarm)', async () => {
    const fetchFn = (async () => pageResp([remoteOrder('only')], { total: 1 })) as unknown as typeof fetch;
    const got = await fetchAllRemoteOrders(deps(newDb(), fetchFn));
    expect(got.truncated).toBe(false);
    expect(got.orders.length).toBe(1);
  });
  it('MED: a stringified totalPages ("2") still paginates (Number coercion)', async () => {
    const calls: string[] = [];
    const fetchFn = (async (input: any) => {
      calls.push(String(input));
      const page = Number(new URL(String(input)).searchParams.get('page') ?? '0');
      return pageResp(page === 0 ? Array.from({ length: PAGE_SIZE }, (_, i) => remoteOrder(`s${i}`)) : [remoteOrder('s_last')], {
        total: PAGE_SIZE + 1,
        totalPages: '2',
      });
    }) as unknown as typeof fetch;
    const got = await fetchAllRemoteOrders(deps(newDb(), fetchFn));
    expect(calls.length).toBe(2);
    expect(got.orders.length).toBe(PAGE_SIZE + 1);
    expect(got.truncated).toBe(false);
  });
  it('MED: aggregate short of FW\'s own `total` marks truncated (the wire count is not thrown away)', async () => {
    const fetchFn = (async () => pageResp([remoteOrder('one')], { total: 120, totalPages: 1 })) as unknown as typeof fetch;
    const got = await fetchAllRemoteOrders(deps(newDb(), fetchFn));
    expect(got.truncated).toBe(true);
  });
  it('MED: 429 surfaces distinctly as fw_rate_limited', async () => {
    const fetchFn = (async () => new Response('slow down', { status: 429 })) as unknown as typeof fetch;
    await expect(fetchAllRemoteOrders(deps(newDb(), fetchFn))).rejects.toThrow('fw_rate_limited');
  });
  it('LOW: duplicate id across pages is deduped and applied counts REAL inserts only', async () => {
    const fetchFn = (async (input: any) => {
      const page = Number(new URL(String(input)).searchParams.get('page') ?? '0');
      const items =
        page === 0
          ? [...Array.from({ length: PAGE_SIZE - 1 }, (_, i) => remoteOrder(`d${i}`)), remoteOrder('dup')]
          : [remoteOrder('dup'), remoteOrder('d_tail')];
      return pageResp(items, { total: PAGE_SIZE + 1, totalPages: 2 });
    }) as unknown as typeof fetch;
    const db = newDb();
    const report = await runReconcile(deps(db, fetchFn), { apply: true });
    expect(report.ok).toBe(true);
    expect(report.remoteCount).toBe(PAGE_SIZE + 1); // dup collapsed
    expect(report.applied).toBe(PAGE_SIZE + 1);     // equals rows that actually exist
    expect(count(db)).toBe(PAGE_SIZE + 1);
    expect(report.missingLocalCount).toBe(PAGE_SIZE + 1);
  });
  it('LOW: a truncated pull suppresses missingRemote (a prefix is not full truth)', async () => {
    const fetchFn = (async (input: any) => {
      const page = Number(new URL(String(input)).searchParams.get('page') ?? '0');
      return pageResp([remoteOrder(`t${page}`)], { total: 999999, totalPages: 999999 });
    }) as unknown as typeof fetch;
    const db = newDb();
    await seedWebhookOrder(db, 'healthy_local', '2026-07-18T10:00:00.100000+00:00');
    const report = await runReconcile(deps(db, fetchFn));
    expect(report.truncated).toBe(true);
    expect(report.missingRemote).toEqual([]); // NOT reported as phantom drift
    expect(report.missingRemoteCount).toBe(0);
  });
  it('LOW: a non-JSON 200 maps to fw_fetch_failed (no SyntaxError text leaks into the report)', async () => {
    const fetchFn = (async () =>
      new Response('<html>FW error page</html>', { status: 200, headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch;
    const report = await runReconcile(deps(newDb(), fetchFn));
    expect(report.ok).toBe(false);
    expect(report.error).toBe('fw_fetch_failed');
    expect(JSON.stringify(report)).not.toContain('FW error page');
  });
  it('LOW: a local D1 failure answers 500 (ours), not 502 (upstream)', async () => {
    const { fetchFn } = fwStub([remoteOrder('x')]);
    const brokenDb = {
      prepare() {
        throw new Error('D1 down');
      },
    } as any;
    const res = await handleReconcileRequest(
      new Request('https://x/api/orders/reconcile', { method: 'POST', headers: { 'x-reconcile-token': TOKEN }, body: '{}' }),
      { db: brokenDb, fwBasic: BASIC, fetchFn, apiBase: 'https://fw.test', token: TOKEN },
    );
    expect(res.status).toBe(500);
    expect(((await res.json()) as any).error).toBe('storage_failed');
  });
  it('LOW: an oversized body is 413, sibling posture with the webhook route', async () => {
    const db = newDb();
    const { fetchFn } = fwStub([]);
    const res = await handleReconcileRequest(
      new Request('https://x/api/orders/reconcile', {
        method: 'POST',
        headers: { 'x-reconcile-token': TOKEN },
        body: '{"pad":"' + 'x'.repeat(5000) + '"}',
      }),
      { ...deps(db, fetchFn), token: TOKEN },
    );
    expect(res.status).toBe(413);
  });
});

describe('pagination backstop', () => {
  it('stops at MAX_PAGES and reports truncated instead of silently capping', async () => {
    // A stub that claims an absurd totalPages so the loop would run away without the cap.
    const fetchFn = (async (input: any) => {
      const page = Number(new URL(String(input)).searchParams.get('page') ?? '0');
      return new Response(
        JSON.stringify({ results: [remoteOrder(`inf_${page}`)], total: 999999, page, size: PAGE_SIZE, totalPages: 999999 }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as unknown as typeof fetch;
    const db = newDb();
    const got = await fetchAllRemoteOrders(deps(db, fetchFn));
    expect(got.truncated).toBe(true);
    expect(got.orders.length).toBe(MAX_PAGES);
  });
});
