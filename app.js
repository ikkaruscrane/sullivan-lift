// app.js — rendering and events. Pure logic lives in lib.js; program content in program-data.js.
import {
  defaultState, validateState, flattenDays, entryAt,
  advance, logRest, finishSession, lastWeights, todayISO,
} from "./lib.js";
import {
  PROGRAM, WARMUP_MENU, CORE_MENU, STABILIZER_MENU, STACK, START_DAY_INDEX,
} from "./program-data.js";

const KEY = "lift.v1";
const FLAT = flattenDays(PROGRAM);

// ---- storage ----
let storageOk = true;
function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState(START_DAY_INDEX);
    const parsed = JSON.parse(raw);
    if (validateState(parsed).ok) return parsed;
    // Keep the unreadable blob rather than overwriting it — it may still hold recoverable history.
    localStorage.setItem(`${KEY}.corrupt`, raw);
    return defaultState(START_DAY_INDEX);
  } catch { storageOk = false; return defaultState(START_DAY_INDEX); }
}
function saveState() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); storageOk = true; }
  catch { storageOk = false; }
}
let state = loadState();

// ---- floors / router ----
const FLOORS = [
  { id: "today",    label: "TODAY",    num: "G" },
  { id: "history",  label: "HISTORY",  num: "2" },
  { id: "program",  label: "PROGRAM",  num: "3" },
  { id: "stack",    label: "STACK",    num: "4" },
  { id: "settings", label: "SETTINGS", num: "5" },
];
let currentFloor = "today";

// The one open inline set editor, if any: {group, idx, set, rpe}. Transient UI, never persisted.
let editing = null;

function goTo(floorId) {
  const from = FLOORS.findIndex(f => f.id === currentFloor);
  const to = FLOORS.findIndex(f => f.id === floorId);
  currentFloor = floorId;
  editing = null;
  render(to >= from ? "floor-enter" : "floor-enter-down");
}

function renderRail() {
  const rail = document.getElementById("rail");
  rail.innerHTML = "";
  for (const f of FLOORS) {
    const b = document.createElement("button");
    b.className = "lift-btn" + (f.id === currentFloor ? " active" : "");
    b.innerHTML = `<span class="num">${f.num}</span>${f.label}`;
    b.onclick = () => goTo(f.id);
    rail.appendChild(b);
  }
}

function setIndicator(text) {
  document.getElementById("floor-name").innerHTML = `<span class="arrow">▲</span>${text}`;
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Pre-fill reps for set s from a reps spec like "12", "8-10", "12/10/8/8", "10 /leg", "8 each", "5RM", "—".
function defaultReps(repsStr, s) {
  const cleaned = String(repsStr).replace(/\s*\/?\s*(leg|side|each)\s*$/i, "").trim();
  const parts = cleaned.split(/[/\-–—]/).map(p => parseInt(p, 10)).filter(n => !Number.isNaN(n));
  if (!parts.length) return "";
  return parts[Math.min(s, parts.length - 1)];
}

// ---- draft session (in-progress workout survives app close) ----
// Logged sets live in a fixed-length array where index === set number and an unlogged slot is `null`.
// Nulls are dropped when the session is finished, so history and lastWeights only ever see dense arrays.
function blankSets(n) { return Array(Math.max(0, n | 0)).fill(null); }

// Old drafts (or a changed program) may carry short/dense set arrays — pad to length, keep what's logged.
function padSets(sets, n) {
  const out = Array.isArray(sets) ? sets.slice(0, Math.max(0, n | 0)) : [];
  while (out.length < n) out.push(null);
  return out.map(s => s ?? null);
}

function ensureDraft(entry) {
  if (state.draft && state.draft.dayId === entry.day.id) {
    if (normalizeDraft(state.draft, entry)) saveState(); // persist the repair, don't redo it every render
    return state.draft;
  }
  // A draft for a different day is replaced without confirmation — every path that moves position either
  // finishes the session or explicitly clears the draft (Settings does too); this is the backstop.
  state.draft = {
    type: "workout", dayId: entry.day.id,
    warmup: { choice: entry.day.warmupDefault, done: false },
    hotel: state.hotelModeDefault,
    // Mirrors the hotel-toggle handler's swap-in below: a fresh draft under the hotel default
    // starts pre-swapped rather than showing "on" with home-gym exercises still listed.
    exercises: entry.day.exercises.map(ex => ({
      exerciseId: ex.id, swappedTo: state.hotelModeDefault && ex.alternates.length ? ex.alternates[0].id : null,
      skipped: false, sets: blankSets(ex.sets),
    })),
    core: [], stabilizers: [], note: "",
  };
  saveState();
  return state.draft;
}

// Repairs a reused draft in place against the current program. Returns true if anything changed,
// so the caller can persist the repair instead of redoing it on every render.
function normalizeDraft(draft, entry) {
  let changed = false;
  const fix = (obj, key, value) => { if (obj[key] === undefined || obj[key] === null) { obj[key] = value; changed = true; } };
  fix(draft, "warmup", { choice: entry.day.warmupDefault, done: false });
  fix(draft, "hotel", false);
  fix(draft, "note", "");
  for (const key of ["core", "stabilizers", "exercises"])
    if (!Array.isArray(draft[key])) { draft[key] = []; changed = true; }

  const repad = (holder, n) => {
    const padded = padSets(holder.sets, n);
    if (padded.length !== holder.sets?.length) changed = true;
    holder.sets = padded;
  };
  // Exercises are positional (index === the day's exercise index) — unlike core/stabilizers below,
  // which are id-matched selection lists — so rebuild by index rather than trusting whatever length
  // or shape survived (a short array, or garbage from a bad import). Every slot must end up a
  // well-formed object with the right length sets array; anything else is replaced, not patched.
  const origLen = draft.exercises.length;
  const rebuiltExercises = entry.day.exercises.map((ex, i) => {
    const e = draft.exercises[i];
    const wellFormed = typeof e === "object" && e !== null && (Array.isArray(e.sets) || e.sets === undefined);
    if (!wellFormed) {
      changed = true;
      return { exerciseId: ex.id, swappedTo: null, skipped: false, sets: blankSets(ex.sets) };
    }
    repad(e, ex.sets);
    return e;
  });
  if (rebuiltExercises.length !== origLen) changed = true;
  draft.exercises = rebuiltExercises;

  // Drop selections whose menu item no longer exists — they'd render nothing but still count toward FINISH.
  for (const kind of ["core", "stabilizers"]) {
    const menu = menuFor(kind);
    draft[kind] = draft[kind].flatMap(sel => {
      const m = menu.find(x => x.id === sel.exerciseId);
      if (!m) { changed = true; return []; }
      repad(sel, m.sets);
      return [sel];
    });
  }
  return changed;
}

function menuFor(kind) { return kind === "core" ? CORE_MENU : STABILIZER_MENU; }

// Menu items are shaped into the same record renderExercise takes for program exercises.
function menuExercise(m) {
  return { id: m.id, name: m.name, sets: m.sets, reps: m.reps, rpe: null, cue: m.cue, tag: null, alternates: [] };
}

// resolve display exercise (swap applied)
function resolvedExercise(ex, draftEx) {
  if (!draftEx.swappedTo) return ex;
  const alt = ex.alternates.find(a => a.id === draftEx.swappedTo);
  return alt ? { ...ex, name: alt.name, cue: alt.cue ?? ex.cue, tag: alt.requires === "db-only" ? "DB swap" : "cable swap" } : ex;
}

// ---- TODAY ----
function renderToday(root) {
  const entry = entryAt(FLAT, state.position.dayIndex);
  if (entry.kind === "gate") { renderGate(root, entry); return; }
  setIndicator(`TODAY — ${entry.day.name}`);
  const draft = ensureDraft(entry);

  root.appendChild(el(`<div class="card">
    <h1 class="section-title">${entry.day.name}</h1>
    <p class="section-sub">${entry.weekLabel} · ${entry.blockName} · ${entry.day.buckets ? `<span class="amber">${entry.day.buckets}</span> · ` : ""}<span class="dim">${cadenceLabel(entry)}</span></p>
    ${entry.day.note ? `<p class="section-sub amber">${entry.day.note}</p>` : ""}
    <div id="warmup-chips" class="chips"></div>
    <div class="chips" style="margin-top:8px">
      <button class="chip${draft.hotel ? " on" : ""}" data-act="hotel">HOTEL MODE</button>
    </div>
    <p class="section-sub" style="margin-top:10px"><b class="dim">Mobility:</b> ${entry.day.mobility}</p>
  </div>`));

  const warmupWrap = root.querySelector("#warmup-chips");
  for (const w of WARMUP_MENU) {
    const c = el(`<button class="chip${draft.warmup.choice === w.id && draft.warmup.done ? " on" : ""}" data-warmup="${w.id}">${w.label}</button>`);
    if (draft.warmup.choice === w.id && !draft.warmup.done) c.style.borderColor = "var(--steel-mid)";
    warmupWrap.appendChild(c);
  }

  const exCard = el(`<div class="card" id="ex-card"></div>`);
  root.appendChild(exCard);
  entry.day.exercises.forEach((ex, i) => exCard.appendChild(renderExercise(ex, draft.exercises[i], { group: "exercises", index: i })));

  root.appendChild(renderMenuBlock("CORE — every day", CORE_MENU, draft.core, "core"));
  root.appendChild(renderMenuBlock("STABILIZERS — optional", STABILIZER_MENU, draft.stabilizers, "stabilizers"));

  root.appendChild(el(`<div class="card">
    <textarea class="note-input" id="workout-note" placeholder="Notes (optional)">${esc(draft.note ?? "")}</textarea>
    <div class="action-row">
      <button class="btn-big" id="btn-rest">REST DAY</button>
      <button class="btn-big primary" id="btn-finish">FINISH</button>
    </div>
  </div>`));

  // Saved without a re-render: re-rendering the textarea would drop focus mid-sentence.
  root.querySelector("#workout-note").addEventListener("input", e => {
    draft.note = e.target.value;
    saveState();
    if (!storageOk) render(); // losing focus beats typing into a note that isn't being saved
  });

  // Core is the non-negotiable close-out — the session isn't finishable until at least one core set is
  // logged. Skipped entries keep their sets (so unskip restores them) but contribute nothing here either.
  root.querySelector("#btn-finish").disabled =
    !draft.core.some(c => !c.skipped && c.sets.some(s => s != null));
}

function cadenceLabel(entry) {
  const week = findWeek(entry.day.id);
  return week?.cadence ?? "";
}
function findWeek(dayId) {
  for (const block of PROGRAM.blocks)
    for (const week of block.weeks)
      if (week.days.some(d => d.id === dayId)) return week;
  return null;
}

// Renders one exercise with set rows. ref = {group: "exercises"|"core"|"stabilizers", index}
function renderExercise(ex, draftEx, ref) {
  const shown = resolvedExercise(ex, draftEx);
  const last = lastWeights(state.sessions, ex.id);
  const wrap = el(`<div class="ex${draftEx.skipped ? " skipped" : ""}" data-group="${ref.group}" data-idx="${ref.index}">
    <div class="ex-head">
      <div class="ex-name">${shown.name}${shown.tag ? `<span class="ex-tag">${shown.tag}</span>` : ""}</div>
      <div class="ex-target">${ex.sets}×${ex.reps}${ex.rpe ? ` @${ex.rpe}` : ""}</div>
    </div>
    ${shown.cue ? `<div class="ex-cue">${shown.cue}</div>` : ""}
    <div class="sets"></div>
    <div class="ex-controls">
      <button data-act="skip"${draftEx.skipped ? ' class="lit"' : ""}>${draftEx.skipped ? "unskip" : "skip"}</button>
      ${ex.alternates.length ? `<button data-act="swap"${draftEx.swappedTo ? ' class="lit"' : ""}>swap</button>` : ""}
    </div>
  </div>`);
  const setsEl = wrap.querySelector(".sets");
  if (!draftEx.skipped) {
    for (let s = 0; s < ex.sets; s++) setsEl.appendChild(renderSetRow(ex, draftEx, ref, s, last));
  }
  return wrap;
}

// What a row shows before it's logged, and what a plain row tap logs.
function setDefaults(ex, draftEx, s, last = lastWeights(state.sessions, ex.id)) {
  const done = draftEx.sets[s];
  return {
    reps: done?.reps ?? defaultReps(ex.reps, s),
    weight: done?.weight ?? draftEx.sets[s - 1]?.weight ?? last[s] ?? last[last.length - 1] ?? "",
  };
}

const RPE_SCALE = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

function renderSetRow(ex, draftEx, ref, s, last) {
  const done = draftEx.sets[s] ?? null;
  const def = setDefaults(ex, draftEx, s, last);

  if (isEditingRow(ref.group, ref.index, s)) {
    return el(`<div class="set-row" data-set="${s}">
      <span class="setnum">${s + 1}</span>
      <span class="vals editing">
        <input type="number" inputmode="decimal" data-edit="reps" value="${esc(def.reps)}" placeholder="reps" aria-label="reps">
        <input type="number" inputmode="decimal" data-edit="weight" value="${esc(def.weight)}" placeholder="lb" aria-label="weight">
        <button class="logset-btn" data-act="logset" aria-label="log set">✓</button>
        <span class="rpe-row">
          ${RPE_SCALE.map(v => `<button class="chip rpe-chip${editing.rpe === v ? " on" : ""}" data-rpe="${v}">${v}</button>`).join("")}
        </span>
      </span>
    </div>`);
  }

  // A logged row shows what was stored, em-dash included — never a default dressed up as a recorded value.
  return el(`<div class="set-row${done ? " done" : ""}" data-set="${s}">
    <span class="setnum">${s + 1}</span>
    <span class="vals">
      <span data-field="reps">${esc(done ? done.reps ?? "—" : def.reps)}<span class="unit"> reps</span></span>
      <span data-field="weight">${esc(done ? done.weight ?? "—" : def.weight)}<span class="unit"> lb</span></span>
      ${done?.rpe ? `<span data-field="rpe">@${esc(done.rpe)}</span>` : ""}
    </span>
    <span class="mark">${done ? "●" : "○"}</span>
  </div>`);
}

function renderMenuBlock(title, menu, selections, kind) {
  const card = el(`<div class="card" data-menu="${kind}">
    <h1 class="section-title" style="font-size:17px">${title}</h1>
    <div class="chips"></div><div class="picked"></div>
  </div>`);
  const chips = card.querySelector(".chips");
  for (const m of menu) {
    const on = selections.some(s => s.exerciseId === m.id);
    chips.appendChild(el(`<button class="chip${on ? " on" : ""}" data-id="${m.id}">${m.name}</button>`));
  }
  const picked = card.querySelector(".picked");
  selections.forEach((sel, i) => {
    const m = menu.find(x => x.id === sel.exerciseId);
    if (m) picked.appendChild(renderExercise(menuExercise(m), sel, { group: kind, index: i }));
  });
  return card;
}

function renderGate(root, entry) {
  setIndicator("CHECKPOINT");
  root.appendChild(el(`<div class="card gate-card">
    <h1 class="section-title amber">${entry.gate.title}</h1>
    <p class="section-sub">${entry.gate.criteria}</p>
    <div class="action-row"><button class="btn-big primary" id="btn-gate">I'M CLEAR — CONTINUE</button></div>
    <p class="section-sub dim">Not there yet? Stay on this checkpoint and keep training by feel; Settings can move you back a week.</p>
  </div>`));
}

// ---- HISTORY ----
function renderHistory(root) {
  setIndicator("HISTORY");
  if (!state.sessions.length) {
    root.appendChild(el(`<div class="card"><p class="section-sub">Nothing logged yet. Ground floor is waiting.</p></div>`));
    return;
  }
  const card = el(`<div class="card"></div>`);
  root.appendChild(card);
  [...state.sessions].reverse().forEach((s) => {
    if (s.type === "rest") {
      card.appendChild(el(`<div class="hist-item dim"><span class="mono">${esc(s.date)}</span> · Rest day</div>`));
      return;
    }
    const entry = FLAT.find(e => e.kind === "day" && e.day.id === s.dayId);
    const dayName = entry ? entry.day.name : s.dayId;
    const setCount = [...(s.exercises ?? []), ...(s.core ?? []), ...(s.stabilizers ?? [])]
      .reduce((n, e) => n + (e.sets?.length ?? 0), 0);
    const skipped = (s.exercises ?? []).filter(e => e.skipped).length;
    const item = el(`<div class="hist-item">
      <div class="ex-head"><div class="ex-name">${esc(dayName)}</div><div class="ex-target">${esc(s.date)}</div></div>
      <div class="ex-cue">${setCount} sets${skipped ? ` · ${skipped} skipped` : ""}${s.hotel ? " · hotel" : ""}${s.note ? ` · “${esc(s.note.slice(0, 60))}”` : ""}</div>
      <div class="hist-detail" hidden></div>
    </div>`);
    // Recreated on every render() call, so a plain onclick needs no dedup — unlike the one
    // delegated listener on #floor, which is attached once at module init (see below).
    item.onclick = () => {
      const d = item.querySelector(".hist-detail");
      if (!d.hidden) { d.hidden = true; return; }
      d.innerHTML = sessionDetailHTML(s, entry);
      d.hidden = false;
    };
    card.appendChild(item);
  });
}

// exId/note text is user- or program-sourced and always escaped before it reaches innerHTML.
function sessionDetailHTML(s, entry) {
  const lines = [];
  const nameFor = (exId, swappedTo) => {
    const progEx = entry?.day.exercises.find(e => e.id === exId);
    const menu = [...CORE_MENU, ...STABILIZER_MENU].find(m => m.id === exId);
    let name = progEx?.name ?? menu?.name ?? exId;
    if (swappedTo && progEx) name = progEx.alternates.find(a => a.id === swappedTo)?.name ?? name;
    return name;
  };
  for (const [label, grp] of [["", s.exercises], ["Core", s.core], ["Stabilizers", s.stabilizers]]) {
    if (!grp?.length) continue;
    if (label) lines.push(`<div class="ex-tag" style="margin-top:8px">${label}</div>`);
    for (const e of grp) {
      const sets = e.skipped ? "skipped"
        : esc((e.sets ?? []).map(x => `${x.reps ?? "—"}×${x.weight ?? "—"}${x.rpe ? `@${x.rpe}` : ""}`).join("  ") || "—");
      lines.push(`<div class="ex-cue"><b>${esc(nameFor(e.exerciseId, e.swappedTo))}</b> <span class="mono">${sets}</span></div>`);
    }
  }
  if (s.note) lines.push(`<div class="ex-cue" style="margin-top:8px">“${esc(s.note)}”</div>`);
  return lines.join("");
}

// ---- PROGRAM ----
// Browse-only: the whole plan, collapsed to block/week headers with expandable day detail. Never
// touches state.draft or state.sessions — only reads state.position.dayIndex, to mark "you are here".
function renderProgram(root) {
  setIndicator("PROGRAM");
  let idx = 0;
  for (const block of PROGRAM.blocks) {
    root.appendChild(el(`<div class="card" style="padding:12px 16px"><h1 class="section-title">${esc(block.name)}</h1></div>`));
    for (const week of block.weeks) {
      const startIdx = idx;
      const isCurrentWeek = state.position.dayIndex >= idx && state.position.dayIndex < idx + week.days.length;
      idx += week.days.length;
      const card = el(`<div class="card" style="padding:12px 16px">
        <div class="ex-head" style="cursor:pointer">
          <div class="ex-name${isCurrentWeek ? " amber" : ""}">${esc(week.label)}</div>
          <div class="ex-target dim">${esc(week.cadence)}</div>
        </div>
        <div class="wk-detail" hidden></div>
      </div>`);
      // Recreated on every render() call, so a plain onclick needs no dedup — same pattern as
      // the HISTORY floor's row toggles. Program is browse-only, so nothing here calls commit().
      card.querySelector(".ex-head").onclick = () => {
        const d = card.querySelector(".wk-detail");
        if (!d.hidden) { d.hidden = true; return; }
        d.innerHTML = week.days.map((day, di) => `
          <div class="ex" style="padding:10px 0">
            <div class="ex-name${startIdx + di === state.position.dayIndex ? " amber" : ""}">${esc(day.name)}${day.buckets ? ` <span class="ex-tag">${esc(day.buckets)}</span>` : ""}</div>
            ${day.exercises.map(e => `<div class="ex-cue">${esc(e.name)} <span class="mono">${e.sets}×${esc(e.reps)}${e.rpe ? ` @${esc(e.rpe)}` : ""}</span></div>`).join("")}
          </div>`).join("");
        d.hidden = false;
      };
      root.appendChild(card);
      if (week.gateAfter) {
        const gateIdx = idx; idx += 1;
        // Bright amber only when the pointer sits on this checkpoint; dim otherwise (".amber" and
        // ".dim" both just set text color, so they're mutually exclusive rather than combined).
        root.appendChild(el(`<div class="card gate-card" style="padding:10px 16px">
          <div class="ex-name${gateIdx === state.position.dayIndex ? " amber" : " dim"}">◆ ${esc(week.gateAfter.title)}</div>
        </div>`));
      }
    }
  }
}

function renderStack(root) {
  setIndicator("STACK");
  for (const sec of STACK) {
    const card = el(`<div class="card">
      <h1 class="section-title">${esc(sec.section)}</h1>
      <p class="section-sub amber">${esc(sec.timing)}</p>
    </div>`);
    for (const item of sec.items) {
      card.appendChild(el(`<div class="ex">
        <div class="ex-head"><div class="ex-name">${esc(item.name)}</div><div class="ex-target">${esc(item.detail)}</div></div>
        <div class="ex-cue"><span class="mono amber">${esc(item.facts)}</span></div>
        <div class="ex-cue">${esc(item.blurb)}</div>
      </div>`));
    }
    root.appendChild(card);
  }
}
function renderSettings(root) {
  setIndicator("SETTINGS");
  const entry = entryAt(FLAT, state.position.dayIndex);
  const card = el(`<div class="card">
    <h1 class="section-title">Position</h1>
    <p class="section-sub">Now: ${entry.kind === "gate" ? esc(entry.gate.title) : `${esc(entry.weekLabel)} · ${esc(entry.day.name)}`}</p>
    <select id="pos-day" style="width:100%;padding:12px;background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--steel-border);border-radius:8px;font-family:var(--font-ui);font-size:16px"></select>
    <div class="action-row"><button class="btn-big" id="btn-setpos">SET POSITION</button></div>
  </div>`);
  const sel = card.querySelector("#pos-day");
  FLAT.forEach((e, i) => {
    const label = e.kind === "gate" ? `◆ ${e.gate.title}` : `${e.weekLabel} — ${e.day.name}`;
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = label; // textContent, not innerHTML — no escaping needed
    if (i === state.position.dayIndex) opt.selected = true;
    sel.appendChild(opt);
  });
  card.querySelector("#btn-setpos").onclick = () => {
    const hasWork = state.draft && (
      state.draft.exercises.some(e => e.sets?.some(s => s != null)) ||
      state.draft.core.some(c => c.sets?.some(s => s != null)) ||
      state.draft.stabilizers.some(c => c.sets?.some(s => s != null)));
    if (hasWork && !confirm("Discard the sets you've logged for the current workout?")) return;
    state.position.dayIndex = Number(sel.value);
    state.draft = null;   // deliberate: position change discards any in-progress draft
    saveState(); goTo("today");
  };
  root.appendChild(card);

  const misc = el(`<div class="card">
    <h1 class="section-title">Data</h1>
    <div class="chips" style="margin-bottom:12px">
      <button class="chip${state.hotelModeDefault ? " on" : ""}" id="hotel-default">Hotel mode default: ${state.hotelModeDefault ? "ON" : "OFF"}</button>
    </div>
    <div class="action-row">
      <button class="btn-big" id="btn-export">EXPORT</button>
      <button class="btn-big" id="btn-import">IMPORT</button>
    </div>
    <div class="action-row"><button class="btn-big" id="btn-reset" style="color:#c66">RESET ALL</button></div>
    <input type="file" id="import-file" accept="application/json" hidden>
  </div>`);
  misc.querySelector("#hotel-default").onclick = () => { state.hotelModeDefault = !state.hotelModeDefault; saveState(); render(); };
  misc.querySelector("#btn-export").onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob), download: `the-lift-backup-${todayISO()}.json`,
    });
    a.click(); URL.revokeObjectURL(a.href);
  };
  misc.querySelector("#btn-import").onclick = () => misc.querySelector("#import-file").click();
  misc.querySelector("#import-file").onchange = async (ev) => {
    const file = ev.target.files[0]; if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const v = validateState(parsed);
      if (!v.ok) { alert(`Import rejected: ${v.error}`); return; }
      if (confirm(`Replace current data with this backup? (${parsed.sessions.length} sessions)`)) {
        state = parsed; saveState(); render();
      }
    } catch { alert("Import rejected: not valid JSON."); }
  };
  misc.querySelector("#btn-reset").onclick = () => {
    if (confirm("Erase all logged data and reset position?") && confirm("Really sure? Export first if in doubt.")) {
      state = defaultState(START_DAY_INDEX); saveState(); render();
    }
  };
  root.appendChild(misc);
}

// ---- render loop ----
function render(animClass = "floor-enter") {
  const root = document.getElementById("floor");
  root.innerHTML = "";
  root.className = animClass;
  ({ today: renderToday, history: renderHistory, program: renderProgram,
     stack: renderStack, settings: renderSettings })[currentFloor](root);
  // Checked after the floor dispatch (not before) so a save failure during e.g. renderToday's
  // ensureDraft still surfaces the banner on this same render.
  if (!storageOk) root.prepend(el(`<div class="banner-warn">Storage unavailable — logging won't persist. Free up space or check browser settings.</div>`));
  renderRail();
}
render();

// ---- events ----
// ONE delegated click listener, attached at module init — never inside render(), which runs per
// navigation and would stack duplicates. Per-render listeners exist only for the note textarea.
document.getElementById("floor").addEventListener("click", onFloorClick);

function commit() { editing = null; saveState(); render(); }

function currentEntry() { return entryAt(FLAT, state.position.dayIndex); }

function draftListFor(draft, group) {
  return group === "exercises" ? draft.exercises : group === "core" ? draft.core : draft.stabilizers;
}

// The program record behind a draft entry: the day's exercise for the main list, the menu item otherwise.
function programExerciseFor(group, idx, dEx) {
  if (group === "exercises") {
    const entry = currentEntry();
    return entry.kind === "day" ? entry.day.exercises[idx] ?? null : null;
  }
  const m = menuFor(group).find(x => x.id === dEx.exerciseId);
  return m ? menuExercise(m) : null;
}

function isEditingRow(group, idx, s) {
  return !!editing && editing.group === group && editing.idx === idx && editing.set === s;
}

// "" / null / unparseable / negative -> null, so an untouched or nonsense field is stored as
// "not recorded" rather than 0, NaN, or a negative weight.
function num(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = parseFloat(v);
  return Number.isNaN(n) || n < 0 ? null : n;
}

// One listener, routed by floor the same way render() dispatches. Floors 10–13 register theirs here.
const CLICK_HANDLERS = { today: onTodayClick };

function onFloorClick(ev) {
  const t = ev.target instanceof Element ? ev.target : null;
  if (t) CLICK_HANDLERS[currentFloor]?.(t);
}

function onTodayClick(t) {
  if (t.closest("#btn-gate"))   { advance(state); commit(); return; }
  if (t.closest("#btn-rest"))   { onRest(); return; }
  if (t.closest("#btn-finish")) { onFinish(); return; }

  const draft = state.draft;
  if (!draft) return;

  // RPE picker: DOM-only so the reps/weight already typed into the open editor survive.
  const rpeBtn = t.closest("[data-rpe]");
  if (rpeBtn) {
    if (!editing) return; // chips only exist inside an open editor; never fall through to the row handler
    const v = parseFloat(rpeBtn.dataset.rpe);
    editing.rpe = editing.rpe === v ? null : v;
    for (const b of rpeBtn.parentElement.querySelectorAll("[data-rpe]"))
      b.classList.toggle("on", parseFloat(b.dataset.rpe) === editing.rpe);
    return;
  }

  const warm = t.closest("[data-warmup]");
  if (warm) {
    const id = warm.dataset.warmup;
    const lit = draft.warmup.choice === id && draft.warmup.done;
    draft.warmup = { choice: id, done: !lit };
    commit();
    return;
  }

  if (t.closest('[data-act="hotel"]')) {
    draft.hotel = !draft.hotel;
    // Bulk swap to the first (DB-only) alternate; per-exercise taps refine from there.
    const entry = currentEntry();
    if (entry.kind === "day") entry.day.exercises.forEach((ex, i) => {
      const d = draft.exercises[i];
      if (d) d.swappedTo = draft.hotel && ex.alternates.length ? ex.alternates[0].id : null;
    });
    commit();
    return;
  }

  const chip = t.closest("[data-id]");
  const menuCard = chip?.closest("[data-menu]");
  if (chip && menuCard) { toggleMenuItem(draft, menuCard.dataset.menu, chip.dataset.id); return; }

  const exEl = t.closest("[data-group]");
  if (!exEl) return;
  const group = exEl.dataset.group;
  const idx = Number(exEl.dataset.idx);
  const dEx = draftListFor(draft, group)?.[idx];
  if (!dEx) return;
  const progEx = programExerciseFor(group, idx, dEx);
  if (!progEx) return;

  const act = t.closest("[data-act]")?.dataset.act;
  if (act === "skip") {
    // Sets are kept, not cleared: the rows are only hidden, so unskipping restores what was logged.
    // A skipped exercise contributes no sets to the finished session — see compactSets.
    dEx.skipped = !dEx.skipped;
    commit();
    return;
  }
  if (act === "swap") {
    const alts = progEx.alternates ?? [];
    const next = alts[alts.findIndex(a => a.id === dEx.swappedTo) + 1]; // -1 + 1 === 0 when unswapped
    dEx.swappedTo = next ? next.id : null;
    commit();
    return;
  }

  const row = t.closest(".set-row");
  if (!row) return;
  const s = Number(row.dataset.set);

  if (act === "logset") {
    const reps = num(row.querySelector('[data-edit="reps"]')?.value);
    const weight = num(row.querySelector('[data-edit="weight"]')?.value);
    if (reps === null && weight === null) return; // nothing to record — leave the editor open
    dEx.sets[s] = { reps, weight, rpe: editing?.rpe ?? null };
    commit();
    return;
  }
  if (isEditingRow(group, idx, s)) return; // taps on the open editor's own chrome do nothing

  if (dEx.sets[s]) { dEx.sets[s] = null; commit(); return; }        // un-log (also the fix-a-value path)
  if (t.closest("[data-field]")) { editing = { group, idx, set: s, rpe: null }; render(); return; }

  const def = setDefaults(progEx, dEx, s);
  dEx.sets[s] = { reps: num(def.reps), weight: num(def.weight), rpe: null };
  commit();
}

function toggleMenuItem(draft, kind, id) {
  const list = draft[kind];
  const at = list.findIndex(sel => sel.exerciseId === id);
  if (at >= 0) list.splice(at, 1); // deselecting discards logged sets — the tap is explicit enough
  else {
    const m = menuFor(kind).find(x => x.id === id);
    if (!m) return;
    list.push({ exerciseId: id, sets: blankSets(m.sets) });
  }
  commit();
}

function onRest() {
  if (!confirm("Log a rest day? Today's workout stays queued for tomorrow.")) return;
  logRest(state, todayISO());
  commit(); // position is unchanged, so the same day — and its draft — comes back
}

// Nulls are the unlogged slots; history only ever stores what actually happened. A skipped exercise
// contributes nothing even if sets were logged before it was skipped — the draft keeps them for unskip.
function compactSets(list) {
  return list.map(e => ({ ...e, sets: e.skipped ? [] : e.sets.filter(s => s != null) }));
}

function onFinish() {
  const draft = state.draft;
  if (!draft) return;
  finishSession(state, {
    date: todayISO(), type: "workout", dayId: draft.dayId,
    warmup: draft.warmup, hotel: draft.hotel, note: draft.note,
    exercises: compactSets(draft.exercises),
    core: compactSets(draft.core),
    stabilizers: compactSets(draft.stabilizers),
  });
  commit();
}

// Skipped on localhost so local dev never serves stale cached files.
if ("serviceWorker" in navigator
    && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
