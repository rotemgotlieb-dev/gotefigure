#!/usr/bin/env node
// dist-lint - the S4 artifact tripwire (adversarial review findings 1+6, 2026-07-10).
// Runs AFTER `astro build`, wired into build / verify / deploy. Enforcement at the
// ARTIFACT, not the source: whatever the components claim, no sellable-catalog fact may
// appear in the public client output, because everything in dist/client/ is publicly
// fetchable - and with not_found_handling: "404-page", 404.html is served at EVERY
// unknown URL. Zero dependencies.
//
// Fails (exit 1) on:
//   1. any sellable-catalog literal (piece name from content/pieces.json, or slug/name
//      from lib/commerce/catalog.mock.ts) inside any dist/client/ HTML or JS file
//   2. a serialized price payload ("price": - raw or its HTML-escaped &quot; form) in
//      the same files
//   3. literal-extraction underflow (< MIN_LITERALS collected) - a broken extraction
//      regex must fail loudly, never silently scan for nothing
//   4. dist/client missing (the tripwire must run against a fresh build)
//
// Deliberately NOT enforced: vault-archive names (vault.json). "OG Rabbit" appears as
// brand-character prose on the public about/404 pages per the standing art-protection
// decision (soft deterrents now, hard gate later). The gated pages (store, piece/*,
// vault) are prerender=false, never land in dist/client/, and get their catalog payload
// at request time - they are out of scope here by construction.

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = dirname(fileURLToPath(import.meta.url)) + '/..'; // site/
const CLIENT = join(SITE, 'dist/client');
const MIN_LITERALS = 10;

const failures = [];
const pass = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg) => { failures.push(msg); console.error(`  FAIL  ${msg}`); };

if (!existsSync(CLIENT)) {
  console.error('dist-lint: dist/client not found - run `astro build` first (this tripwire checks the built artifact).');
  process.exit(1);
}

// ---------- second net for the secrets-in-dist deploy footgun (S4 finding 5) ----------------
// wrangler serves assets.directory verbatim minus the .assetsignore at THAT directory's
// root. wrangler.jsonc now points at ./dist/client (and the adapter emits
// dist/client/.assetsignore), but if any config ever points assets at ./dist again, a bare
// `wrangler deploy` would publish dist/server/** including .dev.vars. Emitting a dist-root
// .assetsignore makes even that misconfiguration unable to publish server output or secrets.
writeFileSync(join(SITE, 'dist/.assetsignore'), 'server/**\n.dev.vars\nwrangler.json\n');
pass('[net] dist/.assetsignore emitted (server/**, .dev.vars, wrangler.json)');

// ---------- gather the same catalog literals catalog-lint enforces --------------------------
const piecesJson = JSON.parse(readFileSync(join(SITE, 'src/content/pieces.json'), 'utf8'));
const pieceNames = piecesJson.pieces.map((p) => p.name);
const mockTs = readFileSync(join(SITE, 'src/lib/commerce/catalog.mock.ts'), 'utf8');
const mockSlugs = [...mockTs.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]);
const mockNames = [...mockTs.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]);
const literals = [...new Set([...pieceNames, ...mockSlugs, ...mockNames])].filter((l) => l.length >= 5);

if (literals.length < MIN_LITERALS) {
  fail(`[extract] only ${literals.length} catalog literals collected (< ${MIN_LITERALS}) - the extraction regex is broken; a tripwire scanning for nothing passes everything`);
} else pass(`[extract] ${literals.length} catalog literals collected (>= ${MIN_LITERALS})`);

// ---------- scan every public HTML + JS artifact ---------------------------------------------
const PRICE_PATTERNS = [/"price"\s*:/, /&quot;price&quot;\s*:/];
const lowered = literals.map((l) => l.toLowerCase());

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(html|js|mjs)$/.test(name)) yield p;
  }
}

{
  const hits = [];
  let scanned = 0;
  for (const file of walk(CLIENT)) {
    scanned++;
    const rel = relative(SITE, file);
    const txt = readFileSync(file, 'utf8');
    const low = txt.toLowerCase();
    lowered.forEach((lit, i) => { if (low.includes(lit)) hits.push(`${rel} contains catalog literal "${literals[i]}"`); });
    for (const re of PRICE_PATTERNS) if (re.test(txt)) hits.push(`${rel} contains a serialized price payload (${re})`);
  }
  if (hits.length) hits.forEach((h) => fail(`[artifact-leak] ${h}`));
  else pass(`[artifact-leak] ${scanned} public artifacts (HTML+JS) carry zero catalog literals and zero price payloads`);
}

// ---------- S6: gated-route coverage in the BUILT worker config ------------------------------
// The vault gallery + admin view + every gated page depend on assets.run_worker_first in the
// ADAPTER-GENERATED config (dist/server/wrangler.json, what `wrangler deploy` actually reads
// via the .wrangler/deploy redirect). If a config regression drops a pattern, real-browser
// navigations silently bypass the Worker (the R2-S4 curl-green/browser-404 class bug) and the
// og*.jpg files in the asset store become public again. Pin it at the artifact.
{
  const REQUIRED_RWF = ['/store', '/piece/*', '/vault', '/api/*', '/admin/*', '/_image', '/art/v3/og/*'];
  const builtCfgPath = join(SITE, 'dist/server/wrangler.json');
  if (!existsSync(builtCfgPath)) {
    fail('[gated-routes] dist/server/wrangler.json missing - the adapter did not emit a worker config');
  } else {
    const cfg = JSON.parse(readFileSync(builtCfgPath, 'utf8'));
    const rwf = cfg?.assets?.run_worker_first;
    const missing = Array.isArray(rwf) ? REQUIRED_RWF.filter((p) => !rwf.includes(p)) : REQUIRED_RWF;
    if (missing.length) fail(`[gated-routes] built config run_worker_first is missing: ${missing.join(', ')}`);
    else pass(`[gated-routes] built config routes all ${REQUIRED_RWF.length} gated/worker patterns worker-first`);
    if (cfg?.assets?.binding !== 'ASSETS') {
      fail('[gated-routes] built config has no ASSETS binding - adapter asset serving would break');
    } else pass('[gated-routes] ASSETS binding present');
  }

  // The vault gallery must NEVER ship as public assets again. The installed adapter
  // serves manifest-matched assets BEFORE routes (matchStaticAsset in handler.js), so a
  // public/ file at the gated path silently bypasses the gate for everyone (observed on
  // the built worker 2026-07-10: 200 + the asset layer's cache header, no cookie). The
  // bytes are inlined into the gated route's server chunk instead.
  if (existsSync(join(CLIENT, 'art/v3/og'))) {
    fail('[gated-routes] dist/client/art/v3/og exists - the vault gallery shipped as PUBLIC assets; the adapter serves these before the gate route ever runs');
  } else pass('[gated-routes] vault gallery absent from public assets (served only through the gated route)');
}

// ---------- verdict ---------------------------------------------------------------------------
if (failures.length) {
  console.error(`\ndist-lint: ${failures.length} failure(s). The BUILT public artifact leaks catalog data - fix the source that rendered it (docs/INVENTORY-RUNBOOK.md).`);
  process.exit(1);
}
console.log('\ndist-lint: PASS');
