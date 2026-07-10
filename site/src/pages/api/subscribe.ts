// After Hours notify-me capture -> own-the-data (Cloudflare D1). No external service.
// Safe Backend Doctrine: a verified human (Turnstile) checked at a server boundary, a
// honeypot, and a parameterized D1 write (never string-concat untrusted input).
// Astro v6 + @astrojs/cloudflare 13.x: bindings come from `cloudflare:workers`
// (`Astro.locals.runtime.env` was removed in Astro v6 — verified in the adapter source).
export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// S8: `source` is attacker-controlled input that the emailing agent later segments by.
// Allowlist server-side; a missing source means a legacy After Hours bundle (deployed
// before source existed) -> default 'after-hours'; anything else is rejected pre-write.
const SOURCES = new Set(['after-hours', 'drops']);
const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const bindings = env as unknown as { DB?: any; TURNSTILE_SECRET_KEY?: string };

  let email = '', honeypot = '', token = '', source = '';
  const ct = request.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) {
      const b = (await request.json()) as Record<string, unknown>;
      email = String(b.email ?? '').trim();
      honeypot = String(b.gf_hp ?? '').trim();               // honeypot (non-semantic name; browser autofill ignores it)
      token = String(b['cf-turnstile-response'] ?? '').trim();
      source = String(b.source ?? '').trim();
    } else {
      const f = await request.formData();
      email = String(f.get('email') ?? '').trim();
      honeypot = String(f.get('gf_hp') ?? '').trim();
      token = String(f.get('cf-turnstile-response') ?? '').trim();
      source = String(f.get('source') ?? '').trim();
    }
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  // Honeypot tripped (a bot filled the hidden field) -> look successful, store nothing.
  if (honeypot) return json({ ok: true }, 200);

  if (!source) source = 'after-hours';
  if (!SOURCES.has(source)) return json({ ok: false, error: 'invalid_source' }, 400);

  if (!EMAIL_RE.test(email) || email.length > 254) return json({ ok: false, error: 'invalid_email' }, 400);

  // Server-side Turnstile verification. Fails CLOSED if the secret is missing/invalid.
  const ip = request.headers.get('CF-Connecting-IP') || clientAddress || '';
  const body = new URLSearchParams({ secret: bindings.TURNSTILE_SECRET_KEY ?? '', response: token });
  if (ip) body.set('remoteip', ip);
  const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const outcome = (await verify.json()) as { success?: boolean };
  if (!outcome.success) return json({ ok: false, error: 'turnstile_failed' }, 403);

  // Own the data: parameterized insert (idempotent on repeat signups).
  if (!bindings.DB) return json({ ok: false, error: 'server_misconfigured' }, 500);
  try {
    await bindings.DB
      .prepare('INSERT INTO subscribers (email, source) VALUES (?1, ?2) ON CONFLICT(email) DO NOTHING')
      .bind(email.toLowerCase(), source)
      .run();
  } catch {
    return json({ ok: false, error: 'db_error' }, 500);
  }
  return json({ ok: true }, 200);
};
