// Sprint 4 step 5: the backfill + reconcile lane. Fourthwall is the source of truth for
// orders; the webhook mirror in D1 can silently miss deliveries (FW retries ~5x over
// seconds, success = 200 only), and until this lane existed a dropped delivery was
// undetectable. This module diffs FW's Platform API List Orders against the local
// `orders` table, reports drift in BOTH directions, and (only when explicitly asked)
// backfills rows that exist at FW but not locally.
//
// PURE module by design (no `cloudflare:workers` import): the endpoint injects deps so
// vitest drives the full pipeline against the node:sqlite D1 shim and a stubbed fetch.
//
// Contract (VERIFIED 2026-07-23 against docs.fourthwall.com/api-reference/platform/orders/
// list-orders.md): GET https://api.fourthwall.com/open-api/v1.0/order, Basic auth with
// shop-level API keys ("API keys have full access to this endpoint"), query `page`
// (default 0) + `size` (default 20) + optional `createdAt[gt]` ISO filter; response
// { results: Order[], total, page, size, totalPages }; per-order `id`, `friendlyId`,
// `email`, `status` (order LIFECYCLE enum, e.g. CONFIRMED/SHIPPED/CANCELLED), `createdAt`,
// `offers`. Rate limit 100 req / 10 s per shop. The exact Basic username:password split of
// a shop key is `not verified` here; FW_API_BASIC carries the full "user:pass" string and
// the cutover runbook re-verifies it against one live call.
//
// Safety posture:
//   - Report-only by default. `apply` must be explicitly true for any write.
//   - Backfill is strictly ADDITIVE: INSERT ... ON CONFLICT DO NOTHING. It can only create
//     rows the webhook missed; it can never update, heal, or regress an existing row. The
//     webhook stays the ONLY writer that mutates.
//   - Backfilled rows carry event_ts = 0 and shipping_status 'unknown': per the monotonic
//     gate's own semantics a 0-ts row can exist but never blocks a later real event, so the
//     next genuine ORDER_UPDATED advances it normally. FW's lifecycle `status` is NEVER
//     mapped into shipping_status (the F5 rule; lifecycle != fulfillment).
//   - missing_remote rows (local has, FW lacks) are REPORTED, never deleted. A phantom row
//     is an investigation, not an auto-delete.
//   - No silent caps: pagination is bounded by MAX_PAGES and the report says so when hit.

const enc = new TextEncoder();

export const FW_API_BASE = 'https://api.fourthwall.com';
export const LIST_ORDERS_PATH = '/open-api/v1.0/order';
export const PAGE_SIZE = 50;
export const MAX_PAGES = 40; // 2,000 orders; far above this shop's scale, a runaway backstop

export interface RemoteOrder {
  id: string;
  friendlyId: string | null;
  email: string | null;
  status: string | null;    // FW order-LIFECYCLE status, report-only, never written to shipping_status
  createdAt: string | null;
  offers: unknown[] | null;
}

export interface FetchPage {
  results: RemoteOrder[];
  totalPages: number;
}

export interface ReconcileDeps {
  db?: {
    prepare(sql: string): {
      bind(...values: unknown[]): {
        run(): Promise<unknown>;
        all?(): Promise<{ results?: Record<string, unknown>[] }>;
      };
      all?(): Promise<{ results?: Record<string, unknown>[] }>;
    };
  };
  /** "user:pass" for FW Basic auth (Worker secret FW_API_BASIC). Absent = fail closed. */
  fwBasic?: string;
  /** Injectable fetch for tests; defaults to global fetch. */
  fetchFn?: typeof fetch;
  /** Override the API base for tests. */
  apiBase?: string;
}

export interface ReconcileReport {
  ok: boolean;
  error?: string;
  remoteCount?: number;
  localCount?: number;
  /** FW has these, local D1 does not: the dropped-delivery class. */
  missingLocal?: { fwId: string; friendlyId: string | null }[];
  /** Local D1 has these, FW does not: phantom rows, investigate by hand. */
  missingRemote?: { fwId: string; friendlyId: string | null }[];
  /** True when pagination stopped at MAX_PAGES before totalPages: counts are then a floor. */
  truncated?: boolean;
  applied?: number; // rows inserted by backfill (0 in report-only mode)
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Defensive per-order walk of a List Orders result item. No id = the item is skipped. */
export function extractRemoteOrder(item: unknown): RemoteOrder | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const id = str(o.id);
  if (!id || id.length > 128) return null;
  return {
    id,
    friendlyId: str(o.friendlyId) ?? str(o.friendly_id),
    email: str(o.email),
    status: str(o.status),
    createdAt: str(o.createdAt) ?? str(o.created_at),
    offers: Array.isArray(o.offers) ? o.offers : null,
  };
}

/**
 * Pull every order from FW's List Orders, paginating page 0..totalPages-1 (bounded by
 * MAX_PAGES). Throws on any non-200 (a 401/403 means the key is wrong or revoked; the
 * caller fails closed rather than reporting an empty shop as "no drift").
 */
export async function fetchAllRemoteOrders(deps: ReconcileDeps, sinceIso?: string): Promise<{ orders: RemoteOrder[]; truncated: boolean }> {
  const fetchFn = deps.fetchFn ?? fetch;
  const base = deps.apiBase ?? FW_API_BASE;
  const auth = 'Basic ' + btoa(deps.fwBasic as string);
  const orders: RemoteOrder[] = [];
  let truncated = false;

  for (let page = 0; ; page++) {
    if (page >= MAX_PAGES) {
      truncated = true;
      break;
    }
    const qs = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
    if (sinceIso) qs.set('createdAt[gt]', sinceIso);
    const res = await fetchFn(`${base}${LIST_ORDERS_PATH}?${qs}`, {
      headers: { authorization: auth, accept: 'application/json' },
    });
    if (res.status !== 200) throw new Error(`fw_list_orders_${res.status}`);
    const body = (await res.json()) as { results?: unknown[]; totalPages?: number };
    for (const item of body.results ?? []) {
      const o = extractRemoteOrder(item);
      if (o) orders.push(o);
    }
    const totalPages = typeof body.totalPages === 'number' ? body.totalPages : 0;
    if (page + 1 >= totalPages) break;
  }
  return { orders, truncated };
}

const REPORT_CAP = 200; // ids listed per direction; counts stay exact either way

/**
 * The reconcile pipeline: fetch remote, read local fw_ids, diff both directions,
 * optionally backfill (strictly additive). Every failure path returns ok:false with a
 * named error and performs no write.
 */
export async function runReconcile(deps: ReconcileDeps, opts: { apply?: boolean; sinceIso?: string } = {}): Promise<ReconcileReport> {
  if (!deps.db) return { ok: false, error: 'server_misconfigured' };
  if (!deps.fwBasic) return { ok: false, error: 'server_misconfigured' };

  let remote: { orders: RemoteOrder[]; truncated: boolean };
  try {
    remote = await fetchAllRemoteOrders(deps, opts.sinceIso);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'fw_fetch_failed' };
  }

  let localRows: Record<string, unknown>[];
  try {
    const stmt = deps.db.prepare('SELECT fw_id, friendly_id FROM orders');
    const res = stmt.all ? await stmt.all() : await stmt.bind().all!();
    localRows = res.results ?? [];
  } catch {
    return { ok: false, error: 'storage_failed' };
  }

  const remoteById = new Map(remote.orders.map((o) => [o.id, o]));
  const localById = new Map(localRows.map((r) => [String(r.fw_id), r]));

  const missingLocal = remote.orders
    .filter((o) => !localById.has(o.id))
    .map((o) => ({ fwId: o.id, friendlyId: o.friendlyId }));
  // A bounded `sinceIso` pull sees only a remote WINDOW; older local rows are absent from it
  // for the innocent reason that they predate the filter. missing_remote is only meaningful
  // on a FULL pull, so a windowed run reports it empty rather than as false drift.
  const missingRemote = opts.sinceIso
    ? []
    : localRows
        .filter((r) => !remoteById.has(String(r.fw_id)))
        .map((r) => ({ fwId: String(r.fw_id), friendlyId: (r.friendly_id as string | null) ?? null }));

  let applied = 0;
  if (opts.apply && missingLocal.length > 0) {
    for (const m of missingLocal) {
      const o = remoteById.get(m.fwId)!;
      // Strictly additive: DO NOTHING on conflict. event_ts 0 = "exists, never blocks a
      // later real event". shipping_status stays 'unknown' (F5: lifecycle is not fulfillment).
      // raw_event marks provenance so a backfilled row is distinguishable from a delivered one.
      const marker = JSON.stringify({ type: 'RECONCILE_BACKFILL', backfilledAt: new Date().toISOString(), data: o });
      try {
        await deps.db
          .prepare(
            `INSERT INTO orders (fw_id, friendly_id, email, line_items, shipping_status, raw_event, event_ts, status_event_ts)
             VALUES (?1, ?2, ?3, ?4, 'unknown', ?5, 0, 0)
             ON CONFLICT(fw_id) DO NOTHING`,
          )
          .bind(o.id, o.friendlyId, o.email, o.offers ? JSON.stringify(o.offers) : '[]', marker)
          .run();
        applied++;
      } catch {
        return {
          ok: false,
          error: 'storage_failed',
          remoteCount: remote.orders.length,
          localCount: localRows.length,
          applied,
        };
      }
    }
  }

  return {
    ok: true,
    remoteCount: remote.orders.length,
    localCount: localRows.length,
    missingLocal: missingLocal.slice(0, REPORT_CAP),
    missingRemote: missingRemote.slice(0, REPORT_CAP),
    truncated: remote.truncated,
    applied,
  };
}

/**
 * Constant-time-equivalent token check via the double-HMAC trick: HMAC both values under a
 * per-call random key and compare digests. A byte-wise compare of two HMAC digests leaks
 * nothing about the underlying strings, so an attacker cannot walk the token char by char.
 */
export async function tokensEqual(a: string, b: string): Promise<boolean> {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const [da, db2] = await Promise.all([
    crypto.subtle.sign('HMAC', key, enc.encode(a)),
    crypto.subtle.sign('HMAC', key, enc.encode(b)),
  ]);
  const ua = new Uint8Array(da);
  const ub = new Uint8Array(db2);
  if (ua.length !== ub.length) return false;
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0;
}

export interface ReconcileEndpointDeps extends ReconcileDeps {
  /** Worker secret RECONCILE_TOKEN. Absent = endpoint fails closed (500). */
  token?: string;
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * The endpoint pipeline (POST /api/orders/reconcile). Controls in order:
 *   1. Fail CLOSED on missing config: no DB, no FW credentials, or no RECONCILE_TOKEN = 500.
 *   2. Caller token in `x-reconcile-token`, compared via double-HMAC; missing and wrong are
 *      the same 401.
 *   3. Body is optional JSON { apply?: boolean, sinceDays?: number }. apply must be
 *      literally true; sinceDays is clamped to 1..365 integers. Anything else is ignored.
 *   4. Report-only unless apply === true; every failure inside returns ok:false, never 200-empty.
 * Cron wiring: Cloudflare Cron cannot invoke this Astro worker directly (the installed
 * @astrojs/cloudflare 13.7.0 entry exports fetch only, no scheduled handler), so the
 * scheduled path is a 5-line companion cron Worker POSTing here with the token; see
 * docs/reconcile-runbook.md.
 */
export async function handleReconcileRequest(request: Request, deps: ReconcileEndpointDeps): Promise<Response> {
  if (!deps.db || !deps.fwBasic || !deps.token) {
    return json({ ok: false, error: 'server_misconfigured' }, 500);
  }
  const presented = request.headers.get('x-reconcile-token');
  if (!presented || !(await tokensEqual(deps.token, presented))) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  let apply = false;
  let sinceIso: string | undefined;
  try {
    const text = await request.text();
    if (text) {
      const body = JSON.parse(text) as Record<string, unknown>;
      apply = body.apply === true;
      const days = body.sinceDays;
      if (typeof days === 'number' && Number.isInteger(days) && days >= 1 && days <= 365) {
        sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();
      }
    }
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  const report = await runReconcile(deps, { apply, sinceIso });
  return json(report, report.ok ? 200 : 502);
}
