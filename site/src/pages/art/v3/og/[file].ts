// S6: the GATED vault gallery (og*.jpg), served THROUGH the Worker (S4 flag: these
// images are the /vault page's payload, and a public static URL for them undercuts
// the vault gate - doctrine: serve gated content through the function, never as
// directly-addressable static files).
//
// WHY THE BYTES ARE BUNDLED, NOT ASSET-STORE FILES (adversarial walk-around find,
// observed 2026-07-10 on the built worker): the installed @astrojs/cloudflare handler
// (dist/utils/handler.js) serves any manifest-matched static asset BEFORE route
// matching - `matchStaticAsset()` runs first, so a public/ file at this same path is
// returned by the asset layer and this gate NEVER RUNS, run_worker_first or not
// (curl proof: direct og1.jpg fetch returned 200 with the asset layer's
// `public, max-age=0` cache header, no cookie). The only way the gate is the ONLY
// door is for the files not to exist as public assets at all: they live in
// src/vault-art/ and are inlined into this route's lazy server chunk (~616K source,
// loaded on first gallery hit). dist-lint asserts dist/client/art/v3/og/ stays gone.
export const prerender = false;

import type { APIRoute } from 'astro';
import { GATE_COOKIE, gateOpen } from '../../../../lib/gate';

import og1 from '../../../../vault-art/og1.jpg?inline';
import og2 from '../../../../vault-art/og2.jpg?inline';
import og3 from '../../../../vault-art/og3.jpg?inline';
import og4 from '../../../../vault-art/og4.jpg?inline';
import og5 from '../../../../vault-art/og5.jpg?inline';
import og6 from '../../../../vault-art/og6.jpg?inline';
import og7 from '../../../../vault-art/og7.jpg?inline';
import og8 from '../../../../vault-art/og8.jpg?inline';
import og9 from '../../../../vault-art/og9.jpg?inline';
import og10 from '../../../../vault-art/og10.jpg?inline';
import og11 from '../../../../vault-art/og11.jpg?inline';

const GALLERY: Record<string, string> = {
  'og1.jpg': og1, 'og2.jpg': og2, 'og3.jpg': og3, 'og4.jpg': og4, 'og5.jpg': og5,
  'og6.jpg': og6, 'og7.jpg': og7, 'og8.jpg': og8, 'og9.jpg': og9, 'og10.jpg': og10,
  'og11.jpg': og11,
};

// Decode each data URL once per isolate, on demand.
const decoded = new Map<string, Uint8Array>();
const bytesFor = (name: string): Uint8Array | null => {
  const hit = decoded.get(name);
  if (hit) return hit;
  const dataUrl = GALLERY[name];
  if (!dataUrl) return null;
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  decoded.set(name, out);
  return out;
};

export const GET: APIRoute = async ({ params, cookies, redirect }) => {
  if (!(await gateOpen(cookies.get(GATE_COOKIE)?.value))) return redirect('/', 302);

  const file = params.file ?? '';
  if (!Object.prototype.hasOwnProperty.call(GALLERY, file)) return new Response('Not found', { status: 404 });

  const body = bytesFor(file);
  if (!body) return new Response('Not found', { status: 404 }); // fail closed

  return new Response(body as unknown as BodyInit, {
    status: 200,
    headers: {
      'content-type': 'image/jpeg',
      // Gated bytes: private caching only (a shared cache would serve them cookieless).
      'cache-control': 'private, max-age=3600',
    },
  });
};
