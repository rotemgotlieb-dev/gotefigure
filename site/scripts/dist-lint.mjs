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

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
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

// ---------- verdict ---------------------------------------------------------------------------
if (failures.length) {
  console.error(`\ndist-lint: ${failures.length} failure(s). The BUILT public artifact leaks catalog data - fix the source that rendered it (docs/INVENTORY-RUNBOOK.md).`);
  process.exit(1);
}
console.log('\ndist-lint: PASS');
