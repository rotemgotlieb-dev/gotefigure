#!/usr/bin/env node
// Automated email-list backup (belt-and-suspenders; D1 stays the source of truth).
// Exports the D1 `subscribers` table to a timestamped, PRIVATE CSV on disk, verifies the
// exported row count equals the live D1 COUNT(*), and logs the run. Optionally copies the
// CSV into a PRIVATE git repo for an off-machine copy (opt-in, guarded).
//
// SAFETY (the old public-Google-Sheet exposure must never repeat):
//   - CSVs go to ~/Desktop/gotefigure-email-backups by default: OUTSIDE any repo.
//   - The script REFUSES to write the CSV inside the gotefigure-backend working tree
//     (a repo with a public remote) so real emails can never be committed there.
//   - The optional off-machine copy pushes ONLY to a git dir you point it at via
//     GF_BACKUP_GIT_DIR, and only after it confirms that dir is a git repo with a remote;
//     keep that repo PRIVATE. Nothing is pushed unless you set that env var.
//
// Run manually:  node scripts/backup-subscribers.mjs
// Scheduled:     via launchd (ops/launchd/com.rotem.gotefigure-email-backup.plist) — install
//                is Rotem's console step; see docs/EMAIL-BACKUP-RUNBOOK.md.
//
// Env (all optional):
//   GF_BACKUP_DIR       backup destination (default ~/Desktop/gotefigure-email-backups)
//   GF_BACKUP_GIT_DIR   a PRIVATE git repo dir to also copy+commit+push the CSV into (off by default)
//   GF_D1_ENV           'remote' (default) or 'local'
//   WRANGLER_BIN        path to wrangler (default: the repo's node_modules/.bin/wrangler)

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, appendFileSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join, basename } from 'node:path';

const REPO = resolve(import.meta.dirname, '..');       // gotefigure-backend
const SITE = join(REPO, 'site');
const DB = 'gotefigure';
const D1_ENV = process.env.GF_D1_ENV === 'local' ? '--local' : '--remote';
const WRANGLER = process.env.WRANGLER_BIN || join(SITE, 'node_modules', '.bin', 'wrangler');
const BACKUP_DIR = process.env.GF_BACKUP_DIR || join(homedir(), 'Desktop', 'gotefigure-email-backups');
const GIT_DIR = process.env.GF_BACKUP_GIT_DIR || '';   // opt-in off-machine copy

const log = (msg) => {
  const line = `${new Date().toISOString()} | ${msg}`;
  console.log(line);
  try { appendFileSync(join(BACKUP_DIR, 'backup.log'), line + '\n'); } catch {}
};
const die = (msg) => { log(`FAIL: ${msg}`); process.exit(1); };

// --- SAFETY: never write real emails inside a (pushable) repo working tree ---
if (resolve(BACKUP_DIR).startsWith(REPO + '/') || resolve(BACKUP_DIR) === REPO) {
  console.error(`REFUSING: backup dir ${BACKUP_DIR} is inside the repo ${REPO} (real emails must never be committable). Set GF_BACKUP_DIR outside any repo.`);
  process.exit(2);
}
mkdirSync(BACKUP_DIR, { recursive: true });

function d1(sql) {
  const out = execFileSync(WRANGLER, ['d1', 'execute', DB, D1_ENV, '--json', '--command', sql], {
    cwd: SITE, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  // wrangler prints a banner before the JSON array; slice from the first '['
  const i = out.indexOf('[');
  if (i < 0) throw new Error('no JSON in wrangler output');
  const parsed = JSON.parse(out.slice(i));
  return parsed[0]?.results ?? [];
}

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

try {
  log(`start: exporting ${DB} subscribers (${D1_ENV.replace('--', '')}) to ${BACKUP_DIR}`);

  const rows = d1('SELECT id, email, source, created_at FROM subscribers ORDER BY id;');
  const liveCount = Number(d1('SELECT COUNT(*) AS n FROM subscribers;')[0]?.n ?? -1);

  // Verify: exported rows == live COUNT(*). Fail closed (non-zero exit) on any mismatch.
  if (liveCount < 0) die('could not read live COUNT(*)');
  if (rows.length !== liveCount) die(`count mismatch: exported ${rows.length} rows but live count is ${liveCount}`);

  const header = 'id,email,source,created_at';
  const body = rows.map((r) => [r.id, r.email, r.source, r.created_at].map(csvCell).join(',')).join('\n');
  // YYYY-MM-DD in America/Los_Angeles (vault tz rule), not UTC - so an evening PT run is
  // filed under the correct PT day. en-CA locale renders as YYYY-MM-DD.
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const file = join(BACKUP_DIR, `${date}.csv`);
  writeFileSync(file, header + '\n' + body + (body ? '\n' : ''), 'utf8');

  log(`OK: wrote ${rows.length} rows -> ${file} (verified == live count ${liveCount})`);

  // --- Optional off-machine copy into a PRIVATE git repo ---
  if (GIT_DIR) {
    if (!existsSync(join(GIT_DIR, '.git'))) die(`GF_BACKUP_GIT_DIR ${GIT_DIR} is not a git repo`);
    const remote = execFileSync('git', ['-C', GIT_DIR, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
    if (!remote) die(`GF_BACKUP_GIT_DIR ${GIT_DIR} has no origin remote to push an off-machine copy to`);
    copyFileSync(file, join(GIT_DIR, basename(file)));
    execFileSync('git', ['-C', GIT_DIR, 'add', basename(file)]);
    execFileSync('git', ['-C', GIT_DIR, 'commit', '-m', `backup: subscribers ${date} (${rows.length} rows)`]);
    execFileSync('git', ['-C', GIT_DIR, 'push']);
    log(`OK: off-machine copy pushed to ${remote} (ENSURE this repo is PRIVATE)`);
  } else {
    log('off-machine copy: skipped (GF_BACKUP_GIT_DIR unset)');
  }

  log('done: SUCCESS');
} catch (e) {
  die(e?.message || String(e));
}
