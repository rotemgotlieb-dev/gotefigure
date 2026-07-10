#!/usr/bin/env node
// catalog-lint - the S4 catalog-reality gate (docs/INVENTORY-RUNBOOK.md).
// Wired ahead of `npm run build` / `verify` / `deploy`. Zero dependencies. Fails (exit 1) on:
//
//   A. DEDUP (now enforced): a sellable-product literal (piece name from content/pieces.json,
//      or slug/name from lib/commerce/catalog.mock.ts) appearing in ANY src file outside the
//      catalog sources. One catalog truth per fact; retiring a piece must never leave a
//      hardcoded ghost. (Vault-archive names are deliberately NOT enforced: "OG Rabbit" as
//      brand-character prose in about/404 is a look-alike, not inventory duplication.)
//   B. An UNVERIFIED price marker on an ACTIVE (non-comment) line of a catalog source, or in
//      any rendered string value of the content JSON - an unverified price must never render.
//   C. provider=fourthwall while lib/commerce/overlay.ts still contains ANY "UNVERIFIED"
//      marker - the cutover is blocked until every price is real (Vibe quote → dashboard).
//   D. An invalid PUBLIC_COMMERCE_PROVIDER value, or provider=fourthwall without
//      PUBLIC_FW_STOREFRONT_TOKEN (mirrors the build-time throw in lib/commerce/index.ts).

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = dirname(fileURLToPath(import.meta.url)) + '/..'; // site/
const SRC = join(SITE, 'src');

const CATALOG_SOURCES = [
  'src/content/pieces.json',
  'src/content/drop.json',
  'src/content/vault.json',
  'src/content/drops.json',
  'src/lib/commerce/catalog.mock.ts',
  'src/lib/commerce/overlay.ts',
];

const failures = [];
const pass = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg) => { failures.push(msg); console.error(`  FAIL  ${msg}`); };

// ---------- env: resolve the provider the way astro/vite ACTUALLY will ---------------------
// `astro build` runs Vite in production mode, which loads (later wins):
//   .env < .env.local < .env.production < .env.production.local, then process.env on top.
// S4 review (MAJOR #3): reading only .env let a .env.local/.env.production* override flip
// the REAL build's provider while the lint judged a different one. Two closes:
//   (1) resolve from the same file set Vite does, in Vite's precedence;
//   (2) hard-fail if any override file (.env.local / .env.production*) defines a
//       PUBLIC_COMMERCE_* key at all - the provider must only ever come from the one
//       committed-adjacent layer (.env / CI env), never a local shadow file.
const VITE_ENV_FILES = ['.env', '.env.local', '.env.production', '.env.production.local'];
function parseEnvFile(p) {
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
const envFile = {};
for (const f of VITE_ENV_FILES) Object.assign(envFile, parseEnvFile(join(SITE, f)));
const PROVIDER = process.env.PUBLIC_COMMERCE_PROVIDER ?? envFile.PUBLIC_COMMERCE_PROVIDER ?? 'mock';
const FW_TOKEN = process.env.PUBLIC_FW_STOREFRONT_TOKEN ?? envFile.PUBLIC_FW_STOREFRONT_TOKEN ?? '';

// rule E part 1: no commerce key may live in an override env file
{
  const offenders = [];
  for (const f of VITE_ENV_FILES.slice(1)) {
    for (const key of Object.keys(parseEnvFile(join(SITE, f))))
      if (key.startsWith('PUBLIC_COMMERCE_')) offenders.push(`${f} defines ${key}`);
  }
  if (offenders.length) offenders.forEach((o) => fail(`[E env-shadow] ${o} - commerce keys may only live in .env or the CI env, never a local override file (they outrank .env in the real build)`));
  else pass('[E env-shadow] no PUBLIC_COMMERCE_* key in .env.local / .env.production*');
}

// ---------- gather catalog literals ---------------------------------------------------------
const piecesJson = JSON.parse(readFileSync(join(SITE, 'src/content/pieces.json'), 'utf8'));
const pieceNames = piecesJson.pieces.map((p) => p.name);

const mockTs = readFileSync(join(SITE, 'src/lib/commerce/catalog.mock.ts'), 'utf8');
const mockSlugs = [...mockTs.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]);
const mockNames = [...mockTs.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]);

// length guard: never enforce a literal so short it matches prose by accident
const literals = [...new Set([...pieceNames, ...mockSlugs, ...mockNames])].filter((l) => l.length >= 5);

// ---------- walk src -------------------------------------------------------------------------
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(astro|ts|tsx|js|mjs|json)$/.test(name)) yield p;
  }
}

// ---------- rule A: dedup --------------------------------------------------------------------
{
  const hits = [];
  for (const file of walk(SRC)) {
    const rel = relative(SITE, file);
    if (CATALOG_SOURCES.includes(rel)) continue;
    const txt = readFileSync(file, 'utf8');
    for (const lit of literals) if (txt.includes(lit)) hits.push(`${rel} contains "${lit}"`);
  }
  if (hits.length) hits.forEach((h) => fail(`[A dedup] product literal outside catalog sources: ${h}`));
  else pass(`[A dedup] ${literals.length} product literals appear ONLY in the catalog sources`);
}

// ---------- rule B: no UNVERIFIED price can render -------------------------------------------
{
  const hits = [];
  for (const rel of CATALOG_SOURCES) {
    const file = join(SITE, rel);
    const raw = readFileSync(file, 'utf8');
    if (rel.endsWith('.json')) {
      // any rendered string value carrying the marker fails (keys starting with _ are doc-only)
      const check = (val, path) => {
        if (typeof val === 'string' && val.includes('UNVERIFIED')) hits.push(`${rel} → ${path}`);
        else if (Array.isArray(val)) val.forEach((v, i) => check(v, `${path}[${i}]`));
        else if (val && typeof val === 'object')
          for (const [k, v] of Object.entries(val)) { if (!k.startsWith('_')) check(v, `${path}.${k}`); }
      };
      check(JSON.parse(raw), '$');
    } else {
      // strip block comments, then line comments; UNVERIFIED on what remains = active code
      const active = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
        .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
      if (active.includes('UNVERIFIED')) hits.push(`${rel} (active code line)`);
    }
  }
  if (hits.length) hits.forEach((h) => fail(`[B unverified-render] UNVERIFIED price reachable by render: ${h}`));
  else pass('[B unverified-render] no UNVERIFIED marker on any renderable line');
}

// ---------- rules C+D: provider state --------------------------------------------------------
{
  if (PROVIDER !== 'mock' && PROVIDER !== 'fourthwall') {
    fail(`[D provider] PUBLIC_COMMERCE_PROVIDER must be "mock" or "fourthwall", got "${PROVIDER}"`);
  } else pass(`[D provider] provider value valid: "${PROVIDER}"`);

  if (PROVIDER === 'fourthwall') {
    if (!FW_TOKEN) fail('[D provider] provider=fourthwall but PUBLIC_FW_STOREFRONT_TOKEN is missing');
    const overlay = readFileSync(join(SITE, 'src/lib/commerce/overlay.ts'), 'utf8');
    if (overlay.includes('UNVERIFIED')) {
      fail('[C cutover-guard] provider=fourthwall while overlay.ts still carries UNVERIFIED price markers - cutover blocked until every price is real (runbook §6)');
    } else pass('[C cutover-guard] overlay carries no UNVERIFIED markers');
  } else pass('[C cutover-guard] n/a while provider=mock');
}

// ---------- verdict --------------------------------------------------------------------------
if (failures.length) {
  console.error(`\ncatalog-lint: ${failures.length} failure(s). The catalog state is dishonest - fix the state, not the lint (docs/INVENTORY-RUNBOOK.md).`);
  process.exit(1);
}
console.log('\ncatalog-lint: PASS');
