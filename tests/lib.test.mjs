// tests/lib.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SCHEMA_VERSION, defaultState, validateState,
  flattenDays, entryAt, advance, logRest, finishSession,
  lastWeights, todayISO,
} from "../lib.js";

const miniProgram = {
  blocks: [
    {
      id: "reentry", name: "Re-Entry",
      weeks: [
        {
          label: "Week 1 — Phase 1",
          days: [
            { id: "w1d1", name: "Push", exercises: [{ id: "bench", name: "Bench", sets: 4, reps: "12", rpe: "7" }] },
            { id: "w1d2", name: "Pull", exercises: [{ id: "row", name: "Row", sets: 3, reps: "10", rpe: "7" }] },
          ],
          gateAfter: { id: "gate-p1", title: "Phase 1 → 2", criteria: "No new neck symptoms." },
        },
        {
          label: "Week 2 — Phase 2",
          days: [{ id: "w2d1", name: "Push", exercises: [] }],
        },
      ],
    },
  ],
};

test("flattenDays interleaves days and gates in order", () => {
  const flat = flattenDays(miniProgram);
  assert.deepEqual(flat.map(e => e.kind), ["day", "day", "gate", "day"]);
  assert.equal(flat[0].day.id, "w1d1");
  assert.equal(flat[2].gate.id, "gate-p1");
  assert.equal(flat[0].blockId, "reentry");
  assert.equal(flat[0].weekLabel, "Week 1 — Phase 1");
});

test("entryAt clamps to the last entry", () => {
  const flat = flattenDays(miniProgram);
  assert.equal(entryAt(flat, 99).day.id, "w2d1");
  assert.equal(entryAt(flat, -1).day.id, "w1d1");
});

test("defaultState shape and version", () => {
  const s = defaultState(3);
  assert.equal(s.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(s.position, { dayIndex: 3 });
  assert.equal(s.hotelModeDefault, false);
  assert.deepEqual(s.sessions, []);
  assert.equal(s.draft, null);
});

test("validateState accepts a round-trip and rejects junk", () => {
  const good = defaultState(0);
  assert.equal(validateState(JSON.parse(JSON.stringify(good))).ok, true);
  assert.equal(validateState(null).ok, false);
  assert.equal(validateState({}).ok, false);
  assert.equal(validateState({ ...good, schemaVersion: 99 }).ok, false);
  assert.equal(validateState({ ...good, sessions: "nope" }).ok, false);
  assert.equal(validateState({ ...defaultState(0), sessions: [{ type: "workout" }] }).ok, false);   // missing date
  assert.equal(validateState({ ...defaultState(0), sessions: [{ date: "2026-09-28", type: "jog" }] }).ok, false); // bad type
});

test("finishSession appends, advances, clears draft; logRest does not advance", () => {
  const s = defaultState(0);
  s.draft = { anything: true };
  finishSession(s, { date: "2026-09-28", type: "workout", dayId: "w1d1", exercises: [] });
  assert.equal(s.sessions.length, 1);
  assert.equal(s.position.dayIndex, 1);
  assert.equal(s.draft, null);
  logRest(s, "2026-09-29");
  assert.equal(s.sessions.length, 2);
  assert.deepEqual(s.sessions[1], { date: "2026-09-29", type: "rest" });
  assert.equal(s.position.dayIndex, 1);
});

test("advance moves the pointer by one (gate confirm)", () => {
  const s = defaultState(2);
  advance(s);
  assert.equal(s.position.dayIndex, 3);
});

test("lastWeights returns per-set weights from the most recent session with that exercise", () => {
  const sessions = [
    { date: "2026-09-20", type: "workout", exercises: [
      { exerciseId: "bench", skipped: false, sets: [{ reps: 12, weight: 95 }, { reps: 12, weight: 105 }] }] },
    { date: "2026-09-25", type: "workout", exercises: [
      { exerciseId: "bench", skipped: false, sets: [{ reps: 12, weight: 100 }, { reps: 12, weight: 110 }] }] },
    { date: "2026-09-26", type: "workout", exercises: [
      { exerciseId: "bench", skipped: true, sets: [] }] },
    { date: "2026-09-27", type: "rest" },
  ];
  assert.deepEqual(lastWeights(sessions, "bench"), [100, 110]);   // skipped + rest ignored
  assert.deepEqual(lastWeights(sessions, "squat"), []);
  assert.deepEqual(lastWeights([...sessions, null], "bench"), [100, 110]);
});

test("lastWeights also finds core and stabilizer work, exercises first within a session", () => {
  const sessions = [
    { date: "2026-09-25", type: "workout", exercises: [], core: [
      { exerciseId: "core-deadbug", sets: [{ reps: 15, weight: 20 }, { reps: 15, weight: 25 }] }] },
    { date: "2026-09-26", type: "workout", exercises: [], core: [], stabilizers: [
      { exerciseId: "stab-ytw", sets: [{ reps: 8, weight: 10 }] }] },
  ];
  assert.deepEqual(lastWeights(sessions, "core-deadbug"), [20, 25]);
  assert.deepEqual(lastWeights(sessions, "stab-ytw"), [10]);
  assert.deepEqual(lastWeights(sessions, "core-abroller"), []);

  // a movement logged in both lists prefills from the day's working sets, not the close-out
  const both = [{ date: "2026-09-27", type: "workout",
    exercises:    [{ exerciseId: "sb-ham-curl", skipped: false, sets: [{ reps: 12, weight: 50 }] }],
    stabilizers:  [{ exerciseId: "sb-ham-curl", sets: [{ reps: 15, weight: 15 }] }] }];
  assert.deepEqual(lastWeights(both, "sb-ham-curl"), [50]);

  // skipped and empty entries are still ignored in the menu lists
  const skipped = [{ date: "2026-09-28", type: "workout", core: [
    { exerciseId: "core-deadbug", skipped: true, sets: [{ reps: 15, weight: 99 }] }] }];
  assert.deepEqual(lastWeights(skipped, "core-deadbug"), []);
});

test("lastWeights scans added work, ranked last within a session", () => {
  const sessions = [
    { date: "2026-09-25", type: "workout", exercises: [], core: [], stabilizers: [], extras: [
      { exerciseId: "pushups", sets: [{ reps: 15, weight: null }, { reps: 15, weight: 25 }] }] },
  ];
  assert.deepEqual(lastWeights(sessions, "pushups"), [null, 25]);
  assert.deepEqual(lastWeights(sessions, "plank"), []);

  // A shared id means a shared history: added work prefills planned work and vice versa.
  const shared = [
    { date: "2026-09-25", type: "workout", exercises: [], core: [], stabilizers: [], extras: [
      { exerciseId: "curl", sets: [{ reps: 12, weight: 30 }] }] },
  ];
  assert.deepEqual(lastWeights(shared, "curl"), [30]);

  // Within one session the day's working sets still win over the extras block.
  const both = [{ date: "2026-09-27", type: "workout",
    exercises: [{ exerciseId: "curl", skipped: false, sets: [{ reps: 10, weight: 40 }] }],
    extras:    [{ exerciseId: "curl", sets: [{ reps: 15, weight: 20 }] }] }];
  assert.deepEqual(lastWeights(both, "curl"), [40]);

  // Sessions predating added work carry no extras key at all — that must not throw.
  assert.deepEqual(lastWeights([{ date: "2026-09-20", type: "workout", exercises: [] }], "pushups"), []);
});

test("todayISO formats an explicit date exactly", () => {
  assert.equal(todayISO(new Date(2026, 8, 5)), "2026-09-05");
  assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
});
