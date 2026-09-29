"""End-to-end browser test for the TODAY logging flow.

Run: python3 tests/browser/test_lift.py
  (needs `pip install playwright` and the sandbox disabled; uses the cached chromium)

Serves the repo on a free localhost port, drives it with Playwright, and prints PASS/FAIL per
assertion. Exits non-zero if any assertion fails. Proxy bypass is explicit in both the readiness
probe and the browser launch, because BCG's proxy otherwise swallows localhost traffic.
"""

import json
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS  " if cond else "FAIL  ") + name + (("  -- " + str(detail)) if detail and not cond else ""))


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def launch_chromium(pw):
    """Prefer the pinned build; fall back to any chromium in the shared cache, then to Chrome."""
    args = ["--no-proxy-server"]
    try:
        if Path(pw.chromium.executable_path).exists():
            return pw.chromium.launch(args=args)
    except Exception:
        pass
    for cache in (Path.home() / "Library/Caches/ms-playwright", Path.home() / ".cache/ms-playwright"):
        for pat in ("chromium-*/chrome-*/*.app/Contents/MacOS/*", "chromium-*/chrome-*/chrome"):
            for exe in sorted(cache.glob(pat), reverse=True):
                if exe.is_file():
                    return pw.chromium.launch(executable_path=str(exe), args=args)
    return pw.chromium.launch(channel="chrome", args=args)


PORT = free_port()
URL = f"http://127.0.0.1:{PORT}/index.html"
srv = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
    cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)
time.sleep(1.2)

try:
    with sync_playwright() as p:
        noproxy = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        noproxy.open(URL, timeout=5).read(200)  # server is up before the browser starts

        browser = launch_chromium(p)
        page = browser.new_page(viewport={"width": 430, "height": 900})
        errors = []
        dialog_messages = []
        dialog_mode = {"accept": True}  # flip to False around a confirm() the test wants dismissed

        def on_dialog(d):
            dialog_messages.append(d.message)
            d.accept() if dialog_mode["accept"] else d.dismiss()

        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("dialog", on_dialog)
        page.goto(URL)
        page.wait_for_selector('.ex[data-group="exercises"][data-idx="0"]')

        def st():
            return json.loads(page.evaluate("localStorage.getItem('lift.v1')"))

        def draft():
            return st()["draft"]

        EX0 = '.ex[data-group="exercises"][data-idx="0"]'   # Bench Press, 4 sets, 1 alternate
        EX1 = '.ex[data-group="exercises"][data-idx="1"]'   # Incline DB Press, 3 sets
        EX3 = '.ex[data-group="exercises"][data-idx="3"]'   # Cable Face Pull, 2 alternates

        def row(ex, s):
            return f'{ex} .set-row[data-set="{s}"]'

        def cls(sel):
            return page.locator(sel).get_attribute("class") or ""

        check("header starts on Push", "Push" in page.inner_text("#floor-name"), page.inner_text("#floor-name"))
        check("bench press is exercise 0", page.inner_text(EX0 + " .ex-name").startswith("Bench Press"),
              page.inner_text(EX0 + " .ex-name"))

        # (a) tap the row body -> logged with the displayed defaults
        page.click(row(EX0, 0) + " .mark")
        s = draft()["exercises"][0]["sets"]
        check("(a) row gains .done", "done" in cls(row(EX0, 0)))
        check("(a) sets[0] non-null in localStorage", s[0] is not None, s)
        check("(a) sets is a fixed-length 4 array with null holes", len(s) == 4 and s[1] is None, s)

        # (b) tap again -> un-logged
        page.click(row(EX0, 0) + " .mark")
        check("(b) un-log clears .done", "done" not in cls(row(EX0, 0)))
        check("(b) sets[0] back to null", draft()["exercises"][0]["sets"][0] is None)

        # (c) value-span tap opens the editor; 10 reps / 95 lb / RPE 8
        page.click(row(EX0, 0) + ' [data-field="reps"]')
        check("(c) editor inputs visible", page.locator(row(EX0, 0) + ' input[data-edit="reps"]').is_visible()
              and page.locator(row(EX0, 0) + ' input[data-edit="weight"]').is_visible())
        check("(c) rpe chip row rendered (9 chips)", page.locator(row(EX0, 0) + " [data-rpe]").count() == 9,
              page.locator(row(EX0, 0) + " [data-rpe]").count())
        page.fill(row(EX0, 0) + ' input[data-edit="reps"]', "10")
        page.fill(row(EX0, 0) + ' input[data-edit="weight"]', "95")
        page.click(row(EX0, 0) + ' [data-rpe="8"]')
        check("(c) rpe chip lights", "on" in cls(row(EX0, 0) + ' [data-rpe="8"]'))
        check("(c) typed values survive the rpe tap",
              page.input_value(row(EX0, 0) + ' input[data-edit="reps"]') == "10")
        page.click(row(EX0, 0) + ' [data-act="logset"]')
        check("(c) editor logs exact values", draft()["exercises"][0]["sets"][0] == {"reps": 10, "weight": 95, "rpe": 8},
              draft()["exercises"][0]["sets"][0])
        check("(c) editor closed after log", page.locator(row(EX0, 0) + ' input[data-edit="reps"]').count() == 0)

        # (c2) steppers + select-on-focus, on a row whose prefill is known: reps from the program
        # ("12"), weight carried forward from the set logged just above it (95).
        def step(s, field, direction):
            return row(EX0, s) + f' .step-btn[data-step-field="{field}"][data-step="{direction}"]'

        def edit(s, field):
            return row(EX0, s) + f' input[data-edit="{field}"]'

        page.click(row(EX0, 1) + ' [data-field="reps"]')
        check("(c2) editor prefills reps from the program and weight from the set above",
              page.input_value(edit(1, "reps")) == "12" and page.input_value(edit(1, "weight")) == "95",
              (page.input_value(edit(1, "reps")), page.input_value(edit(1, "weight"))))
        check("(c2) each field is flanked by a − and a + button",
              page.locator(row(EX0, 1) + " .step-btn").count() == 4,
              page.locator(row(EX0, 1) + " .step-btn").count())

        # select-on-focus: focusing a prefilled field selects all of it, so typing replaces it
        page.focus(edit(1, "weight"))
        page.wait_for_timeout(120)  # select() is deferred a frame (iOS Safari needs that)
        sel = page.eval_on_selector(edit(1, "weight"),
                                    "el => [el.selectionStart, el.selectionEnd, el.value.length]")
        check("(c2) focusing a field selects its whole value",
              sel[0] == 0 and sel[1] == sel[2] and sel[2] > 0, sel)

        # one tap === exactly one step
        page.click(step(1, "weight", "1"))
        check("(c2) one tap on + steps weight by 5", page.input_value(edit(1, "weight")) == "100",
              page.input_value(edit(1, "weight")))
        page.click(step(1, "weight", "1"))
        check("(c2) taps accumulate one step each", page.input_value(edit(1, "weight")) == "105",
              page.input_value(edit(1, "weight")))
        page.click(step(1, "reps", "-1"))
        check("(c2) one tap on − steps reps by 1", page.input_value(edit(1, "reps")) == "11",
              page.input_value(edit(1, "reps")))

        # press-and-hold auto-repeats after ~400ms, then every ~120ms. Timing assertion is
        # deliberately loose — a 1s hold is worth ~6 steps; anything past 3 proves the repeat ran.
        plus = page.locator(step(1, "reps", "1"))
        box = plus.bounding_box()
        before_hold = float(page.input_value(edit(1, "reps")))
        page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        page.mouse.down()
        page.wait_for_timeout(1000)
        page.mouse.up()
        after_hold = float(page.input_value(edit(1, "reps")))
        check("(c2) press-and-hold auto-repeats the step", after_hold - before_hold >= 3,
              (before_hold, after_hold))

        page.fill(edit(1, "reps"), "11")
        page.click(row(EX0, 1) + ' [data-act="logset"]')
        check("(c2) ✓ stores exactly the stepped values",
              draft()["exercises"][0]["sets"][1] == {"reps": 11, "weight": 105, "rpe": None},
              draft()["exercises"][0]["sets"][1])
        page.click(row(EX0, 1) + " .mark")  # un-log, so the empty-✓ case below starts clean
        check("(c2) stepped row un-logs back to null", draft()["exercises"][0]["sets"][1] is None)

        # the reps floor is 0, and 0 reps means "not recorded" rather than a set of zero reps
        page.click(row(EX0, 2) + ' [data-field="reps"]')
        page.fill(edit(2, "reps"), "1")
        page.click(step(2, "reps", "-1"))
        page.click(step(2, "reps", "-1"))
        check("(c2) reps floor at 0 and never go negative", page.input_value(edit(2, "reps")) == "0",
              page.input_value(edit(2, "reps")))
        page.fill(edit(2, "weight"), "45")
        page.click(row(EX0, 2) + ' [data-act="logset"]')
        check("(c2) reps stepped down to 0 store as null, not 0",
              draft()["exercises"][0]["sets"][2] == {"reps": None, "weight": 45, "rpe": None},
              draft()["exercises"][0]["sets"][2])
        page.click(row(EX0, 2) + " .mark")  # un-log again

        # (c2) a re-render mid-hold detaches the button and the input under it — the repeat must
        # stop rather than tick forever against a node that is no longer in the document.
        page.click(row(EX0, 1) + ' [data-field="reps"]')
        page.eval_on_selector(edit(1, "reps"), "el => { window.__held = el; }")
        plus = page.locator(step(1, "reps", "1"))
        box = plus.bounding_box()
        page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        page.mouse.down()
        page.wait_for_timeout(700)  # past HOLD_MS, repeat is running
        page.evaluate("document.querySelector('#rail .lift-btn:nth-child(2)').click()")  # -> HISTORY
        page.wait_for_timeout(400)  # long enough for the guard to fire on the next tick
        detached = page.evaluate("window.__held.value")
        page.wait_for_timeout(500)
        check("(c2) hold-repeat stops when a re-render detaches the button",
              page.evaluate("window.__held.value") == detached,
              (detached, page.evaluate("window.__held.value")))
        page.mouse.up()
        check("(c2) the detached input is really off the page",
              page.evaluate("window.__held.isConnected") is False)
        page.evaluate("delete window.__held")
        page.click("#rail .lift-btn:nth-child(1)")  # back to TODAY
        page.wait_for_selector(EX0)
        check("(c2) an interrupted hold logged nothing", draft()["exercises"][0]["sets"][1] is None,
              draft()["exercises"][0]["sets"][1])

        # (ii) ✓ with both fields cleared must not log, and must leave the editor open
        page.click(row(EX0, 1) + ' [data-field="reps"]')
        page.fill(row(EX0, 1) + ' input[data-edit="reps"]', "")
        page.fill(row(EX0, 1) + ' input[data-edit="weight"]', "")
        page.click(row(EX0, 1) + ' [data-act="logset"]')
        check("(ii) empty ✓ does not log the set", draft()["exercises"][0]["sets"][1] is None,
              draft()["exercises"][0]["sets"][1])
        check("(ii) empty ✓ leaves the editor open",
              page.locator(row(EX0, 1) + ' input[data-edit="reps"]').count() == 1)

        # only one editor at a time (opening row 2 closes row 1)
        page.click(row(EX0, 2) + ' [data-field="reps"]')
        check("only one editor open at a time", page.locator(EX0 + ' input[data-edit="reps"]').count() == 1,
              page.locator(EX0 + ' input[data-edit="reps"]').count())

        # (iii) reps-only log stores weight null and displays an em-dash, not a default
        page.click(row(EX0, 1) + ' [data-field="reps"]')
        page.fill(row(EX0, 1) + ' input[data-edit="reps"]', "8")
        page.fill(row(EX0, 1) + ' input[data-edit="weight"]', "")
        page.click(row(EX0, 1) + ' [data-act="logset"]')
        check("(iii) reps-only log stores weight null",
              draft()["exercises"][0]["sets"][1] == {"reps": 8, "weight": None, "rpe": None},
              draft()["exercises"][0]["sets"][1])
        check("(iii) missing weight displays an em-dash, not a default",
              page.text_content(row(EX0, 1) + ' [data-field="weight"]').strip().startswith("—"),
              page.text_content(row(EX0, 1) + ' [data-field="weight"]'))
        # negative weight clamps to null rather than storing a negative
        page.click(row(EX0, 3) + ' [data-field="weight"]')
        page.fill(row(EX0, 3) + ' input[data-edit="reps"]', "5")
        page.fill(row(EX0, 3) + ' input[data-edit="weight"]', "-20")
        page.click(row(EX0, 3) + ' [data-act="logset"]')
        check("negative weight clamps to null",
              draft()["exercises"][0]["sets"][3] == {"reps": 5, "weight": None, "rpe": None},
              draft()["exercises"][0]["sets"][3])
        page.click(row(EX0, 3) + " .mark")  # un-log it again

        # (i) skip must not destroy logged sets
        before = draft()["exercises"][0]["sets"]
        check("(i) two sets logged before skip", before[0] is not None and before[1] is not None, before)
        page.click(EX0 + ' [data-act="skip"]')
        check("(d) skip greys the exercise", "skipped" in cls(EX0))
        check("(d) skip removes the set rows", page.locator(EX0 + " .set-row").count() == 0)
        check("(i) skip keeps the logged sets in the draft", draft()["exercises"][0]["sets"] == before,
              draft()["exercises"][0]["sets"])
        page.click(EX0 + ' [data-act="skip"]')  # unskip
        check("(i) unskip restores the rows", page.locator(EX0 + " .set-row").count() == 4)
        check("(i) unskip shows the sets still logged",
              "done" in cls(row(EX0, 0)) and "done" in cls(row(EX0, 1)))
        check("(i) unskipped values are unchanged", draft()["exercises"][0]["sets"] == before,
              draft()["exercises"][0]["sets"])

        # (e) swap
        page.click(EX0 + ' [data-act="swap"]')
        check("(e) swap changes the displayed name", "DB Bench Press" in page.inner_text(EX0 + " .ex-name"),
              page.inner_text(EX0 + " .ex-name"))
        # .ex-tag is text-transform:uppercase, so compare the DOM text, not the rendered text
        check("(e) 'DB swap' tag appears", page.text_content(EX0 + " .ex-tag") == "DB swap",
              page.text_content(EX0 + " .ex-tag"))
        page.click(EX0 + ' [data-act="swap"]')
        check("(e) swap cycles back to the original", draft()["exercises"][0]["swappedTo"] is None)
        cycle = []
        for _ in range(3):
            page.click(EX3 + ' [data-act="swap"]')
            cycle.append(draft()["exercises"][3]["swappedTo"])
        check("(e) 2-alternate swap cycles null->a0->a1->null",
              cycle == ["band-face-pull", "db-rear-fly", None], cycle)

        # (f) hotel mode
        page.click('[data-act="hotel"]')
        d = draft()
        check("(f) hotel chip lights", "on" in cls('[data-act="hotel"]'))
        check("(f) hotel sets draft.hotel true", d["hotel"] is True)
        check("(f) hotel swaps every exercise with alternates",
              all(e["swappedTo"] is not None for e in d["exercises"]), [e["swappedTo"] for e in d["exercises"]])
        check("(f) hotel picks alternates[0]", d["exercises"][0]["swappedTo"] == "db-bench")
        page.click('[data-act="hotel"]')
        d = draft()
        check("(f) hotel off restores all",
              d["hotel"] is False and all(e["swappedTo"] is None for e in d["exercises"]),
              [e["swappedTo"] for e in d["exercises"]])

        # warmup chips
        page.click('[data-warmup="row-15"]')
        check("warmup chip marks done", draft()["warmup"] == {"choice": "row-15", "done": True}, draft()["warmup"])
        page.click('[data-warmup="row-15"]')
        check("warmup chip re-tap unmarks but keeps the choice",
              draft()["warmup"] == {"choice": "row-15", "done": False}, draft()["warmup"])

        # note textarea saves without a re-render, so focus survives
        page.click("#workout-note")
        page.type("#workout-note", "left shoulder ok")
        check("note saves without losing focus",
              draft()["note"] == "left shoulder ok" and page.evaluate("document.activeElement.id") == "workout-note",
              (draft()["note"], page.evaluate("document.activeElement.id")))

        # (g) core menu gates FINISH
        check("(g) FINISH disabled before core", page.locator("#btn-finish").is_disabled())
        page.click('[data-menu="core"] .chips [data-id="core-deadbug"]')
        CORE0 = '[data-menu="core"] .ex[data-group="core"][data-idx="0"]'
        check("(g) core selection shows 3 set rows", page.locator(CORE0 + " .set-row").count() == 3,
              page.locator(CORE0 + " .set-row").count())
        check("(g) FINISH still disabled with no core set logged", page.locator("#btn-finish").is_disabled())
        page.click(row(CORE0, 0) + " .mark")
        check("(g) logging a core set enables FINISH", page.locator("#btn-finish").is_enabled())
        check("(g) core set uses the menu item's default reps", draft()["core"][0]["sets"][0]["reps"] == 15,
              draft()["core"][0]["sets"][0])

        # skipped core work keeps its sets (for unskip) but must not satisfy the FINISH gate
        page.click(CORE0 + ' [data-act="skip"]')
        check("(g) skipping the only logged core move disables FINISH", page.locator("#btn-finish").is_disabled(),
              draft()["core"][0])
        check("(g) skipped core entry still holds its logged sets",
              draft()["core"][0]["sets"][0] is not None, draft()["core"][0]["sets"])
        page.click(CORE0 + ' [data-act="skip"]')
        check("(g) unskipping re-enables FINISH", page.locator("#btn-finish").is_enabled())
        page.click(row(CORE0, 2) + ' [data-field="weight"]')
        page.fill(row(CORE0, 2) + ' input[data-edit="weight"]', "25")
        page.click(row(CORE0, 2) + ' [data-act="logset"]')
        cs = draft()["core"][0]["sets"]
        check("(g) core inline editor logs, leaving set 1 unlogged",
              cs[0] is not None and cs[1] is None and cs[2]["weight"] == 25, cs)

        # a skipped exercise with logged sets must contribute sets: [] to the finished session
        page.click(row(EX1, 0) + " .mark")
        page.click(row(EX1, 1) + " .mark")
        check("incline has two logged sets before being skipped",
              len([x for x in draft()["exercises"][1]["sets"] if x]) == 2, draft()["exercises"][1]["sets"])
        page.click(EX1 + ' [data-act="skip"]')

        bs = draft()["exercises"][0]["sets"]
        check("pre-finish bench sets are sparse [x,x,null,null]",
              bs[0] and bs[1] and bs[2] is None and bs[3] is None, bs)

        # ---- ADDED WORK (ad-hoc movements appended to today) ----
        EXTRAS = '[data-menu="extras"]'
        EXTRA0 = EXTRAS + ' .ex[data-group="extras"][data-idx="0"]'
        EXTRA1 = EXTRAS + ' .ex[data-group="extras"][data-idx="1"]'

        def xrow(ex, s):
            return f'{ex} .set-row[data-set="{s}"]'

        check("(extras) the ADDED WORK card renders on TODAY", page.locator(EXTRAS).count() == 1)
        check("(extras) picker opens on a placeholder that selects nothing",
              page.eval_on_selector("#extras-pick", "el => el.value") == "",
              page.eval_on_selector("#extras-pick", "el => el.value"))
        opts = page.eval_on_selector_all("#extras-pick option", "els => els.map(e => e.textContent)")
        check("(extras) movements are listed alphabetically after the placeholder",
              opts[0] == "Add a movement…" and opts[1:] == sorted(opts[1:]), opts[:4])

        page.select_option("#extras-pick", label="Pushups")
        page.click(EXTRAS + ' [data-act="add-extra"]')
        check("(extras) + ADD appends the movement to draft.extras",
              [e["exerciseId"] for e in draft()["extras"]] == ["pushups"], draft()["extras"])
        check("(extras) the added card shows 3 set rows",
              page.locator(EXTRA0 + " .set-row").count() == 3, page.locator(EXTRA0 + " .set-row").count())
        check("(extras) added work offers remove, never skip",
              page.locator(EXTRA0 + ' [data-act="remove"]').count() == 1
              and page.locator(EXTRA0 + ' [data-act="skip"]').count() == 0)

        # adding the same movement again is a no-op — one card per movement per day
        page.select_option("#extras-pick", label="Pushups")
        page.click(EXTRAS + ' [data-act="add-extra"]')
        check("(extras) adding the same movement twice is a no-op", len(draft()["extras"]) == 1,
              draft()["extras"])

        # log a set through the full editor, stepping a field that has no prefill at all (0 -> 5)
        page.click(xrow(EXTRA0, 0) + ' [data-field="weight"]')
        check("(extras) a field with no history and no prior set opens empty",
              page.input_value(xrow(EXTRA0, 0) + ' input[data-edit="weight"]') == "",
              page.input_value(xrow(EXTRA0, 0) + ' input[data-edit="weight"]'))
        page.click(xrow(EXTRA0, 0) + ' .step-btn[data-step-field="weight"][data-step="1"]')
        check("(extras) stepping an empty field with no default starts from 0",
              page.input_value(xrow(EXTRA0, 0) + ' input[data-edit="weight"]') == "5",
              page.input_value(xrow(EXTRA0, 0) + ' input[data-edit="weight"]'))
        page.click(xrow(EXTRA0, 0) + ' [data-act="logset"]')
        check("(extras) the set logs with the menu item's default reps",
              draft()["extras"][0]["sets"][0] == {"reps": 15, "weight": 5, "rpe": None},
              draft()["extras"][0]["sets"][0])

        # a second movement, then remove it — no confirm, entry gone outright
        page.select_option("#extras-pick", label="Arnold Press")
        page.click(EXTRAS + ' [data-act="add-extra"]')
        check("(extras) a second movement appends after the first",
              [e["exerciseId"] for e in draft()["extras"]] == ["pushups", "arnold-press"], draft()["extras"])
        check("(extras) Arnold Press renders its own card",
              "Arnold Press" in page.inner_text(EXTRA1 + " .ex-name"), page.inner_text(EXTRA1 + " .ex-name"))
        page.click(EXTRA1 + ' [data-act="remove"]')
        check("(extras) remove drops the entry and leaves the rest alone",
              [e["exerciseId"] for e in draft()["extras"]] == ["pushups"], draft()["extras"])
        check("(extras) removing also drops the card", page.locator(EXTRA1).count() == 0)

        # (h) FINISH compacts and advances
        page.click("#btn-finish")
        page.wait_for_timeout(150)
        after = st()
        sess = after["sessions"][0]
        check("(h) header advances to the next day", "Quads & Glutes" in page.inner_text("#floor-name"),
              page.inner_text("#floor-name"))
        check("(h) one workout session stored",
              len(after["sessions"]) == 1 and sess["type"] == "workout", after["sessions"])
        allsets = [x for grp in ("exercises", "core", "stabilizers", "extras") for e in sess[grp] for x in e["sets"]]
        check("(h) stored sets are dense (no nulls)", all(x is not None for x in allsets), allsets)
        check("(h) bench sets compacted 4 slots -> 2 entries", len(sess["exercises"][0]["sets"]) == 2,
              sess["exercises"][0]["sets"])
        check("(i) skipped exercise contributes sets: [] despite having been logged",
              sess["exercises"][1]["skipped"] is True and sess["exercises"][1]["sets"] == [],
              sess["exercises"][1])
        check("(h) core sets compacted 3 slots -> 2 entries", len(sess["core"][0]["sets"]) == 2,
              sess["core"][0]["sets"])
        check("(extras) finished session carries compacted extras",
              len(sess["extras"]) == 1 and sess["extras"][0]["exerciseId"] == "pushups"
              and sess["extras"][0]["sets"] == [{"reps": 15, "weight": 5, "rpe": None}],
              sess.get("extras"))
        check("(h) session carries warmup / hotel / note",
              sess["warmup"]["choice"] == "row-15" and sess["hotel"] is False and sess["note"] == "left shoulder ok",
              (sess["warmup"], sess["hotel"], sess["note"]))
        # finishSession nulls the draft; the re-render immediately opens a fresh, empty one for the new day
        check("(h) finished draft replaced by an empty one for the new day",
              after["draft"]["dayId"] == "re-w2-d2"
              and all(x is None for e in after["draft"]["exercises"] for x in e["sets"])
              and after["draft"]["core"] == [] and after["draft"]["extras"] == []
              and after["draft"]["note"] == "",
              after["draft"])

        # core history now prefills the next day's menu work (lastWeights reads session.core)
        page.click('[data-menu="core"] .chips [data-id="core-deadbug"]')
        check("core weights prefill from the previous session's core block",
              "25" in page.text_content('[data-menu="core"] .ex[data-group="core"][data-idx="0"]'
                                        ' .set-row[data-set="0"] [data-field="weight"]'),
              page.text_content('[data-menu="core"] .ex[data-group="core"][data-idx="0"]'
                                ' .set-row[data-set="0"] [data-field="weight"]'))
        page.click('[data-menu="core"] .chips [data-id="core-deadbug"]')  # deselect again

        # added work prefills from history too (lastWeights reads session.extras)
        page.select_option("#extras-pick", label="Pushups")
        page.click(EXTRAS + ' [data-act="add-extra"]')
        check("(extras) added work prefills its weight from the previous session",
              "5" in page.text_content(xrow(EXTRA0, 0) + ' [data-field="weight"]'),
              page.text_content(xrow(EXTRA0, 0) + ' [data-field="weight"]'))
        page.click(EXTRA0 + ' [data-act="remove"]')  # back to a clean slate for the rest of the flow

        # (j) REST DAY keeps the day and the draft
        page.click(row(EX0, 0) + " .mark")
        page.click("#btn-rest")
        page.wait_for_timeout(200)
        d3 = st()
        check("(j) rest session logged",
              len(d3["sessions"]) == 2 and d3["sessions"][1]["type"] == "rest", d3["sessions"])
        check("(j) day stays on Quads & Glutes", "Quads & Glutes" in page.inner_text("#floor-name"))
        check("(j) draft survives a rest-day log", d3["draft"]["exercises"][0]["sets"][0] is not None)
        check("(j) logged row still marked after rest", "done" in cls(row(EX0, 0)))

        # reload mid-workout preserves the draft
        page.reload()
        page.wait_for_selector(EX0)
        check("reload preserves the logged set row", "done" in cls(row(EX0, 0)))
        check("reload preserves the draft in storage", st()["draft"]["exercises"][0]["sets"][0] is not None)

        # unknown menu selections are dropped on load rather than rendering nothing, and a draft
        # carrying the same movement twice (only reachable by hand-editing or importing) collapses
        # to one entry rather than rendering two cards over it
        page.evaluate("""() => {
          const s = JSON.parse(localStorage.getItem('lift.v1'));
          s.draft.core.push({ exerciseId: 'core-does-not-exist', sets: [null, null, null] });
          s.draft.extras = [
            { exerciseId: 'pushups', sets: [{ reps: 15, weight: 5, rpe: null }, null, null] },
            { exerciseId: 'pushups', sets: [null, null, null] },
            { exerciseId: 'not-a-movement', sets: [null] },
          ];
          localStorage.setItem('lift.v1', JSON.stringify(s));
        }""")
        page.reload()
        page.wait_for_selector(EX0)
        check("normalizeDraft drops selections with no menu item",
              all(c["exerciseId"] != "core-does-not-exist" for c in st()["draft"]["core"]), st()["draft"]["core"])
        ex = st()["draft"]["extras"]
        check("normalizeDraft dedupes extras and keeps the first occurrence",
              [e["exerciseId"] for e in ex] == ["pushups"] and ex[0]["sets"][0] is not None, ex)
        check("normalizeDraft drops extras with no menu item, and renders one card",
              page.locator('[data-menu="extras"] .ex[data-group="extras"]').count() == 1,
              page.locator('[data-menu="extras"] .ex[data-group="extras"]').count())
        page.click('[data-menu="extras"] .ex[data-group="extras"][data-idx="0"] [data-act="remove"]')

        # a corrupt blob is stashed, not destroyed
        page.evaluate("""() => localStorage.setItem('lift.v1', JSON.stringify({ schemaVersion: 99, junk: 1 }))""")
        page.reload()
        page.wait_for_selector(EX0)
        check("corrupt state is stashed under lift.v1.corrupt",
              "99" in (page.evaluate("localStorage.getItem('lift.v1.corrupt')") or ""),
              page.evaluate("localStorage.getItem('lift.v1.corrupt')"))

        # gate floor
        page.evaluate("""() => {
          const s = JSON.parse(localStorage.getItem('lift.v1'));
          s.position.dayIndex = 10; s.draft = null;
          localStorage.setItem('lift.v1', JSON.stringify(s));
        }""")
        page.reload()
        page.wait_for_selector("#btn-gate")
        check("(gate) checkpoint renders", "CHECKPOINT" in page.inner_text("#floor-name"))
        page.click("#btn-gate")
        page.wait_for_timeout(150)
        check("(gate) advances past the checkpoint", st()["position"]["dayIndex"] == 11, st()["position"])

        # ---- HISTORY floor ----
        # Seeded rather than built on the flow above: the corrupt-blob test just before this point
        # resets the app to a fresh defaultState (sessions: []) the moment it next renders, so any
        # session history from earlier in the run (the finished Push workout, the logged rest day)
        # is already gone by here. A self-contained seed gives deterministic, known-shape content.
        WORKOUT_DATE, REST_DATE = "2026-01-05", "2026-01-06"
        page.evaluate(
            """([workoutDate, restDate]) => {
              const s = JSON.parse(localStorage.getItem('lift.v1'));
              s.sessions = [
                {
                  date: workoutDate, type: 'workout', dayId: 're-w1-d1',
                  warmup: { choice: 'row-15', done: true }, hotel: false,
                  exercises: [
                    { exerciseId: 'bench-press', swappedTo: null, skipped: false,
                      sets: [{ reps: 10, weight: 95, rpe: 8 }, { reps: 8, weight: null, rpe: null }] },
                    { exerciseId: 'incline-db', swappedTo: null, skipped: true, sets: [] },
                  ],
                  core: [{ exerciseId: 'core-deadbug', sets: [{ reps: 15, weight: null, rpe: null },
                                                                { reps: 12, weight: 25, rpe: null }] }],
                  stabilizers: [],
                  extras: [{ exerciseId: 'pushups', sets: [{ reps: 15, weight: null, rpe: null }] }],
                  note: 'left shoulder ok',
                },
                { date: restDate, type: 'rest' },
              ];
              localStorage.setItem('lift.v1', JSON.stringify(s));
            }""",
            [WORKOUT_DATE, REST_DATE],
        )
        page.reload()
        page.wait_for_selector(EX0)
        page.click("#rail .lift-btn:nth-child(2)")  # HISTORY
        page.wait_for_selector(".hist-item")
        check("(history) two entries render", page.locator(".hist-item").count() == 2,
              page.locator(".hist-item").count())
        check("(history) newest first: rest entry above the workout",
              "Rest day" in page.inner_text(".hist-item:nth-child(1)")
              and "Push" in page.inner_text(".hist-item:nth-child(2)"),
              [page.inner_text(".hist-item:nth-child(1)"), page.inner_text(".hist-item:nth-child(2)")])

        WORKOUT_ROW = ".hist-item:nth-child(2)"
        row_text = page.inner_text(WORKOUT_ROW)
        check("(history) workout row shows day name, date, sets count, and note preview",
              "Push" in row_text and WORKOUT_DATE in row_text
              and "sets" in row_text and "left shoulder ok" in row_text,
              row_text)
        # 2 bench + 0 (skipped incline) + 2 core + 1 added = 5
        check("(history) the summary set count includes added work", "5 sets" in row_text, row_text)

        # expand
        page.click(WORKOUT_ROW)
        detail_text = page.inner_text(WORKOUT_ROW + " .hist-detail")
        check("(history) detail lists Bench Press (unswapped) with reps x weight",
              "Bench Press" in detail_text and "10×95@8" in detail_text, detail_text)
        # .ex-tag is text-transform:uppercase (see the "DB swap"/"cable swap" tag check above),
        # so compare case-insensitively against the DOM's rendered text, not the literal markup.
        check("(history) detail includes a Core section", "core" in detail_text.lower(), detail_text)
        check("(history) detail includes an Added section naming the extra movement",
              "added" in detail_text.lower() and "Pushups" in detail_text, detail_text)
        check("(history) detail shows the full note", "left shoulder ok" in detail_text, detail_text)
        check("(history) skipped exercise shows 'skipped'",
              "Incline" in detail_text and "skipped" in detail_text, detail_text)

        # collapse
        page.click(WORKOUT_ROW)
        check("(history) tapping again collapses the detail",
              page.locator(WORKOUT_ROW + " .hist-detail").is_hidden())

        # clicks on History only toggle DOM state — never localStorage
        snapshot = page.evaluate("localStorage.getItem('lift.v1')")
        page.click(WORKOUT_ROW)
        page.click(WORKOUT_ROW)
        check("history taps never mutate stored state",
              page.evaluate("localStorage.getItem('lift.v1')") == snapshot)

        # ---- HISTORY: XSS guard, via a seeded, self-contained session ----
        # Seeded rather than woven into the flow above, since the existing note assertions
        # ("left shoulder ok") already pin that field's exact value earlier in the run.
        PWNED_NOTE = "<img src=x onerror=window.__pwned=1>"
        page.evaluate(
            """(note) => {
              const s = JSON.parse(localStorage.getItem('lift.v1'));
              s.sessions.push({
                date: '2020-01-01', type: 'workout', dayId: 're-w1-d1',
                warmup: { choice: 'row-15', done: true }, hotel: false,
                exercises: [{ exerciseId: 'bb-bench', swappedTo: null, skipped: false,
                              sets: [{ reps: 5, weight: 135, rpe: null }] }],
                core: [], stabilizers: [],
                note,
              });
              localStorage.setItem('lift.v1', JSON.stringify(s));
            }""",
            PWNED_NOTE,
        )
        page.reload()
        page.wait_for_selector(EX0)
        page.click("#rail .lift-btn:nth-child(2)")  # HISTORY
        page.wait_for_selector(".hist-item")
        check("(history xss) malicious note does not execute",
              page.evaluate("window.__pwned") is None)
        XSS_ROW = ".hist-item:nth-child(1)"  # newest session, pushed last
        check("(history xss) malicious note renders as visible text",
              PWNED_NOTE in page.inner_text(XSS_ROW), page.inner_text(XSS_ROW))
        check("(history xss) no <img> element was created from the note",
              page.locator('img[src="x"]').count() == 0)
        page.click(XSS_ROW)
        xss_detail = page.inner_text(XSS_ROW + " .hist-detail")
        check("(history xss) note renders as text in the expanded detail too",
              PWNED_NOTE in xss_detail, xss_detail)
        check("(history xss) expanded detail created no <img> element either",
              page.locator('img[src="x"]').count() == 0)

        # History has no CLICK_HANDLERS entry — its rows use their own onclick, which only ever
        # toggles a hidden attribute. Confirm a tap inside one still never touches localStorage.
        snapshot = page.evaluate("localStorage.getItem('lift.v1')")
        page.click("#floor .hist-detail")
        page.wait_for_timeout(100)
        check("clicks on an unrouted floor change nothing",
              page.evaluate("localStorage.getItem('lift.v1')") == snapshot)

        # ---- PROGRAM floor ----
        # Browse-only: reads state.position.dayIndex to mark "you are here" but never writes to
        # state.draft or state.sessions. The flow above ends at dayIndex 11 (the gate-floor block
        # forces position to 10, then #btn-gate advances it by one) — Week 3 in flat-index terms
        # (reentry weeks 1–4 span indices 0–4, 5–9, [gate@10], 11–15, 16–20, [gate@21]).
        program_snapshot = page.evaluate("localStorage.getItem('lift.v1')")
        check("program flow position is Week 3 (index 11) going in", st()["position"]["dayIndex"] == 11,
              st()["position"])
        page.click("#rail .lift-btn:nth-child(3)")  # PROGRAM
        page.wait_for_selector(".card .ex-head")

        check("(program) both block titles render",
              "Re-Entry Protocol" in page.inner_text("#floor") and "Big Numbers — RPE Wave" in page.inner_text("#floor"),
              page.inner_text("#floor")[:200])

        week_heads = page.locator("#floor .card .ex-head")
        check("(program) 20 week cards render", week_heads.count() == 20, week_heads.count())
        check("(program) exactly 2 gate rows render", page.locator("#floor .gate-card").count() == 2,
              page.locator("#floor .gate-card").count())

        amber_weeks = page.locator("#floor .ex-head .ex-name.amber")
        check("(program) exactly one week label is amber", amber_weeks.count() == 1, amber_weeks.count())
        check("(program) the amber week matches the current position",
              "Week 3 — Phase 2" in amber_weeks.inner_text(), amber_weeks.inner_text())

        # expand a re-entry week: 5 days, each showing sets×reps[@rpe] lines
        week1_card = page.locator('.card:has(.ex-head:has-text("Week 1 — Phase 1"))')
        week1_detail = week1_card.locator(".wk-detail")
        week1_card.locator(".ex-head").click()
        check("(program) re-entry week expands to 5 days", week1_detail.locator(".ex").count() == 5,
              week1_detail.locator(".ex").count())
        w1_text = week1_detail.inner_text()
        check("(program) re-entry day lists an exercise with a sets×reps@rpe string",
              "Bench Press" in w1_text and "4×12 @6-7" in w1_text, w1_text)

        # collapse
        week1_card.locator(".ex-head").click()
        check("(program) collapsing hides the week detail", week1_detail.is_hidden())

        # wave deload week: accessories drop to 2 sets while main/speed/vpress keep the week's scheme
        week4_card = page.locator('.card:has(.ex-head:has-text("Week 4 — Deload"))')
        week4_detail = week4_card.locator(".wk-detail")
        week4_card.locator(".ex-head").click()
        w4_text = week4_detail.inner_text()
        check("(program) deload week halves an accessory to 2 sets",
              "Cable Lateral Raise" in w4_text and "2×15-20" in w4_text, w4_text)

        # wave test week: 1RM-style prescriptions, exactly one exercise per day
        week16_card = page.locator('.card:has(.ex-head:has-text("Week 16 — Test Week"))')
        week16_detail = week16_card.locator(".wk-detail")
        week16_card.locator(".ex-head").click()
        w16_text = week16_detail.inner_text()
        check("(program) test week shows 5RM/6RM prescriptions", "5RM" in w16_text and "6RM" in w16_text, w16_text)
        check("(program) test week renders 5 days with exactly one exercise line each",
              week16_detail.locator(".ex").count() == 5 and week16_detail.locator(".ex-cue").count() == 5,
              (week16_detail.locator(".ex").count(), week16_detail.locator(".ex-cue").count()))

        # browsing the program never writes to storage
        check("(program) taps on PROGRAM never mutate localStorage",
              page.evaluate("localStorage.getItem('lift.v1')") == program_snapshot)

        # ---- STACK floor ----
        # Browse-only supplement reference: 5 sections with 16 items total, read-only.
        stack_snapshot = page.evaluate("localStorage.getItem('lift.v1')")
        page.click("#rail .lift-btn:nth-child(4)")  # STACK
        page.wait_for_selector(".card .ex")

        check("(stack) 5 section cards render",
              page.locator("#floor > .card").count() == 5, page.locator("#floor > .card").count())

        section_titles = []
        for i in range(1, 6):
            title = page.inner_text(f"#floor > .card:nth-child({i}) .section-title")
            section_titles.append(title)
        check("(stack) section titles are Pre-Workout, Morning, Post-Workout, Dinner, Night",
              section_titles == ["Pre-Workout", "Morning", "Post-Workout", "Dinner", "Night"],
              section_titles)

        check("(stack) 16 .ex items total", page.locator("#floor .ex").count() == 16,
              page.locator("#floor .ex").count())

        # Check Pre-Workout section has the correct timing
        pre_workout_timing = page.inner_text("#floor > .card:nth-child(1) .section-sub.amber")
        check("(stack) Pre-Workout timing renders", "30–45 min before training" in pre_workout_timing,
              pre_workout_timing)

        # Check a known item: Creatine in the Morning section
        creatine_items = page.locator("#floor .ex:has(.ex-name:has-text('Creatine'))")
        check("(stack) Creatine item exists", creatine_items.count() >= 1, creatine_items.count())
        if creatine_items.count() >= 1:
            creatine_text = creatine_items.first.inner_text()
            check("(stack) Creatine facts string renders", "9,750mg" in creatine_text,
                  creatine_text[:200])

        # browsing the stack never writes to storage
        check("(stack) STACK is read-only, never mutates localStorage",
              page.evaluate("localStorage.getItem('lift.v1')") == stack_snapshot)

        # ---- SETTINGS floor ----
        # Runs LAST among the floor tests: export/import/reset destroy state, so nothing after
        # this section may depend on session history, draft contents, or position.

        # Land on TODAY first and log a set, so the position-change guard has real work to protect.
        page.click("#rail .lift-btn:nth-child(1)")  # TODAY
        page.wait_for_selector(EX0)
        check("(settings-guard) starting day is the fresh, unlogged Push day at index 11",
              draft()["dayId"] == "re-w3-d1" and draft()["exercises"][0]["sets"][0] is None, draft())
        page.click(row(EX0, 0) + " .mark")
        check("(settings-guard) a set is now logged", draft()["exercises"][0]["sets"][0] is not None, draft())

        page.click("#rail .lift-btn:nth-child(5)")  # SETTINGS
        page.wait_for_selector("#pos-day")

        # (settings-pos) position picker lists every FLAT entry, preselected on the current one
        check("(settings) position select lists all 102 program entries",
              page.locator("#pos-day option").count() == 102, page.locator("#pos-day option").count())
        check("(settings) position select preselects the current day",
              page.eval_on_selector("#pos-day", "el => el.value") == "11",
              page.eval_on_selector("#pos-day", "el => el.value"))

        # (settings-guard) SET POSITION with logged work pending must confirm before discarding it.
        # Dismissing the confirm leaves both position and the in-progress draft untouched.
        page.select_option("#pos-day", label="Week 1 — Hypertrophy Foundation — Speed Upper")
        dialog_mode["accept"] = False
        page.click("#btn-setpos")
        page.wait_for_timeout(150)
        check("(settings-guard) dismissing the discard confirm leaves position unchanged",
              st()["position"]["dayIndex"] == 11, st()["position"])
        check("(settings-guard) dismissing the discard confirm keeps the logged set",
              draft()["dayId"] == "re-w3-d1" and draft()["exercises"][0]["sets"][0] is not None, draft())

        # Accepting the same confirm proceeds exactly as before: draft cleared, position moves.
        dialog_mode["accept"] = True
        page.click("#btn-setpos")  # select is still on the wave day from the dismissed attempt
        page.wait_for_timeout(150)
        check("(settings) SET POSITION lands on TODAY for the chosen day",
              "TODAY — Speed Upper" in page.inner_text("#floor-name"), page.inner_text("#floor-name"))
        d = draft()
        check("(settings) position change discards the old draft and starts a fresh one",
              d["dayId"] == "wave-w1-d1" and d["hotel"] is False
              and all(x is None for e in d["exercises"] for x in e["sets"])
              and d["core"] == [] and d["stabilizers"] == [] and d["note"] == "",
              d)

        # (settings-hotel) hotel mode default: flips the stored flag, and a subsequently-created
        # fresh draft (forced here by re-submitting SET POSITION on the same day) starts pre-swapped.
        page.click("#rail .lift-btn:nth-child(5)")  # SETTINGS
        page.wait_for_selector("#hotel-default")
        page.click("#hotel-default")
        check("(settings) hotel default toggles on", st()["hotelModeDefault"] is True, st()["hotelModeDefault"])

        page.click("#btn-setpos")  # same day still selected — forces a fresh draft under the new default
        page.wait_for_timeout(150)
        d = draft()
        check("(settings) fresh draft under hotel default starts with hotel: true", d["hotel"] is True, d)
        check("(settings) fresh draft under hotel default pre-swaps every exercise with an alternate",
              all(e["swappedTo"] is not None for e in d["exercises"]), [e["swappedTo"] for e in d["exercises"]])
        check("(settings) swapped names show on TODAY",
              "Explosive DB Press" in page.inner_text("#floor"), page.inner_text("#floor")[:400])

        page.click("#rail .lift-btn:nth-child(5)")  # SETTINGS
        page.wait_for_selector("#hotel-default")
        page.click("#hotel-default")
        check("(settings) hotel default toggles back off", st()["hotelModeDefault"] is False,
              st()["hotelModeDefault"])

        # (settings-export) EXPORT downloads a timestamped JSON backup of the exact stored state
        with page.expect_download() as dl_info:
            page.click("#btn-export")
        download = dl_info.value
        fname = download.suggested_filename
        check("(settings) export filename matches the-lift-backup-*.json pattern",
              fname.startswith("the-lift-backup-") and fname.endswith(".json"), fname)
        exported = json.loads(Path(download.path()).read_text())
        check("(settings) exported file parses as JSON with schemaVersion 1",
              exported.get("schemaVersion") == 1, exported.get("schemaVersion"))
        check("(settings) exported content matches the live stored state", exported == st(), exported)

        # (settings-import) a valid backup (schema-conformant, one field changed) replaces state
        valid_import = dict(exported)
        valid_import["hotelModeDefault"] = not valid_import["hotelModeDefault"]
        valid_path = Path(tempfile.gettempdir()) / "the-lift-import-valid.json"
        valid_path.write_text(json.dumps(valid_import))
        dialog_messages.clear()
        page.set_input_files("#import-file", str(valid_path))
        page.wait_for_timeout(200)
        check("(settings) valid import replaces the stored flag",
              st()["hotelModeDefault"] == valid_import["hotelModeDefault"], st()["hotelModeDefault"])

        # an invalid backup (schema-valid JSON, but not lift state) is rejected and leaves state alone
        before_invalid = st()
        invalid_path = Path(tempfile.gettempdir()) / "the-lift-import-invalid.json"
        invalid_path.write_text(json.dumps({"nope": 1}))
        dialog_messages.clear()
        page.set_input_files("#import-file", str(invalid_path))
        page.wait_for_timeout(200)
        check("(settings) invalid import fires an 'Import rejected' alert",
              any("Import rejected" in m for m in dialog_messages), dialog_messages)
        check("(settings) invalid import leaves stored state unchanged", st() == before_invalid,
              (st(), before_invalid))

        # (settings-import) a schema-valid backup can still carry a garbage draft.exercises —
        # validateState only checks position/sessions, never draft shape — so this import is
        # accepted. The crash risk is downstream, in normalizeDraft when TODAY next renders it.
        broken_import = st()
        check("(settings) broken-draft fixture still targets the current day",
              broken_import["draft"] is not None and broken_import["draft"]["dayId"] == "wave-w1-d1",
              broken_import["draft"])
        broken_import["draft"]["exercises"] = ["garbage"]
        broken_path = Path(tempfile.gettempdir()) / "the-lift-import-broken-draft.json"
        broken_path.write_text(json.dumps(broken_import))
        dialog_messages.clear()
        page.set_input_files("#import-file", str(broken_path))
        page.wait_for_timeout(200)
        check("(settings) schema-valid import with a garbage draft.exercises is accepted",
              st()["draft"]["exercises"] == ["garbage"], st()["draft"])

        page.click("#rail .lift-btn:nth-child(1)")  # TODAY -- forces ensureDraft/normalizeDraft to repair it
        page.wait_for_selector(EX0)
        check("(settings) rendering TODAY over a garbage draft throws no page error", not errors, errors)
        repaired = draft()["exercises"]
        check("(settings) normalizeDraft rebuilds draft.exercises to the day's exact length",
              len(repaired) == 6, repaired)
        check("(settings) repaired entries are well-formed and back in program order",
              [e.get("exerciseId") for e in repaired] ==
              ["speed-bench", "seated-db-press", "cable-lat-raise", "db-lat-raise", "rope-pushdown", "curl"]
              and all(isinstance(e.get("sets"), list) and all(s is None for s in e["sets"]) for e in repaired),
              repaired)

        # (settings-reset) RESET ALL (double-confirmed, both auto-accepted) wipes back to defaultState
        page.click("#rail .lift-btn:nth-child(5)")  # SETTINGS
        page.wait_for_selector("#btn-reset")
        page.click("#btn-reset")
        page.wait_for_timeout(200)
        reset_state = st()
        check("(settings) reset restores the exact default state",
              reset_state == {
                  "schemaVersion": 1, "position": {"dayIndex": 5},
                  "hotelModeDefault": False, "sessions": [], "draft": None,
              },
              reset_state)

        check("no uncaught page errors", not errors, errors)

        # ---- OFFLINE / SERVICE WORKER ----
        # Needs a fresh context: the flow above never registers/awaits the SW, and reusing that
        # page's storage state would tangle this section's assertions with everything before it.
        sw_context = browser.new_context(viewport={"width": 430, "height": 900})
        sw_page = sw_context.new_page()
        sw_errors = []
        sw_page.on("pageerror", lambda e: sw_errors.append(str(e)))
        sw_page.goto(URL)
        sw_page.wait_for_selector('.ex[data-group="exercises"][data-idx="0"]')

        # app.js skips SW registration on localhost/127.0.0.1 (so local dev never serves stale
        # files) — this test runs against 127.0.0.1, so register explicitly here instead.
        # `ready` resolves as soon as an active worker exists — its state may still read
        # "activating" rather than "activated" at that instant, so just confirm one exists.
        reg_active = sw_page.evaluate(
            "navigator.serviceWorker.register('sw.js')"
            ".then(() => navigator.serviceWorker.ready)"
            ".then(r => !!r.active)"
        )
        check("(offline) service worker registration is active", reg_active)

        # Network-first: offline reload takes the catch path (fetch rejects fast with no network),
        # falling back to the precached copy — same visible result as the old cache-first strategy.
        sw_context.set_offline(True)
        sw_page.reload()
        sw_page.wait_for_selector("#indicator .wordmark")
        check("(offline) THE LIFT wordmark renders while offline",
              "THE LIFT" in sw_page.inner_text("#indicator .wordmark"),
              sw_page.inner_text("#indicator .wordmark"))
        check("(offline) TODAY floor still renders exercise 0 while offline",
              sw_page.locator('.ex[data-group="exercises"][data-idx="0"]').count() == 1)

        # back online: network-first should serve the live page fresh, with no errors
        sw_context.set_offline(False)
        sw_page.reload()
        sw_page.wait_for_selector('.ex[data-group="exercises"][data-idx="0"]')
        check("(offline) back online reload loads fresh with no page errors", not sw_errors, sw_errors)

        sw_context.close()

        browser.close()
finally:
    srv.send_signal(signal.SIGTERM)
    srv.wait(timeout=5)

failed = [n for n, ok, _ in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} PASS")
sys.exit(1 if failed else 0)
