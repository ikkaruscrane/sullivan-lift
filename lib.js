// lib.js — pure logic for The Lift. No DOM, no storage. Tested by tests/lib.test.mjs.
export const SCHEMA_VERSION = 1;

export function defaultState(startDayIndex = 0) {
  return {
    schemaVersion: SCHEMA_VERSION,
    position: { dayIndex: startDayIndex },
    hotelModeDefault: false,
    sessions: [],
    draft: null,
  };
}

export function validateState(obj) {
  if (!obj || typeof obj !== "object") return { ok: false, error: "not an object" };
  if (obj.schemaVersion !== SCHEMA_VERSION) return { ok: false, error: `schemaVersion must be ${SCHEMA_VERSION}` };
  if (!obj.position || !Number.isInteger(obj.position.dayIndex) || obj.position.dayIndex < 0)
    return { ok: false, error: "bad position" };
  if (!Array.isArray(obj.sessions)) return { ok: false, error: "sessions must be an array" };
  for (const s of obj.sessions) {
    if (!s || typeof s.date !== "string" || !["workout", "rest"].includes(s.type))
      return { ok: false, error: "bad session entry" };
  }
  return { ok: true };
}

// -> [{kind:"day", blockId, blockName, weekLabel, day} | {kind:"gate", blockId, blockName, weekLabel, gate}]
export function flattenDays(program) {
  const flat = [];
  for (const block of program.blocks) {
    for (const week of block.weeks) {
      for (const day of week.days) {
        flat.push({ kind: "day", blockId: block.id, blockName: block.name, weekLabel: week.label, day });
      }
      if (week.gateAfter) {
        flat.push({ kind: "gate", blockId: block.id, blockName: block.name, weekLabel: week.label, gate: week.gateAfter });
      }
    }
  }
  return flat;
}

export function entryAt(flat, dayIndex) {
  return flat[Math.min(Math.max(dayIndex, 0), flat.length - 1)];
}

export function advance(state) {
  state.position.dayIndex += 1;
}

export function logRest(state, date) {
  state.sessions.push({ date, type: "rest" });
}

export function finishSession(state, session) {
  state.sessions.push(session);
  state.draft = null;
  advance(state);
}

// Newest session first; within a session, the day's own exercises win over the core/stabilizer
// close-out and over ad-hoc added work, so a movement that appears in more than one list prefills
// from the working sets rather than the finisher or the scratch block.
const WEIGHT_SOURCES = ["exercises", "core", "stabilizers", "extras"];

export function lastWeights(sessions, exerciseId) {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i];
    if (!s || s.type !== "workout") continue;
    for (const key of WEIGHT_SOURCES) {
      if (!Array.isArray(s[key])) continue;
      const ex = s[key].find(e => e.exerciseId === exerciseId && !e.skipped && e.sets?.length);
      if (ex) return ex.sets.map(set => set.weight ?? null);
    }
  }
  return [];
}

export function todayISO(d = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
