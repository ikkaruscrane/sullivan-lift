#!/usr/bin/env python3
"""One-time Apple Health export analysis for The Lift.
Streams export.xml, aggregates workouts and key vitals, writes analysis/health_summary.json.
"""
# Output is personal health data — keep health_summary.json out of the public repo (it lives in the parent Training folder).
import json
import statistics
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

XML = Path(__file__).resolve().parent.parent / "analysis/healthdata/apple_health_export/export.xml"
OUT = Path(__file__).resolve().parent.parent / "analysis/health_summary.json"

WANTED_RECORDS = {
    "HKQuantityTypeIdentifierRestingHeartRate": "resting_hr",
    "HKQuantityTypeIdentifierHeartRateVariabilitySDNN": "hrv_sdnn",
    "HKQuantityTypeIdentifierVO2Max": "vo2max",
    "HKQuantityTypeIdentifierBodyMass": "body_mass",
    "HKQuantityTypeIdentifierStepCount": "steps",
    "HKQuantityTypeIdentifierAppleExerciseTime": "exercise_min",
    "HKCategoryTypeIdentifierSleepAnalysis": "sleep",
}

def month(d):  # "2026-09-14 07:31:02 -0500" -> "2026-09"
    return d[:7]

def day(d):
    return d[:10]

def main():
    monthly = defaultdict(lambda: defaultdict(list))   # metric -> month -> values
    # steps are recorded per-source (iPhone, Watch, GymKit, ...) and overlap heavily;
    # aggregate per (day, source) and dedup by taking the max single-source total per day
    daily_steps_by_source = defaultdict(lambda: defaultdict(float))  # day -> source -> steps
    sleep_by_day = defaultdict(float)                  # day -> asleep hours
    workouts = []                                      # dicts: type, date, minutes
    n = 0
    root = None
    for event, elem in ET.iterparse(str(XML), events=("start", "end")):
        if event == "start":
            if root is None:
                root = elem
            continue
        tag = elem.tag
        if tag == "Record":
            t = elem.get("type")
            key = WANTED_RECORDS.get(t)
            if key:
                start = elem.get("startDate", "")
                if key == "steps":
                    source = elem.get("sourceName", "unknown")
                    try:
                        daily_steps_by_source[day(start)][source] += float(elem.get("value", 0))
                    except (TypeError, ValueError):
                        pass
                elif key == "sleep":
                    v = elem.get("value", "")
                    if "Asleep" in v:
                        fmt = "%Y-%m-%d %H:%M:%S %z"
                        try:
                            dur = (datetime.strptime(elem.get("endDate"), fmt)
                                   - datetime.strptime(start, fmt)).total_seconds() / 3600
                            sleep_by_day[day(start)] += dur
                        except (TypeError, ValueError):
                            pass
                else:
                    try:
                        monthly[key][month(start)].append(float(elem.get("value")))
                    except (TypeError, ValueError):
                        pass
        elif tag == "Workout":
            workouts.append({
                "type": elem.get("workoutActivityType", "").replace("HKWorkoutActivityType", ""),
                "date": day(elem.get("startDate", "")),
                "minutes": round(float(elem.get("duration", 0)), 1),
            })
        n += 1
        if n % 200000 == 0:
            print(f"...{n} elements", file=sys.stderr)
            if root is not None:
                root.clear()
        elem.clear()

    def summarize(metric):
        return {m: {"mean": round(statistics.mean(v), 2), "n": len(v)}
                for m, v in sorted(monthly[metric].items()) if v}

    wk_by_month = defaultdict(Counter)
    min_by_month = defaultdict(float)
    for w in workouts:
        wk_by_month[month(w["date"])][w["type"]] += 1
        min_by_month[month(w["date"])] += w["minutes"]

    # dedup steps: each day's total is the max across any single source, not the sum
    # across sources (iPhone + Watch + other apps double- and triple-count the same steps)
    daily_steps = {d: max(sources.values()) for d, sources in daily_steps_by_source.items() if sources}
    steps_by_month = defaultdict(list)
    for d, v in daily_steps.items():
        steps_by_month[month(d)].append(v)
    sleep_by_month = defaultdict(list)
    for d, v in sleep_by_day.items():
        if 2 < v < 14:  # discard fragments/double-counts
            sleep_by_month[month(d)].append(v)

    out = {
        "workouts_by_month": {m: dict(c) for m, c in sorted(wk_by_month.items())},
        "workout_minutes_by_month": {m: round(v) for m, v in sorted(min_by_month.items())},
        "resting_hr_by_month": summarize("resting_hr"),
        "hrv_sdnn_by_month": summarize("hrv_sdnn"),
        "vo2max_by_month": summarize("vo2max"),
        "body_mass_by_month": summarize("body_mass"),
        "exercise_min_by_month": summarize("exercise_min"),
        "avg_daily_steps_by_month": {m: round(statistics.mean(v)) for m, v in sorted(steps_by_month.items()) if v},
        "avg_sleep_hours_by_month": {m: round(statistics.mean(v), 2) for m, v in sorted(sleep_by_month.items()) if v},
        "total_workouts": len(workouts),
    }
    OUT.write_text(json.dumps(out, indent=2))
    print(f"wrote {OUT}")

if __name__ == "__main__":
    main()
