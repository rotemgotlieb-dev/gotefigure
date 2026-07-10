// S6: the GATED vault gallery (og*.jpg), served THROUGH the Worker (S4 flag: these
// images are the /vault page's payload, and a public static URL for them undercuts
// the vault gate - doctrine: serve gated content through the function, never as
// directly-addressable static files).
//
// Design: the files stay in the asset STORE (dist/client) so this route can stream
// them via the ASSETS binding without bloating the Worker bundle, but
// assets.run_worker_first ("/art/v3/og/*") makes EVERY request run this code first:
// no cookie -> 302 to /, valid signed cookie -> bytes. dist-lint asserts post-build
// that the built config still carries both the route pattern and the ASSETS binding,
// so a config regression cannot silently re-publish the gallery.
export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GATE_COOKIE, gateOpen } from '../../../../lib/gate';

const FILE_RE = /^og\d{1,2}\.jpg$/; // exact catalog shape; anything else is a 404, never a path echo

export const GET: APIRoute = async ({ params, request, cookies, redirect }) => {
  if (!(await gateOpen(cookies.get(GATE_COOKIE)?.value))) return redirect('/', 302);

  const file = params.file ?? '';
  if (!FILE_RE.test(file)) return new Response('Not found', { status: 404 });

  const assets = (env as unknown as { ASSETS?: { fetch: (r: Request) => Promise<Response> } }).ASSETS;
  if (!assets) return new Response('Not found', { status: 404 }); // fail closed, never a secret-path hint

  // The binding reads the asset store directly (no run_worker_first recursion).
  const res = await assets.fetch(new Request(new URL(`/art/v3/og/${file}`, request.url), { method: 'GET' }));
  if (!res.ok) return new Response('Not found', { status: 404 });

  // Gated bytes: private caching only (a shared cache would serve them cookieless).
  const headers = new Headers(res.headers);
  headers.set('cache-control', 'private, max-age=3600');
  return new Response(res.body, { status: res.status, headers });
};
