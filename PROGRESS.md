# The Lift — progress log

Status snapshot and session history. Pair with `CLAUDE.md` (the how-to-work-here
rules) when picking this project back up. Update this file at the end of any
session that changes the app — curated entries, not play-by-play.

## Current state (as of 2026-09-30)

- **Live and in daily use:** https://ikkaruscrane.github.io/sullivan-lift/
  (GitHub Pages from `main` on `ikkaruscrane/sullivan-lift`; a push is a deploy).
- **Program position:** Jeff started at Re-Entry Week 2 Phase 1 on 2026-09-28.
  The app's pointer is the source of truth (Settings floor shows/edits it).
- **Complete:** all five floors (Today, History, Program, Stack, Settings),
  per-set logging with steppers + select-on-focus, hotel swaps + day toggle,
  core close-out gate, phase gates, Added Work (35-movement picker), offline
  PWA, export/import/reset.
- **Verification baseline:** `node --test` 10/10 · `node scripts/check_program.mjs`
  OK (102 entries, 100 training days, 35 extras) · `python3 tests/browser/test_lift.py`
  167/167. A change that lands with fewer than these is a regression.

## How a change ships (short version — full rules in CLAUDE.md)

1. Edit. Program content lives in `program-data.js`; behavior in `app.js`;
   pure logic in `lib.js`; styles in `index.html`.
2. Verify: the three commands above. Browser suite needs the Claude Code
   sandbox disabled (Chromium won't launch inside it) and Python `playwright`.
3. `git add -A && git commit && git push`. The network-first service worker
   picks it up on the next app launch — no version bump needed.
4. Push only `main`. Local archive branches never leave this machine.
5. Add a dated entry below.

## Backlog (agreed, non-blocking)

1. Wave "volume buckets" render as labels, not selectable pools — the one open
   spec deviation; decide build-the-pool vs amend the spec
2. `lastWeights` ignores `swappedTo` — hotel-swap weights prefill the barbell
   version next session; decision pending
3. Clickable divs → real buttons on history/program rows (a11y)
4. Position select: optgroup by block/week (102 flat options today)
5. `--danger` color token instead of inline `#c66` on RESET
6. Dedupe swap-name logic (`sessionDetailHTML` vs `resolvedExercise`)
7. Deload weeks: RPE cap on accessory cards, not just the day note
8. Abandoned inline editor discards stepped values silently — consider a dirty
   highlight on ✓ or auto-commit-on-abandon
9. `db-row`/`arnold-press`: the same movement reached as a swap vs an extra
   keeps two histories — fold alternate ids into the canonical-name check or
   document the split
10. Plank/side-plank show seconds in the reps slot, so history reads "45×—"
11. Candidate new floor: TRENDS (charts) once a few weeks of history exist

## Session log

### 2026-09-28 — design
Interviewed Jeff, wrote the design spec and 15-task implementation plan
(`docs/superpowers/`). Decisions locked: static + localStorage, pure-sequence
scheduling, RPE-only prescriptions, per-set logging, hotel alternates,
7-move core gate, barbell OHP out permanently, squat/deadlift back in the wave.

### 2026-09-29 — build + deploy
Executed all 15 plan tasks with per-task spec and quality reviews. One-time
Apple Health analysis fed the program (outputs deliberately kept outside this
public repo). Program data: 4-week re-entry (RPE-converted) + 16-week Big
Numbers wave, alternates on all 43 exercise ids, integrity script. App built
floor by floor with a Playwright E2E suite growing alongside (133 assertions at
ship). History squashed to one clean public commit; deployed to
`ikkaruscrane/sullivan-lift` (old repo content archived in a local branch);
Pages verified live. Notable review catches along the way: step-count
double-counting in the health data, taper-week note bug, a FINISH-gate
regression from non-destructive skip, an import crash path, SW staleness →
switched to network-first.

### 2026-09-29/30 — gym-ergonomics round
Jeff's first real-use feedback: editing prefilled values was clunky. Shipped
set-editor steppers (reps ±1, weight ±5, press-and-hold repeat, 44px targets)
with select-on-focus, and the ADDED WORK card — a 35-movement picker for
ad-hoc work (pushups, plank, Arnold press, …) with full set logging, history
("Added" section), and weight prefill. Reused program exercise ids on purpose
so history flows between planned and added work (integrity-enforced). Hardened
per review: hold-repeat teardown survives re-renders, imported drafts dedupe.
Suite: 167/167. Docs (`CLAUDE.md`, spec addendum, this file) updated.
