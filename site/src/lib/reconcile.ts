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
export const MAX_RECONCILE_BODY_BYTES = 4_096; // the whole legal body is ~40 chars; 4KB is generous

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
  /** FW has these, local D1 does not: the dropped-delivery class. Capped at REPORT_CAP entries. */
  missingLocal?: { fwId: string; friendlyId: string | null }[];
  /** Local D1 has these, FW does not: phantom rows, investigate by hand. Capped at REPORT_CAP entries. */
  missingRemote?: { fwId: string; friendlyId: string | null }[];
  /** EXACT drift counts, never capped (the id lists above slice at REPORT_CAP). */
  missingLocalCount?: number;
  missingRemoteCount?: number;
  /** True when the pull is not provably complete (MAX_PAGES hit, unreadable totalPages on a
   * full page, or the aggregate came up short of FW's own `total`): counts are then a floor. */
  truncated?: boolean;
  applied?: number; // rows actually inserted by backfill per D1 meta.changes (0 in report-only mode)
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

export const FETCH_TIMEOUT_MS = 10_000; // per page; a hung FW connection must not hold the request open

/**
 * Pull every order from FW's List Orders, paginating page 0..totalPages-1 (bounded by
 * MAX_PAGES). Throws on any non-200 (a 401/403 means the key is wrong or revoked; the
 * caller fails closed rather than reporting an empty shop as "no drift"; a 429 surfaces
 * distinctly as fw_rate_limited). Completeness is VERIFIED, not assumed (paranoid-review
 * MED): totalPages is coerced through Number(), an unverifiable totalPages on a full page
 * marks the pull truncated instead of silently stopping, and the aggregate is cross-checked
 * against the response's own `total` after the loop, so a contract drift can never read as
 * a clean, complete report.
 */
export async function fetchAllRemoteOrders(deps: ReconcileDeps, sinceIso?: string): Promise<{ orders: RemoteOrder[]; truncated: boolean }> {
  const fetchFn = deps.fetchFn ?? fetch;
  const base = deps.apiBase ?? FW_API_BASE;
  const auth = 'Basic ' + btoa(deps.fwBasic as string);
  const orders: RemoteOrder[] = [];
  const seen = new Set<string>(); // pagination shift while orders arrive can repeat an id across pages
  let truncated = false;
  let reportedTotal: number | null = null;

  for (let page = 0; ; page++) {
    if (page >= MAX_PAGES) {
      truncated = true;
      break;
    }
    const qs = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
    if (sinceIso) qs.set('createdAt[gt]', sinceIso);
    const res = await fetchFn(`${base}${LIST_ORDERS_PATH}?${qs}`, {
      headers: { authorization: auth, accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status === 429) throw new Error('fw_rate_limited');
    if (res.status !== 200) throw new Error(`fw_list_orders_${res.status}`);
    const body = (await res.json()) as { results?: unknown[]; total?: unknown; totalPages?: unknown };
    const pageItems = Array.isArray(body.results) ? body.results : [];
    for (const item of pageItems) {
      const o = extractRemoteOrder(item);
      if (o && !seen.has(o.id)) {
        seen.add(o.id);
        orders.push(o);
      }
    }
    const totalNum = Number(body.total);
    if (Number.isFinite(totalNum) && totalNum >= 0) reportedTotal = totalNum;

    const totalPages = Number(body.totalPages); // coerce: a stringified "2" must still paginate
    if (!Number.isFinite(totalPages) || totalPages < 1) {
      // Unverifiable pagination. A partial page proves we reached the end; a FULL page with
      // no readable totalPages means there may be more we cannot see: flag it, never
      // silently stop (the lane's whole purpose is completeness).
      if (pageItems.length >= PAGE_SIZE) truncated = true;
      break;
    }
    if (page + 1 >= totalPages) break;
  }
  // Cross-check against FW's own count (received on the wire; throwing it away was the
  // reviewed defect). Fewer aggregated than reported = an under-pull we cannot explain.
  if (!truncated && reportedTotal !== null && orders.length < reportedTotal) truncated = true;
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
    // Allowlist error strings: only our own named fw_* codes reach the report. A raw
    // message (e.g. a JSON SyntaxError quoting an FW error page) never leaks outward.
    const msg = e instanceof Error && /^fw_[a-z0-9_]+$/.test(e.message) ? e.message : 'fw_fetch_failed';
    return { ok: false, error: msg };
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
  // A bounded `sinceIso` pull sees only a remote WINDOW, and a truncated pull sees only a
  // remote PREFIX; local rows absent from either are absent for the innocent reason that
  // the pull did not cover them. missing_remote is only meaningful on a provably-complete
  // full pull, so partial pulls report it empty rather than as false phantom drift.
  const missingRemote = opts.sinceIso || remote.truncated
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
        const result = (await deps.db
          .prepare(
            `INSERT INTO orders (fw_id, friendly_id, email, line_items, shipping_status, raw_event, event_ts, status_event_ts)
             VALUES (?1, ?2, ?3, ?4, 'unknown', ?5, 0, 0)
             ON CONFLICT(fw_id) DO NOTHING`,
          )
          .bind(o.id, o.friendlyId, o.email, o.offers ? JSON.stringify(o.offers) : '[]', marker)
          .run()) as { meta?: { changes?: number } } | undefined;
        // Count what D1 reports it INSERTED, not the attempt: a DO NOTHING no-op (webhook
        // raced us between the SELECT and this INSERT) must not inflate `applied`.
        applied += Number(result?.meta?.changes ?? 0) > 0 ? 1 : 0;
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
    missingLocalCount: missingLocal.length,
    missingRemoteCount: missingRemote.length,
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

  // Body cap, sibling-posture with the webhook route. Trusted-caller-only exposure (the
  // read sits behind the token check), so a post-buffer length check is proportionate here;
  // the Content-Length fast-reject still refuses an honestly-declared oversized body unread.
  const clRaw = request.headers.get('content-length');
  const cl = clRaw == null ? NaN : Number(clRaw);
  if (Number.isFinite(cl) && cl > MAX_RECONCILE_BODY_BYTES) {
    return json({ ok: false, error: 'payload_too_large' }, 413);
  }

  let apply = false;
  let sinceIso: string | undefined;
  try {
    const text = await request.text();
    if (text.length > MAX_RECONCILE_BODY_BYTES) return json({ ok: false, error: 'payload_too_large' }, 413);
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
  // Status honesty: local failures are OURS (500), upstream FW failures are a bad gateway
  // (502). Mislabeling a D1 error as upstream sends the operator hunting the wrong system.
  const status = report.ok ? 200 : report.error === 'storage_failed' || report.error === 'server_misconfigured' ? 500 : 502;
  return json(report, status);
}
