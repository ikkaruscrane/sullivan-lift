# The Lift v2 — Design Spec

Date: 2026-09-28
Owner: Jeff Sullivan
Status: approved pending Jeff's review of this document

## What this is

A personal workout tracker, built as a static browser app, that shows Jeff his programming for the day, lets him log it with minimal taps, and carries him from the current cervical re-entry protocol into a rebuilt, RPE-based Royal Aesthetics Big Numbers wave. Replaces screenshotting HTML out of Claude. Named The Lift: the UI is an elevator/lobby, and it's about lifting.

## Goals

- Open the app → see today's workout, warmup, and close-out. No navigation required for the core loop.
- Per-set logging that defaults to one tap per set (pre-filled targets and last weights).
- Rest day is one button; the sequence waits, nothing shifts or breaks.
- Per-exercise hotel/limited-equipment swaps, plus a day-level Hotel mode shortcut.
- Prescriptions are sets × reps @ RPE. Weights are logged, never prescribed.
- Daily core close-out is structurally non-negotiable.
- Hosted free on GitHub Pages, works offline, installable to the iPhone home screen.

## Non-goals

- No backend, no accounts, no sync service. localStorage plus manual JSON export/import.
- No nutrition tracking, no supplement check-offs (supplements are a reference floor only).
- No ongoing Apple Health import in the app. The export is analyzed once during the build.
- The April 2026 Next.js/Supabase app (`Training/the-lift`) is not extended. It stays as-is.

## Architecture

Static app, three files, no build step:

| File | Purpose |
|---|---|
| `index.html` | Shell, styles (CSS variables from DESIGN_NOTES.md), fonts |
| `app.js` | All behavior: rendering, state, logging, navigation |
| `program-data.js` | The entire program as a data object: blocks, days, exercises, alternates, warmup menu, core/stabilizer menus |
| `sw.js` | Minimal service worker: cache-first so the app opens with no signal |

- Vanilla JS. No framework, no dependencies beyond Google Fonts (with system fallbacks).
- All state in `localStorage` under a single versioned key (`lift.v1`). Every write is wrapped in try/catch; a storage failure surfaces a visible warning banner rather than failing silently.
- Settings floor has Export (downloads the full state as JSON) and Import (file picker, validates shape, replaces state after confirm).
- Deployed as a public GitHub repo with Pages enabled. `<meta name="apple-mobile-web-app-capable">` + manifest so add-to-home-screen behaves like an app.

### Why static + localStorage

Jeff logs from his phone at the gym, always the same device. A single-device store with JSON backup covers the real usage; a sync backend adds infrastructure for a case that doesn't occur. If cross-device ever matters, the export/import path already defines the data contract.

## Design language

Carries the existing Lift design system (see `Training/the-lift/DESIGN_NOTES.md`) unchanged in its tokens:

- Colors: near-black elevator interior (`#0D0D0F` family), steel tones, single amber accent (`#FFB340`). No other accent colors.
- Type: Bebas Neue (display/floor names), DM Sans (UI), JetBrains Mono (all numbers).
- Frosted-glass cards, thin steel dividers, amber = active/lit.

Mobile-first lobby layout (the change from v1's desktop sidebar):

```
┌──────────────────────────────┐
│ THE LIFT      ▲ TODAY — PUSH │ ← floor indicator strip
├──────────────────────────────┤
│                              │
│        FLOOR CONTENT         │
│                              │
├──────────────────────────────┤
│  (G)   (2)   (3)   (4)  (5)  │ ← elevator button rail, round steel buttons
└──────────────────────────────┘
```

Floor transitions slide up/down by floor number, under 280ms. Buttons get the radial-gradient bevel and amber glow on the active floor.

## Floors

| Btn | Floor | Content |
|---|---|---|
| G | TODAY | Next workout in sequence: warmup card, exercise cards, core close-out, stabilizer block, workout note, Finish / Rest day |
| 2 | HISTORY | Reverse-chron list of sessions and rest days: date, day name, sets completed, swaps, skips, note. Tap to expand full set detail |
| 3 | PROGRAM | Browse the full plan: remaining re-entry weeks, phase gates, then the 16-week wave, week by week |
| 4 | STACK | Supplement stack reference, content ported from `sullivan_supplements.html`, restyled to Lift tokens |
| 5 | SETTINGS | Set position (block/week/day), export/import JSON, hotel mode default, reset with confirm |

## Scheduling model

Pure sequence. The program is an ordered list of workout days grouped into blocks and weeks. State holds one pointer (current day index). TODAY always renders the day at the pointer.

- **Finish workout** → session saved to history, pointer advances.
- **Rest day** → rest entry saved to history, pointer unchanged.
- Cadence hint under the day title, derived from recent history (e.g. Phase 1: "on-day 2 of 3 — rest tomorrow"). Informational only; nothing is enforced or calendar-bound.
- **Phase gates** (end of re-entry Phase 1 and 2, and entry to the wave) render as a checkpoint card: the gate criteria from the re-entry doc (no new neck symptoms, left/right feels matched; Phase 3 = check in with Maurice). Advancing past a gate is an explicit confirm.
- Position is editable in Settings at any time (pick block → week → day), which also covers the initial setup: Jeff starts at Week 2, Phase 1.

## Data model

`localStorage["lift.v1"]`:

```json
{
  "schemaVersion": 1,
  "position": { "dayIndex": 12 },
  "hotelModeDefault": false,
  "sessions": [
    {
      "date": "2026-09-28",
      "type": "workout",
      "dayId": "reentry-w2-d3",
      "warmup": { "choice": "stairmaster-25", "done": true },
      "exercises": [
        {
          "exerciseId": "rdl",
          "swappedTo": null,
          "skipped": false,
          "sets": [ { "reps": 10, "weight": 135, "rpe": 7 } ]
        }
      ],
      "core": [ { "exerciseId": "weighted-dead-bug", "sets": [ { "reps": 15, "weight": 10 } ] } ],
      "stabilizers": [],
      "note": "left trap felt fine"
    },
    { "date": "2026-09-29", "type": "rest" }
  ]
}
```

`program-data.js` shape:

```json
{
  "blocks": [
    {
      "id": "reentry",
      "name": "Re-Entry Protocol",
      "weeks": [
        {
          "label": "Week 2 — Phase 1",
          "days": [
            {
              "id": "reentry-w2-d1",
              "name": "Push",
              "warmupDefault": "stairmaster-25",
              "mobility": "band pull-aparts, arm circles, scap push-ups, thoracic openers",
              "flags": ["iso-first-set", "left-arm-extra-round"],
              "exercises": [
                {
                  "id": "bench-press",
                  "name": "Bench Press",
                  "sets": 4, "reps": "12", "rpe": "7",
                  "cue": "controlled 3–4 sec eccentric",
                  "alternates": [
                    { "id": "db-floor-press", "name": "DB Floor Press", "requires": "db-only" }
                  ]
                }
              ]
            }
          ],
          "gateAfter": null
        }
      ]
    },
    { "id": "wave", "name": "Big Numbers — RPE Wave", "weeks": ["...16 weeks..."] }
  ],
  "warmupMenu": [
    { "id": "stairmaster-25", "label": "Stairmaster · 25 min" },
    { "id": "row-15", "label": "Rowing · 15 min" },
    { "id": "run-1mi", "label": "Run · 1 mile" },
    { "id": "ropes-sled", "label": "Ropes + Sled" }
  ],
  "coreMenu": [
    "Weighted Dead Bug", "Oblique Extension (45 lb plate)", "Stability Ball Hamstring Curl",
    "Back Extension", "Weighted Decline Situp", "Ab Roller", "Rhomboid Superman"
  ],
  "stabilizerMenu": [
    "Bird Dog (weighted)", "Dead Bug variations", "Band External Rotation",
    "Y-T-W", "Serratus Punches"
  ]
}
```

Last-used weights per exercise are derived from `sessions` at render time (most recent non-skipped entry), not stored separately.

## TODAY flow

1. **Warmup card** — the four-option menu as tappable chips; the day-type default is pre-highlighted (Stairmaster on push/pull days; leg days default to Stairmaster too per Jeff's habit, rowing one tap away). Mobility line under it. One tap marks warmup done.
2. **Exercise cards** — name, tag (e.g. ISO WK1–2, left-arm bias), target `sets × reps @ RPE`, cue line. Set rows: each shows target reps and last-used weight pre-filled; tap = set done as shown; tap the numbers to edit reps/weight/RPE first. Controls per card: **skip** (one tap, greys the card, recorded) and **swap** (flips to the alternate; where two alternates exist — DB-only vs cable — a second tap cycles; alternates are tagged with what they need).
3. **Hotel mode** — toggle at the top of the day: swaps every exercise to its first alternate at once; individual cards can be un-swapped after. Settings can set hotel mode as the default-on state for travel weeks.
4. **Core close-out** — the 7-move menu; tap to select today's picks; each selected move renders 3×15 set rows with the same logging. At least one core move logged is required before Finish enables (the non-negotiable, made structural). High-fatigue escape hatch: one selection is enough.
5. **Stabilizer block** — same menu pattern (dead bug/bird dog family + shoulder-scap: band ER, Y-T-W, serratus punches), optional, full set logging when selected.
6. **Note field** — one optional free-text note per workout.
7. **Finish** — stamps the session, advances the pointer. **Rest day** sits beside it.

Everything on TODAY works one-handed on a phone; primary targets are large (Fitts), the day is chunked into warmup → work → close-out (Miller), and the single amber accent marks the one active thing (Von Restorff).

## Program content

### Block A — Re-entry remainder (RPE conversion)

Source: `re-entry-protocol.html`, starting position Week 2 Phase 1. All P1/P2/P3 weight ladders are dropped; each exercise becomes sets × reps @ RPE (ramping RPE 6–7 in Phase 1 to 7–8 in Phase 3, matching the doc's rep-first-then-load rule). Kept verbatim: the day structure (Push / Quads & Glutes / Posterior Chain / Pull / Hamstrings & Glutes), all cervical substitutions, isometric-first flags for weeks 1–2, the left-arm extra round, warmup/mobility patterns, and the phase gates with their symptom criteria. The daily core close-out replaces the doc's core finisher card with the 7-move menu.

### Block B — Big Numbers 2.0, rebuilt (16 weeks)

Source: the four workbook pages (structure, weeks 1–4 detail, movement variations, volume buckets). Weeks 5–16 are reconstructed from the workbook's own operating system — 4-week waves with deloads at weeks 4, 8, 12; hypertrophy foundation → strength progression; speed work waves — with these modifications:

- **All main lifts converted from percentage to RPE.** Rep/set schemes keep the workbook's wave shape; loads are RPE-prescribed (speed work at RPE 6–7 "move it fast", top-end work at RPE 8–8.5). No training maxes anywhere in the app.
- **Barbell OHP is out permanently.** Day 1 vertical press becomes Seated DB Shoulder Press / Arnold Press (RPE-based, as OHP already was), supported by the lateral raise + face pull delt volume.
- **Back squat and conventional deadlift return** as mains, per Jeff's decision. Only the overhead barbell press stays banned.
- **Volume buckets** render as set-count targets per bucket (e.g. Day 1: Delts 9–12, Arms 6–9) with the movement-variation lists as the selectable pool — same menu-card pattern as the core close-out.
- Deload weeks flag every card with reduced volume and RPE caps (workbook: keep load, cut volume, more reps in reserve).

### Hotel alternates (authored up front, every exercise)

Baseline assumption: dumbbells to ~50 lb + adjustable bench + cardio. Alternates tagged `db-only` or `needs-cable` so the per-exercise swap can cycle to what the gym actually has. Representative mappings: pendulum/back squat → DB goblet or Bulgarian split squat; leg press → DB step-up + lunge volume; chest-supported row → DB chest-supported row on incline bench; lat pulldown variants → band pulldown or DB pullover (`db-only`) / straight-arm pushdown (`needs-cable`); cable face pull → band face pull; hip thrust → single-leg DB hip thrust; adductor press → Copenhagen plank. The full mapping table is authored during implementation for every exercise in both blocks.

## Apple Health analysis (one-time, during build)

Input: `healthdata_092826.zip` (145 MB export). Parse `export.xml` for workouts (type, duration, frequency, gaps), resting HR, HRV, VO2max estimate, sleep, active energy, body mass over time.

Two outputs:

1. **Program-informing findings** — actual training frequency vs. plan, cardio baseline (whether the 25-min warmups are carrying his conditioning), session-length reality check, layoff patterns around travel. Fed into program-data decisions (e.g. realistic session budget).
2. **Health at 41** — a short standalone report (`docs/health-at-41.md`): a data-grounded picture of current cardiovascular fitness, recovery markers, activity and sleep patterns for a 41-year-old male, with fitting suggestions that supplement the training approach (conditioning dose, recovery/sleep levers, cardio mix). Framed as observations and training-adjacent suggestions, not medical advice; anything that looks clinically notable gets flagged as "worth mentioning to a doctor."

## Error handling

- localStorage unavailable/full → persistent warning banner; app still renders the program read-only.
- Import validates `schemaVersion` and shape; a bad file is rejected with a message, current state untouched.
- Unknown `dayId`/`exerciseId` in history (after a future program-data edit) → history renders the raw id rather than crashing.
- Service worker cache-busts on new deploys via a version string in `sw.js`.

## Testing

- Data-layer unit tests (plain JS, run with `node --test`): pointer advance/rest logic, last-weight derivation, export/import round-trip, import validation.
- Program-data integrity check script: every exercise has ≥1 alternate, every day has a warmup default, gate placement, no duplicate ids.
- Manual device pass on iPhone Safari: one-thumb logging, add-to-home-screen, offline open, floor transitions.

## Hosting & deployment

- New public GitHub repo (`the-lift-v2` or similar) under Jeff's personal GitHub account, Pages from `main`.
- URL: `https://<user>.github.io/<repo>/`. Add to iPhone home screen.
- Deploy = `git push`. No build step, no secrets, no cost. (BCG Zscaler note: pushing from this machine already works for other repos; nothing new needed.)

## Out of scope, explicitly

Nutrition, supplement adherence tracking, Apple Health import UI, auth, multi-user, charts/trends floor (candidate for a later session once there's logged data to chart).
