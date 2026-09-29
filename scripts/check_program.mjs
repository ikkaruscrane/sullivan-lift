// scripts/check_program.mjs — program-data integrity. Run: node scripts/check_program.mjs
import { PROGRAM, WARMUP_MENU, CORE_MENU, STABILIZER_MENU, STACK, START_DAY_INDEX } from "../program-data.js";
import { flattenDays } from "../lib.js";

const errors = [];
const warmupIds = new Set(WARMUP_MENU.map(w => w.id));
const flat = flattenDays(PROGRAM);

if (flat.filter(e => e.kind === "gate").length !== 2) errors.push("expected exactly 2 gates");
if (flat[START_DAY_INDEX]?.day?.id !== "re-w2-d1") errors.push(`START_DAY_INDEX must point at re-w2-d1, got ${flat[START_DAY_INDEX]?.day?.id}`);

for (const block of PROGRAM.blocks) {
  for (const week of block.weeks) {
    if (week.days.length !== 5) errors.push(`${week.label}: ${week.days.length} days (want 5)`);
    if (typeof week.cadence !== "string" || !week.cadence) errors.push(`${week.label}: missing cadence`);
    const ids = new Set();
    for (const day of week.days) {
      if (ids.has(day.id)) errors.push(`duplicate day id ${day.id}`);
      ids.add(day.id);
      if (!warmupIds.has(day.warmupDefault)) errors.push(`${day.id}: unknown warmupDefault ${day.warmupDefault}`);
      if (!day.mobility) errors.push(`${day.id}: missing mobility`);
      if (!day.exercises.length) errors.push(`${day.id}: no exercises`);
      const exIds = new Set();
      for (const ex of day.exercises) {
        if (exIds.has(ex.id)) errors.push(`${day.id}: duplicate exercise id ${ex.id}`);
        exIds.add(ex.id);
        if (!Number.isInteger(ex.sets) || ex.sets < 1) errors.push(`${day.id}/${ex.id}: bad sets`);
        if (!ex.reps) errors.push(`${day.id}/${ex.id}: missing reps`);
        if (!ex.alternates.length) errors.push(`${day.id}/${ex.id}: no hotel alternate`);
        else if (ex.alternates[0].requires !== "db-only") errors.push(`${day.id}/${ex.id}: first alternate must be db-only`);
        const shape = Object.keys(ex).sort().join(",");
        if (shape !== "alternates,cue,id,name,reps,rpe,sets,tag") errors.push(`${day.id}/${ex.id}: bad exercise shape: ${shape}`);
        for (const a of ex.alternates) {
          if (!["db-only", "needs-cable"].includes(a.requires)) errors.push(`${day.id}/${ex.id}: alternate ${a.id} bad requires: ${a.requires}`);
        }
      }
    }
  }
}
// one canonical name per exercise id
const nameById = new Map();
for (const e of flat) if (e.kind === "day") for (const ex of e.day.exercises) {
  if (nameById.has(ex.id) && nameById.get(ex.id) !== ex.name) errors.push(`id ${ex.id} has two names: "${nameById.get(ex.id)}" / "${ex.name}"`);
  nameById.set(ex.id, ex.name);
}
for (const m of [...CORE_MENU, ...STABILIZER_MENU]) {
  if (!m.id || !m.name || !m.sets || !m.reps) errors.push(`menu item ${m.id ?? "?"} incomplete`);
}
if (!STACK.length || STACK.some(s => !s.section || !s.items?.length)) errors.push("STACK empty or has empty sections");

if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`OK — ${flat.length} entries, ${flat.filter(e => e.kind === "day").length} training days`);
