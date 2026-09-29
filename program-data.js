// program-data.js — the entire program as data. No logic beyond assembly helpers.

export const WARMUP_MENU = [
  { id: "stairmaster-25", label: "Stairmaster · 25 min" },
  { id: "row-15",         label: "Rowing · 15 min" },
  { id: "run-1mi",        label: "Run · 1 mile" },
  { id: "ropes-sled",     label: "Ropes + Sled" },
];

// Non-negotiable daily close-out. All 3×15.
export const CORE_MENU = [
  { id: "core-deadbug",   name: "Weighted Dead Bug",              sets: 3, reps: "15", cue: "slow, ribs stay down" },
  { id: "core-oblique",   name: "Oblique Extension (45 lb plate)", sets: 3, reps: "15", cue: null },
  { id: "core-sbhc",      name: "Stability Ball Hamstring Curl",  sets: 3, reps: "15", cue: "hold first rep 10 sec" },
  { id: "core-backext",   name: "Back Extension",                 sets: 3, reps: "15", cue: null },
  { id: "core-declinesit",name: "Weighted Decline Situp",         sets: 3, reps: "15", cue: null },
  { id: "core-abroller",  name: "Ab Roller",                      sets: 3, reps: "15", cue: null },
  { id: "core-superman",  name: "Rhomboid Superman",              sets: 3, reps: "15", cue: "chin tucked, eyes on the floor" },
];

// Optional stabilizer close-out block.
export const STABILIZER_MENU = [
  { id: "stab-birddog",  name: "Bird Dog (weighted)",     sets: 3, reps: "10 /side", cue: "slow, no hip roll" },
  { id: "stab-deadbugv", name: "Dead Bug variations",     sets: 3, reps: "10 /side", cue: "band or plate overhead" },
  { id: "stab-bander",   name: "Band External Rotation",  sets: 3, reps: "15", cue: "elbow pinned" },
  { id: "stab-ytw",      name: "Y-T-W",                   sets: 3, reps: "8 each", cue: "light, strict" },
  { id: "stab-serratus", name: "Serratus Punches",        sets: 3, reps: "12", cue: null },
];

// requires: "db-only" | "needs-cable". First entry is the Hotel-mode default.
const ALTERNATES = {
  // presses
  "bench-press":     [{ id: "db-bench", name: "DB Bench Press", requires: "db-only", cue: null }],
  "incline-db":      [{ id: "db-incline-alt", name: "DB Incline Press (any bench angle)", requires: "db-only", cue: null }],
  "speed-bench":     [{ id: "db-speed-press", name: "Explosive DB Press", requires: "db-only", cue: "same intent: move fast, crisp setup" }],
  "seated-db-press": [{ id: "arnold-press", name: "Arnold Press", requires: "db-only", cue: "already the swap — pick either" }],
  "cable-fly":       [{ id: "db-fly", name: "DB Fly (flat/incline)", requires: "db-only", cue: null }],
  // delts / shoulder health
  "cable-lat-raise": [{ id: "db-lat-raise-alt", name: "DB Lateral Raise", requires: "db-only", cue: null }],
  "db-lat-raise":    [{ id: "lean-lat-raise", name: "Leaning DB Lateral Raise", requires: "db-only", cue: null }],
  "face-pull":       [{ id: "band-face-pull", name: "Band Face Pull", requires: "db-only", cue: "pack a band when traveling" },
                      { id: "db-rear-fly", name: "DB Rear Delt Fly (chest on incline bench)", requires: "db-only", cue: "chest supported, neck neutral" }],
  // triceps / biceps
  "tri-pushdown":    [{ id: "db-kickback", name: "DB Kickback / DB Skullcrusher", requires: "db-only", cue: "arms below shoulder line" }],
  "rope-pushdown":   [{ id: "db-oh-ext-alt", name: "DB Skullcrusher", requires: "db-only", cue: null }],
  "oh-tri-ext":      [{ id: "db-skull", name: "DB Skullcrusher", requires: "db-only", cue: null },
                      { id: "pushdown-alt", name: "Cable Pushdown", requires: "needs-cable", cue: "neck-friendlier angle" }],
  "curl":            [{ id: "db-curl-alt", name: "DB Curl", requires: "db-only", cue: null }],
  "hammer-curl":     [{ id: "db-hammer-alt", name: "DB Hammer Curl", requires: "db-only", cue: null }],
  // squat patterns
  "pendulum-squat":  [{ id: "goblet-squat", name: "Goblet Squat", requires: "db-only", cue: "heels elevated if available" },
                      { id: "hack-squat", name: "Hack Squat / Leg Press", requires: "needs-cable", cue: "any fixed-track squat machine" }],
  "back-squat":      [{ id: "goblet-squat2", name: "Goblet Squat", requires: "db-only", cue: null },
                      { id: "db-bss-heavy", name: "Heavy DB Bulgarian Split Squat", requires: "db-only", cue: null }],
  "speed-squat":     [{ id: "jump-squat", name: "DB Jump Squat (light)", requires: "db-only", cue: "explosive, quiet landings" }],
  "leg-press":       [{ id: "db-stepup-alt", name: "DB Step-Up + Lunge", requires: "db-only", cue: null }],
  "leg-ext":         [{ id: "sissy-squat", name: "Sissy Squat / Wall Sit", requires: "db-only", cue: "slow eccentric" }],
  "bss":             [{ id: "db-split-squat", name: "DB Split Squat", requires: "db-only", cue: null }],
  "walking-lunge":   [{ id: "reverse-lunge", name: "DB Reverse Lunge", requires: "db-only", cue: null }],
  "step-up":         [{ id: "db-stepup2", name: "DB Step-Up (bench)", requires: "db-only", cue: null }],
  "calf-standing":   [{ id: "db-calf", name: "Single-Leg DB Calf Raise (on a step)", requires: "db-only", cue: null }],
  // hinges / posterior
  "deadlift":        [{ id: "db-rdl-heavy", name: "Heavy DB RDL", requires: "db-only", cue: null }],
  "rdl":             [{ id: "db-rdl", name: "DB RDL", requires: "db-only", cue: null }],
  "bstance-rdl":     [{ id: "db-bstance", name: "DB B-Stance RDL", requires: "db-only", cue: null }],
  "pull-through":    [{ id: "db-swing-hinge", name: "DB Swing / DB Good Morning", requires: "db-only", cue: null }],
  "kb-swing":        [{ id: "db-swing", name: "DB Swing", requires: "db-only", cue: null }],
  "hip-thrust":      [{ id: "sl-hip-thrust", name: "Single-Leg DB Hip Thrust (bench)", requires: "db-only", cue: null }],
  "ham-curl":        [{ id: "sb-curl-alt", name: "Stability Ball / Slider Hamstring Curl", requires: "db-only", cue: null }],
  "seated-curl":     [{ id: "sb-curl-alt2", name: "Stability Ball / Slider Hamstring Curl", requires: "db-only", cue: null }],
  "lying-curl":      [{ id: "db-lying-curl", name: "DB Lying Leg Curl (DB between feet)", requires: "db-only", cue: null }],
  "adductor":        [{ id: "copenhagen", name: "Copenhagen Plank", requires: "db-only", cue: "short lever first" }],
  "finisher-sled":   [{ id: "farmer-carry", name: "Farmer Carries", requires: "db-only", cue: "heaviest DBs available" }],
  // pulls
  "ng-pulldown":     [{ id: "band-pulldown", name: "Band Pulldown / DB Pullover", requires: "db-only", cue: null },
                      { id: "cable-pulldown-alt", name: "Any cable pulldown (neutral grip)", requires: "needs-cable", cue: null }],
  "narrow-pulldown": [{ id: "band-pulldown2", name: "Band Pulldown / DB Pullover", requires: "db-only", cue: null }],
  "sa-pulldown":     [{ id: "sa-band-pulldown", name: "Single-Arm Band Pulldown", requires: "db-only", cue: "keep the left-arm bias" }],
  "cs-row":          [{ id: "db-cs-row", name: "DB Chest-Supported Row (incline bench)", requires: "db-only", cue: null }],
  "bent-row":        [{ id: "db-row", name: "Heavy 1-Arm DB Row", requires: "db-only", cue: "knee on bench, flat back" }],
  "db-shrug":        [{ id: "db-shrug-alt", name: "DB Shrugs (they travel fine)", requires: "db-only", cue: null }],
  "w-superman":      [{ id: "floor-superman", name: "Floor Superman (bodyweight)", requires: "db-only", cue: "chin tucked" }],
  // core / accessories that appear as day exercises
  "cable-crunch":    [{ id: "weighted-crunch", name: "Weighted Crunch (plate/DB)", requires: "db-only", cue: null }],
  "abwheel-hlr":     [{ id: "walkout", name: "Plank Walkout", requires: "db-only", cue: null }],
  "sb-ham-curl":     [{ id: "slider-curl", name: "Slider / Towel Hamstring Curl", requires: "db-only", cue: null }],
};

export const STACK = [
  {
    section: "Pre-Workout", timing: "30–45 min before training",
    items: [
      { name: "Bucked Up Pre-Workout", detail: "Strawberry Kiwi · 1 scoop", facts: "200mg caffeine · 6g citrulline malate · Alpha GPC",
        blurb: "Focus and drive ~20 min in; tingles are the beta-alanine; pump from the first working sets." },
      { name: "NOXygen", detail: "Purus Labs · Pump Amplifier · 1 scoop", facts: "1,500mg HydroMax · 740mg NO3-T",
        blurb: "Glycerol draws water into muscle for a fuller pump; the nitrate blend adds a second NO pathway that stacks with citrulline — most noticeable on leg and pull days." },
      { name: "L-Citrulline Malate", detail: "Bulk Supplements · DL-Malate 2:1 · 2 scoops", facts: "~4,000mg actual citrulline · ~8,000mg stack total with Bucked Up",
        blurb: "Tops off the citrulline stack to ~8g actual — the top of the therapeutic range — for max pump and sustained reps late in high-rep sets. Citrulline malate isn't gram-equivalent to pure citrulline, so both sources are needed to hit the target dose." },
      { name: "Propel", detail: "Gatorade · Sugar Free · 1 packet", facts: "210mg sodium · 70mg potassium",
        blurb: "Baseline electrolyte replacement for moderate sessions; on heavy lower-body or posterior-chain days, add a second packet or salt food to cover the extra demand." },
      { name: "Beta-Alanine", detail: "Standalone · 4 capsules (training day + rest day)", facts: "4 caps AM · 5,400mg total/day with Bucked Up",
        blurb: "Raises muscle carnosine to buffer lactic acid — more reps before the burn becomes limiting. Tingling is normal; take it on rest days too, since daily consistency is what builds the carnosine stores." },
    ],
  },
  {
    section: "Morning", timing: "With breakfast",
    items: [
      { name: "Creatine", detail: "Finaflex · Capsules (AM) + Powder (Post-WO)", facts: "6 AM caps + 1 post-WO scoop · ~9,750mg/day",
        blurb: "Saturates phosphocreatine for strength in low-rep ranges and fuller muscle volume. Note: 6 AM caps plus the post-workout scoop is nearly double the 5g maintenance dose — consider 3 caps AM only, or dropping the capsules and using just the powder." },
      { name: "Multivitamin", detail: "One A Day Men's · Bayer · 1 tablet", facts: "11mg zinc · 1,000 IU D3",
        blurb: "Insurance against micronutrient gaps (B12, B6, folate, selenium, iodine); its D3 and magnesium are low-dose/low-bioavailability forms, covered separately by the D3/K2 and glycinate." },
      { name: "Fish Oil (AM)", detail: "Nordic Naturals · 2 of 4 softgels", facts: "650mg EPA · 450mg DHA",
        blurb: "Omega-3s cut training-induced inflammation and support joint lubrication; splitting the dose AM/PM improves absorption and reduces oxidation versus taking all 4 at once." },
    ],
  },
  {
    section: "Post-Workout", timing: "Within 30 min of training",
    items: [
      { name: "Casein Protein", detail: "Dymatize Elite · 2 scoops", facts: "25g protein · 2.3g leucine",
        blurb: "Slow-digesting casein sustains amino acid availability for 5–7 hours post-training, past the MPS-triggering leucine threshold — useful when the next whole-food meal is delayed." },
      { name: "Creatine Powder", detail: "Finaflex · 1 scoop post-workout", facts: "5g per serving · monohydrate",
        blurb: "Post-workout insulin spike improves uptake, making this the better-timed of the two creatine doses. Combined with the AM capsules it's ~9.75g/day — keep this one if consolidating down to a single dose." },
      { name: "VERISOL Collagen", detail: "3 tablets · with Vitamin C", facts: "2,500mg collagen · 1,500mcg biotin",
        blurb: "A studied collagen peptide for skin elasticity and dermal thickness; post-workout timing leverages elevated GH/IGF-1 for synthesis, and it needs the Vitamin C for hydroxylation. A 3–6 month project, not a daily feel." },
    ],
  },
  {
    section: "Dinner", timing: "With fattiest meal of the day",
    items: [
      { name: "Fish Oil (PM)", detail: "Nordic Naturals · 2 of 4 softgels", facts: "1,300mg daily EPA · 900mg daily DHA",
        blurb: "Second half of the daily dose, taken with dietary fat for absorption; the combined daily total hits the therapeutic anti-inflammatory threshold and lines up with the overnight repair window." },
      { name: "Vitamin D3 + K2", detail: "Pure Encapsulations · 4,000 IU per cap · 2 caps (loading, 8–12 wk)", facts: "8,000 IU D3/day · 200mcg K2 (MK-7)",
        blurb: "D3 is a steroid-hormone precursor supporting testosterone and muscle protein synthesis; K2 directs calcium to bone instead of soft tissue. Drop to 1 cap maintenance after 8–12 weeks and verify with bloodwork." },
    ],
  },
  {
    section: "Night", timing: "30–60 min before sleep",
    items: [
      { name: "Magnesium Glycinate", detail: "Nature's Bounty · 2–3 capsules", facts: "240–360mg elemental Mg · glycinate form",
        blurb: "High-bioavailability magnesium for muscle relaxation and sleep depth; noticeably easier to fall asleep within 3–5 nights, with less next-morning stiffness." },
      { name: "Ashwagandha KSM-66", detail: "Youtheory · 2 capsules", facts: "600mg KSM-66 · 1,000mg total",
        blurb: "Lowers cortisol via HPA-axis modulation, countering elevated nighttime cortisol from heavy training loads; over 4–8 weeks expect lower baseline anxiety and less grogginess on waking." },
      { name: "Psyllium Husk Fiber", detail: "NOW · 1 tsp before highest-protein meal", facts: "~5g fiber · pre-meal timing",
        blurb: "Buffers the GI burden of a high-protein diet by slowing gastric emptying and feeding gut bacteria; expect more comfortable digestion and better satiety within a week." },
    ],
  },
];

const MOBILITY_UPPER = "Band pull-aparts, arm circles, scap push-ups, thoracic/shoulder openers";
const MOBILITY_LOWER = "Foam roll, banded monster walks, hip flexor warm-up";

// ---- Re-entry day templates (from re-entry-protocol.html, RPE-converted) ----
// rpe values are [phase1, phase2] — resolved per week below.
const RE_DAYS = [
  {
    key: "push", name: "Push", warmupDefault: "stairmaster-25", mobility: MOBILITY_UPPER,
    exercises: [
      { id: "bench-press",    name: "Bench Press",           sets: 4, reps: "12",    rpe: ["6-7", "7-8"], tagW12: "ISO WK1-2", cue: "controlled 3–4 sec eccentric" },
      { id: "incline-db",     name: "Incline DB Press",      sets: 3, reps: "12",    rpe: ["6-7", "7-8"], tagW12: "ISO WK1-2", cue: null },
      { id: "cable-lat-raise",name: "Cable Lateral Raise",   sets: 3, reps: "15-20", rpe: ["6", "7"],     cue: "light, high volume — this is the delt work now, not the press" },
      { id: "face-pull",      name: "Cable Face Pull",       sets: 3, reps: "15",    rpe: ["6-7", "7"],   cue: "elbows high, no overhead lockout" },
      { id: "tri-pushdown",   name: "Cable Triceps Pushdown",sets: 3, reps: "12",    rpe: ["6-7", "7-8"], cue: "arms stay below shoulder line" },
    ],
  },
  {
    key: "quads", name: "Quads & Glutes", warmupDefault: "row-15", mobility: MOBILITY_LOWER,
    exercises: [
      { id: "pendulum-squat", name: "Pendulum Squat",        sets: 4, reps: "12/10/8/8", rpe: ["6-7", "7-8"], cue: null },
      { id: "leg-press",      name: "Leg Press",             sets: 4, reps: "10/10/8",   rpe: ["6-7", "7-8"], tag: "narrow stance", cue: null },
      { id: "bss",            name: "Bulgarian Split Squat", sets: 3, reps: "8-10 /leg", rpe: ["6-7", "7"],   cue: "superset with walking lunges" },
      { id: "walking-lunge",  name: "Walking Lunges",        sets: 3, reps: "10 /leg",   rpe: ["6-7", "7"],   cue: "stay low" },
      { id: "leg-ext",        name: "Leg Extension",         sets: 3, reps: "12",        rpe: ["6-7", "7-8"], cue: "2 sec hold, 4 sec down" },
      { id: "calf-standing",  name: "Standing Calf Raise",   sets: 3, reps: "15",        rpe: ["6-7", "7-8"], cue: null },
    ],
  },
  {
    key: "posterior", name: "Posterior Chain", warmupDefault: "row-15", mobility: MOBILITY_LOWER,
    exercises: [
      { id: "rdl",            name: "Romanian Deadlift",            sets: 4, reps: "10/10/8/8", rpe: ["6-7", "7-8"], tag: "replaces deadlift", cue: "hinge at hip, soft knee, bar stays close" },
      { id: "pull-through",   name: "Cable Pull-Through",           sets: 4, reps: "12",        rpe: ["6-7", "7-8"], cue: null },
      { id: "ng-pulldown",    name: "Neutral-Grip Lat Pulldown",    sets: 3, reps: "10",        rpe: ["6-7", "7-8"], tag: "replaces assisted pull-up", cue: null },
      { id: "kb-swing",       name: "KB Swings",                    sets: 3, reps: "12",        rpe: ["6", "7"],     cue: "controlled through Phase 1, no explosive top-end until Phase 2" },
      { id: "sb-ham-curl",    name: "Stability Ball Hamstring Curl",sets: 3, reps: "12",        rpe: ["6-7", "7"],   cue: "hold first rep 10 sec" },
      { id: "finisher-sled",  name: "Finisher: Sled Push/Pull or Farmer Carries", sets: 1, reps: "—", rpe: [null, null], cue: "sled @ Cowboys, farmer carries on the road" },
    ],
  },
  {
    key: "pull", name: "Pull", warmupDefault: "stairmaster-25", mobility: MOBILITY_UPPER,
    exercises: [
      { id: "narrow-pulldown",name: "Narrow-Grip Lat Pulldown", sets: 4, reps: "10",    rpe: ["6-7", "7-8"], tagW12: "ISO WK1-2", tag: "replaces assisted pull-up", cue: null },
      { id: "cs-row",         name: "Chest-Supported Row",      sets: 4, reps: "8-10",  rpe: ["6-7", "7-8"], tagW12: "ISO WK1-2", tag: "replaces barbell row", cue: "chest pinned, no lumbar involvement" },
      { id: "sa-pulldown",    name: "SA Lat Pulldown",          sets: 3, reps: "10-12", rpe: ["6-7", "7-8"], tag: "left-arm bias", cue: "left arm: +1 isometric round (Phase 1–2)" },
      { id: "face-pull",      name: "Cable Face Pull",         sets: 3, reps: "12-15", rpe: ["6-7", "7"],   cue: null },
      { id: "w-superman",     name: "Weighted Superman",        sets: 3, reps: "12-15", rpe: ["6", "7"],     tag: "replaces rear delt fly", cue: "chin tucked, eyes on the floor — don't extend through the neck" },
      { id: "curl",           name: "EZ / DB Curl",             sets: 3, reps: "10-12", rpe: ["6-7", "7-8"], cue: null },
    ],
  },
  {
    key: "hams", name: "Hamstrings & Glutes", warmupDefault: "row-15", mobility: MOBILITY_LOWER,
    exercises: [
      { id: "pendulum-squat", name: "Pendulum Squat",   sets: 4, reps: "12",     rpe: ["6-7", "7-8"], tag: "back squat option removed", cue: null },
      { id: "bstance-rdl",    name: "B-Stance RDL",     sets: 4, reps: "10",     rpe: ["6-7", "7-8"], cue: null },
      { id: "hip-thrust",     name: "Hip Thrust",       sets: 4, reps: "8",      rpe: ["6-7", "7-8"], cue: null },
      { id: "step-up",        name: "Step Ups",         sets: 4, reps: "10",     rpe: ["6-7", "7"],   cue: "full 90° knee flexion" },
      { id: "ham-curl",       name: "Hamstring Curls",  sets: 3, reps: "12",     rpe: ["6-7", "7-8"], cue: null },
      { id: "adductor",       name: "Adductor Press",   sets: 3, reps: "15",     rpe: ["6-7", "7"],   cue: null },
    ],
  },
];

// Build one re-entry week. phaseIdx: 0 = Phase 1, 1 = Phase 2. isoWeek: weeks 1–2 only.
function reentryWeek(weekNum, phaseIdx, isoWeek, label, cadence, gateAfter = null) {
  return {
    label,
    cadence,
    days: RE_DAYS.map((d, i) => ({
      id: `re-w${weekNum}-d${i + 1}`,
      name: d.name,
      warmupDefault: d.warmupDefault,
      mobility: d.mobility,
      note: isoWeek && d.exercises.some(e => e.tagW12)
        ? "Weeks 1–2: first set of flagged movements is a 3-position isometric hold (bottom/mid/top, 8–10 sec each). Left arm gets one extra round."
        : null,
      exercises: d.exercises.map(e => ({
        id: e.id, name: e.name, sets: e.sets, reps: e.reps,
        rpe: e.rpe[phaseIdx],
        tag: [isoWeek && e.tagW12, e.tag].filter(Boolean).join(" · ") || null,
        cue: e.cue ?? null,
        alternates: ALTERNATES[e.id] ?? [],
      })),
    })),
    gateAfter,
  };
}

// ---- Big Numbers wave (16 weeks, RPE-rebuilt) ----
// Buckets shown per day (workbook): D1 Delts 9-12 · Arms 6-9 | D2 Quads 11-15 · Core 3-5
// D3 Pecs 9-12 · Triceps 6-9 | D4 Hamstrings 6-10 · Core 3-5 | D5 Lats 9-12 · Traps 3-6 · Rear Delts 3-6 · Biceps 6-9
const PREACTIVATE = "Pre-activate 5 min: band pull-aparts → external rotation → Y-T-W → serratus punches";

const WAVE_DAYS = [
  {
    key: "speed-upper", name: "Speed Upper", warmupDefault: "stairmaster-25", mobility: MOBILITY_UPPER,
    buckets: "Delts 9–12 · Arms 6–9", note: PREACTIVATE,
    exercises: [
      { id: "speed-bench", name: "Speed Bench", kind: "speed", cue: "move the bar fast; perfect setup" },
      { id: "seated-db-press", name: "Seated DB Shoulder Press / Arnold Press", kind: "vpress", tag: "replaces barbell OHP", cue: "seated, back supported" },
      { id: "cable-lat-raise", name: "Cable Lateral Raise", sets: 3, reps: "15-20", rpe: "7-8", cue: "medial-heavy — press covers front delts" },
      { id: "db-lat-raise",    name: "DB Lateral Raise",    sets: 3, reps: "12-15", rpe: "7-8", cue: null },
      { id: "rope-pushdown",   name: "Rope Pushdown",       sets: 3, reps: "12-15", rpe: "7-8", cue: null },
      { id: "curl",            name: "EZ / DB Curl",        sets: 3, reps: "10-12", rpe: "7-8", cue: null },
    ],
  },
  {
    key: "squat", name: "Squat", warmupDefault: "row-15", mobility: MOBILITY_LOWER,
    buckets: "Quads 11–15 · Core 3–5",
    exercises: [
      { id: "back-squat", name: "Back Squat", kind: "main", cue: null },
      { id: "rdl",        name: "Romanian Deadlift", sets: 3, reps: "8-10", rpe: "7-8", tag: "DL-variation slot", cue: null },
      { id: "bss",        name: "Bulgarian Split Squat", sets: 3, reps: "8-10 /leg", rpe: "7-8", cue: "unilateral glute + quad" },
      { id: "leg-press",  name: "Leg Press", sets: 3, reps: "10-12", rpe: "7-8", cue: null },
      { id: "leg-ext",    name: "Leg Extension", sets: 3, reps: "12-15", rpe: "7-8", cue: "2 sec hold, 4 sec eccentric" },
      { id: "cable-crunch", name: "Cable Crunch", sets: 3, reps: "12-15", rpe: "7-8", cue: "loaded flexion" },
    ],
  },
  {
    key: "bench", name: "Bench", warmupDefault: "stairmaster-25", mobility: MOBILITY_UPPER,
    buckets: "Pecs 9–12 · Triceps 6–9", note: PREACTIVATE,
    exercises: [
      { id: "bench-press", name: "Bench Press", kind: "main", cue: null },
      { id: "incline-db",  name: "Incline DB Press", sets: 3, reps: "8-10", rpe: "7-8", tag: "bench-variation slot", cue: "upper-chest bias — DB or barbell incline, not close-grip" },
      { id: "cable-fly",   name: "Cable Fly", sets: 3, reps: "12-15", rpe: "7-8", cue: null },
      { id: "oh-tri-ext",  name: "Overhead Cable / DB Extension", sets: 3, reps: "12-15", rpe: "7-8", cue: "long-head priority; stop if neck complains — swap to pushdown" },
      { id: "rope-pushdown", name: "Rope Pushdown", sets: 3, reps: "12-15", rpe: "7-8", cue: null },
    ],
  },
  {
    key: "speed-squat-dl", name: "Speed Squat + Deadlift", warmupDefault: "row-15", mobility: MOBILITY_LOWER,
    buckets: "Hamstrings 6–10 · Core 3–5",
    exercises: [
      { id: "speed-squat", name: "Speed Squat", kind: "speed", cue: "explosive reps, clean form" },
      { id: "deadlift",    name: "Conventional Deadlift", kind: "main", cue: null },
      { id: "seated-curl", name: "Seated Leg Curl", sets: 4, reps: "10-12", rpe: "7-8", cue: "stretched position" },
      { id: "lying-curl",  name: "Lying Leg Curl", sets: 3, reps: "12-15", rpe: "7-8", cue: null },
      { id: "abwheel-hlr", name: "Ab Wheel / Hanging Leg Raise", sets: 3, reps: "8-12", rpe: null, cue: "anti-extension — no extra hinging today" },
    ],
  },
  {
    key: "back", name: "Back", warmupDefault: "stairmaster-25", mobility: MOBILITY_UPPER,
    buckets: "Lats 9–12 · Traps 3–6 · Rear Delts 3–6 · Biceps 6–9", note: PREACTIVATE,
    exercises: [
      { id: "ng-pulldown", name: "Neutral-Grip Lat Pulldown", kind: "main", cue: null },
      { id: "bent-row",    name: "Bent-Over Row", sets: 3, reps: "6-8", rpe: "7-8", tag: "heavy secondary", cue: "by feel" },
      { id: "cs-row",      name: "Chest-Supported Row", sets: 3, reps: "10-12", rpe: "7-8", cue: "or SA pulldown — spares the lower back" },
      { id: "db-shrug",    name: "DB Shrugs", sets: 3, reps: "12-15", rpe: "7-8", cue: null },
      { id: "face-pull",   name: "Cable Face Pull", sets: 3, reps: "15-20", rpe: "7", cue: "doubles as shoulder-health work" },
      { id: "curl",        name: "EZ / DB Curl", sets: 3, reps: "10-12", rpe: "7-8", cue: null },
      { id: "hammer-curl", name: "Hammer Curl", sets: 3, reps: "12", rpe: "7-8", cue: null },
    ],
  },
];

// Weekly prescriptions for main/speed/vertical-press slots. main/speed/vpress: [sets, reps, rpe].
const WAVE_SCHEME = [
  { label: "Week 1 — Hypertrophy Foundation",  main: [4, "12", "7"],   speed: [6, "3", "6-7"], vpress: [4, "8", "7"],   deload: false },
  { label: "Week 2 — Hypertrophy Foundation",  main: [3, "12", "7.5"], speed: [6, "2", "6-7"], vpress: [4, "8", "7.5"], deload: false },
  { label: "Week 3 — Hypertrophy Foundation",  main: [4, "10", "8"],   speed: [8, "3", "7"],   vpress: [5, "8", "8"],   deload: false },
  { label: "Week 4 — Deload",                  main: [2, "10", "6"],   speed: [4, "3", "6"],   vpress: [3, "8", "6"],   deload: true },
  { label: "Week 5 — Strength Build",          main: [4, "8", "7.5"],  speed: [6, "3", "6-7"], vpress: [4, "8", "7.5"], deload: false },
  { label: "Week 6 — Strength Build",          main: [4, "6", "8"],    speed: [6, "2", "7"],   vpress: [4, "6", "8"],   deload: false },
  { label: "Week 7 — Strength Build",          main: [5, "5", "8"],    speed: [8, "2", "7"],   vpress: [5, "6", "8"],   deload: false },
  { label: "Week 8 — Deload",                  main: [2, "8", "6"],    speed: [4, "2", "6"],   vpress: [3, "8", "6"],   deload: true },
  { label: "Week 9 — Strength",                main: [5, "5", "8"],    speed: [6, "2", "7"],   vpress: [4, "6", "8"],   deload: false },
  { label: "Week 10 — Strength",               main: [4, "4", "8.5"],  speed: [6, "2", "7"],   vpress: [4, "5", "8"],   deload: false },
  { label: "Week 11 — Strength",               main: [6, "3", "8.5"],  speed: [8, "2", "7"],   vpress: [5, "5", "8.5"], deload: false },
  { label: "Week 12 — Deload",                 main: [2, "5", "6"],    speed: [4, "2", "6"],   vpress: [3, "8", "6"],   deload: true },
  { label: "Week 13 — Peak",                   main: [4, "3", "8.5"],  speed: [6, "1", "7"],   vpress: [4, "4", "8.5"], deload: false },
  { label: "Week 14 — Peak",                   main: [3, "2", "9"],    speed: [5, "1", "7"],   vpress: [3, "4", "8.5"], deload: false },
  { label: "Week 15 — Taper",                  main: [2, "3", "7"],    speed: [3, "1", "6-7"], vpress: [2, "5", "7"],   deload: true, taper: true },
  { label: "Week 16 — Test Week",              main: [1, "5RM", "9-9.5"], speed: null,          vpress: [1, "6RM", "9"], deload: false, test: true },
];

function waveWeek(weekNum, scheme) {
  return {
    label: scheme.label,
    cadence: "5-on / 2-off",
    days: WAVE_DAYS.map((d, i) => {
      const exercises = d.exercises
        .map(e => {
          if (e.kind === "main")   return { ...e, sets: scheme.main[0],   reps: scheme.main[1],   rpe: scheme.main[2] };
          if (e.kind === "speed")  return scheme.speed ? { ...e, sets: scheme.speed[0], reps: scheme.speed[1], rpe: scheme.speed[2], tag: "speed" } : null;
          if (e.kind === "vpress") return { ...e, sets: scheme.vpress[0], reps: scheme.vpress[1], rpe: scheme.vpress[2] };
          // accessories: halve volume on deload/taper weeks, drop entirely on test week
          if (scheme.test) return null;
          if (scheme.deload) return { ...e, sets: 2 };
          return { ...e };
        })
        .filter(Boolean)
        .map(e => {
          const { kind, ...rest } = e;
          return { rpe: null, tag: null, cue: null, ...rest, alternates: ALTERNATES[rest.id] ?? [] };
        });
      return {
        id: `wave-w${weekNum}-d${i + 1}`,
        name: d.name,
        warmupDefault: d.warmupDefault,
        mobility: d.mobility,
        buckets: scheme.test ? null : (d.buckets ?? null),
        note: scheme.test ? "Test week: big numbers day — log the rep-max weights."
          : scheme.taper ? `Taper: minimal volume, stay sharp — test week is next.${d.note ? " " + d.note : ""}`
          : scheme.deload ? `Deload: keep it crisp, more reps in reserve.${d.note ? " " + d.note : ""}`
          : (d.note ?? null),
        exercises,
      };
    }),
    gateAfter: null,
  };
}

export const PROGRAM = {
  blocks: [
    {
      id: "reentry",
      name: "Re-Entry Protocol",
      weeks: [
        reentryWeek(1, 0, true,  "Week 1 — Phase 1 · 3-on/1-off", "3-on / 1-off"),
        reentryWeek(2, 0, true,  "Week 2 — Phase 1 · 3-on/1-off", "3-on / 1-off", {
          id: "gate-p1p2", title: "Phase gate: 1 → 2",
          criteria: "No new neck symptoms this block, and left/right load feels closer to matched. Next: 4-on/1-off.",
        }),
        reentryWeek(3, 1, false, "Week 3 — Phase 2 · 4-on/1-off", "4-on / 1-off"),
        reentryWeek(4, 1, false, "Week 4 — Phase 2 · 4-on/1-off", "4-on / 1-off", {
          id: "gate-p2wave", title: "Phase gate: re-entry complete",
          criteria: "No new neck symptoms, left/right matched. Check in with Maurice on wave placement, then enter the Royal Aesthetics Big Numbers wave (5-on/2-off).",
        }),
      ],
    },
    {
      id: "wave",
      name: "Big Numbers — RPE Wave",
      weeks: WAVE_SCHEME.map((s, i) => waveWeek(i + 1, s)),
    },
  ],
};

// Jeff starts at Week 2 Phase 1: flat index = 5 (week 1 has 5 days, no gate before week 2).
export const START_DAY_INDEX = 5;
