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

**Proven run (2026-07-10):** exported **3 rows** to `2026-07-10.csv`, verified == live count 3,
destination confirmed OUTSIDE any git repo (not committable). See `backup.log`.

## Prerequisite (one time)
`wrangler login` in Rotem's shell (the job uses `--remote`, which needs the cached OAuth
token; the same login already used for D1/deploys). No secret is stored by this script.

## Install the daily schedule (Rotem's console step)
The launchd job is drafted in the repo but installing it is a system action:
```sh
cp ops/launchd/com.rotem.gotefigure-email-backup.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.rotem.gotefigure-email-backup.plist
launchctl list | grep gotefigure-email-backup     # confirm it registered
```
It runs 09:15 PT daily (the Mac must be awake, per the local-automation reality). Run it
on demand any time with:
```sh
cd ~/conductor/repos/gotefigure-backend && node scripts/backup-subscribers.mjs
```

## Optional: off-machine copy to a PRIVATE repo
Off by default. To also push each CSV off the machine, create a **private** repo and point
the job at it:
```sh
gh repo create gotefigure-email-backups --private --clone   # PRIVATE, never public
# then set the env for the job (e.g. in the plist's command or your shell):
GF_BACKUP_GIT_DIR="$HOME/path/to/gotefigure-email-backups" node scripts/backup-subscribers.mjs
```
The script refuses to run the off-machine copy unless that dir is a git repo with an
`origin` remote. It is on YOU to keep that repo private. Do not point it at any public repo.

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
