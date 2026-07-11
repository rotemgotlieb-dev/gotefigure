# Email-list backup runbook (belt-and-suspenders; D1 stays the source of truth)

A daily local backup of the GoteFigure D1 `subscribers` list to a **private** CSV, so the
own-the-data list survives an accidental D1 loss. This never re-creates the old public
Google-Sheet exposure: CSVs live outside any repo, and the optional off-machine copy pushes
only to a repo YOU designate as private.

## What runs
`scripts/backup-subscribers.mjs` (Node): reads D1 via the repo's `wrangler`, writes a
timestamped CSV, and **verifies the exported row count equals the live `COUNT(*)`** (fails
with a non-zero exit on any mismatch, so a bad run shows up in the launchd error log).

- Output: `~/Desktop/gotefigure-email-backups/YYYY-MM-DD.csv` (date in America/Los_Angeles)
- Run log: `~/Desktop/gotefigure-email-backups/backup.log`
- Columns: `id,email,source,created_at`

**Proven run (2026-07-11):** exported **4 rows** to `2026-07-11.csv`, verified == live count 4,
destination confirmed OUTSIDE any git repo (not committable), AND pushed off-machine to the
private repo (see below). Earlier proven run 2026-07-10: 3 rows, count-verified. See `backup.log`.

**STATUS (2026-07-11): LIVE.** The launchd job is installed + loaded and the off-machine
private repo is provisioned and wired into the plist (`EnvironmentVariables > GF_BACKUP_GIT_DIR`).
Off-machine repo: `rotemgotlieb-dev/gotefigure-email-backups` (PRIVATE), cloned to
`~/gotefigure-email-backups`.

## Prerequisite (one time)
`wrangler login` in Rotem's shell (the job uses `--remote`, which needs the cached OAuth
token; the same login already used for D1/deploys). No secret is stored by this script.

## Install the daily schedule (DONE 2026-07-11)
The launchd job is installed + loaded. It runs 09:15 PT daily (the Mac must be awake, per the
local-automation reality). The install steps that were run:
```sh
cp ops/launchd/com.rotem.gotefigure-email-backup.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.rotem.gotefigure-email-backup.plist
launchctl list | grep gotefigure-email-backup     # confirm it registered
```
Reverse (reversible at any time):
```sh
launchctl unload ~/Library/LaunchAgents/com.rotem.gotefigure-email-backup.plist
rm ~/Library/LaunchAgents/com.rotem.gotefigure-email-backup.plist
```
Run it on demand any time with (off-machine push included via the env var):
```sh
cd ~/conductor/repos/gotefigure-backend && \
  GF_BACKUP_GIT_DIR="$HOME/gotefigure-email-backups" node scripts/backup-subscribers.mjs
```

## Off-machine copy to a PRIVATE repo (PROVISIONED 2026-07-11)
Wired and live. The private repo `rotemgotlieb-dev/gotefigure-email-backups` is cloned to
`~/gotefigure-email-backups`, and the plist sets `GF_BACKUP_GIT_DIR` to it, so every scheduled
run also commits+pushes the CSV off-machine. It was set up with:
```sh
gh repo create rotemgotlieb-dev/gotefigure-email-backups --private   # PRIVATE, never public
gh repo clone rotemgotlieb-dev/gotefigure-email-backups ~/gotefigure-email-backups
# then GF_BACKUP_GIT_DIR is set in the plist's EnvironmentVariables dict.
```
The script refuses to run the off-machine copy unless that dir is a git repo with an
`origin` remote. Keep that repo PRIVATE. Do not point it at any public repo.

## Safety guarantees (why this can't repeat the public-sheet mistake)
- The script **refuses** to write the CSV inside the `gotefigure-backend` working tree (a
  repo with a public remote), so real emails can never be committed there.
- Default destination (`~/Desktop/...`) is outside version control entirely.
- The off-machine copy is opt-in and only ever targets the repo you name.
- `.gitignore` also excludes `gotefigure-email-backups/` as a backstop.

## Env knobs
`GF_BACKUP_DIR` (default `~/Desktop/gotefigure-email-backups`) ·
`GF_BACKUP_GIT_DIR` (off-machine private repo; unset = skip) ·
`GF_D1_ENV` (`remote` default | `local`) · `WRANGLER_BIN` (default: repo's wrangler).
