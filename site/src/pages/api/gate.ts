// Store gate login — the rate-limited server boundary that replaces the old
// client-side code compare (the code used to ship in the JS bundle; now the only
// thing the client ever sees is ok/false). Design per Safe Backend Doctrine:
//   - D1-backed sliding-window rate limit (5 failures / 10 min / IP), durable
//     across isolates (an in-memory Map resets on every cold start).
//   - Double-HMAC constant-time comparison of the submitted code (digests are
//     compared, never the secrets).
//   - Success sets the signed HttpOnly cookie from lib/gate.ts (exp + nonce + MAC).
// Secrets (Worker secrets, never in the bundle): GATE_CODE, GATE_SIGNING_KEY.
export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GATE_COOKIE, GATE_TTL_SECONDS, hmacHex, importGateKey, signGateToken } from '../../lib/gate';

const WINDOW_SECONDS = 600;
const MAX_FAILURES = 5;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async ({ request, clientAddress, cookies }) => {
  const bindings = env as unknown as { DB?: any; GATE_CODE?: string; GATE_SIGNING_KEY?: string };
  if (!bindings.DB || !bindings.GATE_CODE || !bindings.GATE_SIGNING_KEY) {
    return json({ ok: false, error: 'server_misconfigured' }, 500);
  }

  let code = '';
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const b = (await request.json()) as Record<string, unknown>;
      code = String(b.code ?? '');
    } else {
      const f = await request.formData();
      code = String(f.get('code') ?? '');
    }
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }
  if (!code || code.length > 128) return json({ ok: false, error: 'bad_request' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || clientAddress || 'unknown';
  const now = Math.floor(Date.now() / 1000);

  // Sliding-window failure count (and opportunistic cleanup of stale rows).
  try {
    await bindings.DB.prepare('DELETE FROM gate_attempts WHERE ts < ?1').bind(now - 3600).run();
    const row = await bindings.DB
      .prepare('SELECT COUNT(*) AS n FROM gate_attempts WHERE ip = ?1 AND ts > ?2')
      .bind(ip, now - WINDOW_SECONDS)
      .first();
    if ((row?.n ?? 0) >= MAX_FAILURES) return json({ ok: false, error: 'rate_limited' }, 429);
  } catch {
    return json({ ok: false, error: 'server_misconfigured' }, 500); // fail closed, never open
  }

  // Constant-time compare via double-HMAC under the signing key.
  const key = await importGateKey(bindings.GATE_SIGNING_KEY);
  const match = (await hmacHex(key, code)) === (await hmacHex(key, bindings.GATE_CODE));

  if (!match) {
    try {
      await bindings.DB.prepare('INSERT INTO gate_attempts (ip, ts) VALUES (?1, ?2)').bind(ip, now).run();
    } catch { /* the limit check above already fails closed */ }
    return json({ ok: false, error: 'wrong_code' }, 403);
  }

  cookies.set(GATE_COOKIE, await signGateToken(key), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: GATE_TTL_SECONDS, // advisory; the REAL expiry is the signed `exp` the server checks
  });
  return json({ ok: true }, 200);
};
