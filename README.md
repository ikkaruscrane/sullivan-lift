# The Lift

Personal workout tracker for Jeff Sullivan. Static app — no build, no backend.

- **Run locally:** `python3 -m http.server 8123` then open http://localhost:8123
  Service worker is disabled on localhost, so edits always show immediately.
- **Tests:** `node --test` for the pure logic in `lib.js`; `python3 tests/browser/test_lift.py` drives the real TODAY logging flow in a browser (needs `pip install playwright` and the sandbox disabled; uses the cached chromium).
- **Data:** one localStorage key (`lift.v1`). Settings floor → Export for JSON backup.
- **Deploy:** push to `main`; GitHub Pages serves it.

Design system and product spec: `docs/superpowers/specs/2026-09-28-the-lift-v2-design.md`.
