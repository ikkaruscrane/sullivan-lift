# The Lift — working in this repo

Static workout-tracker PWA. No framework, no build step. Live at
https://ikkaruscrane.github.io/sullivan-lift/ — served by GitHub Pages straight
from `main`. A push IS a deploy.

## Files

| File | Owns |
|---|---|
| `index.html` | Shell + all CSS (design tokens at the top; single amber accent, no other colors) |
| `app.js` | All DOM/rendering/events. One delegated click listener on `#floor`, routed per floor via `CLICK_HANDLERS` |
| `lib.js` | Pure logic (no DOM, no storage) — unit-tested |
| `program-data.js` | The entire training program as data. Edit workouts HERE, not in app.js |
| `sw.js` | Service worker — network-first, so deploys apply without touching VERSION |
| `scripts/check_program.mjs` | Integrity checks for program-data.js |
| `tests/` | `lib.test.mjs` (unit) + `browser/test_lift.py` (167-assertion Playwright E2E) |

## Edit → verify → deploy

```bash
# 1. verify after any change
node --test                                # unit (10 tests)
node scripts/check_program.mjs             # required after ANY program-data.js edit
python3 tests/browser/test_lift.py         # full E2E; see note below

# 2. deploy
git add -A && git commit -m "..."
git push                                   # that's the whole deploy
```

- The browser suite launches Chromium and cannot run inside the Claude Code
  sandbox (ProcessSingleton socket) — run it with the sandbox disabled. It
  needs the Python `playwright` package (`npm` is not installed on this Mac).
- Local dev: `python3 -m http.server 8123` then http://localhost:8123. The
  service worker deliberately does not register on localhost, so edits always
  show immediately.
- Program edits: keep the data contracts — every exercise has exactly the keys
  `{id, name, sets, reps, rpe, tag, cue, alternates}`, `alternates[0]` must be
  `requires: "db-only"` (Hotel mode depends on it), one canonical name per
  exercise id. `check_program.mjs` enforces all of this; run it, don't guess.
- `EXTRAS_MENU` (the ADDED WORK picker on TODAY) reuses program exercise ids on purpose, so
  weight history flows between planned and ad-hoc sets. A reused id must carry the exact
  canonical program name — `check_program.mjs` fails if it doesn't.
- `sw.js` VERSION only recycles the offline cache; freshness never depends on
  bumping it.

## Git rules (important)

- Push ONLY `main`. The local branches `dev-history` and `old-sullivan-lift`
  are archives that must never be pushed.
- Never force-push unless Jeff explicitly asks.
- Pushes authenticate as `ikkaruscrane` and are pinned repo-locally so they
  don't depend on which gh account is "active": this repo's git config clears
  inherited credential helpers and uses `!gh auth git-credential`, and the
  origin URL embeds the username (`https://ikkaruscrane@github.com/...`).
  If a push still 403s as `Sullivan-Jeff_bcgprod`, the ikkaruscrane login
  expired — have Jeff run `gh auth login` (as ikkaruscrane); the repo-local
  pinning then works again without further setup.
- This repo is PUBLIC. Never commit personal health data: the health analysis
  outputs live one level up in the Training folder, and `analysis/` is
  gitignored for the raw Apple Health extract. Keep it that way.

## Context

- App state is one localStorage key (`lift.v1`) on Jeff's phone — the repo
  holds no user data. Settings floor has JSON export/import for backup.
- Design/product contract: `docs/superpowers/specs/2026-09-28-the-lift-v2-design.md`.
  Build plan: `docs/superpowers/plans/2026-09-28-the-lift-v2.md`.
- Known backlog and private project notes: `../the-lift-v2-notes.md`
  (outside the repo, next to the health files).
