# The Lift

Personal workout tracker for Jeff Sullivan. Static app — no build, no backend.
Live: https://ikkaruscrane.github.io/sullivan-lift/

- **Run locally:** `python3 -m http.server 8123` then open http://localhost:8123
  Service worker is disabled on localhost, so edits always show immediately.
- **Tests:** `node --test` for the pure logic in `lib.js`; `node scripts/check_program.mjs` after any `program-data.js` edit; `python3 tests/browser/test_lift.py` drives the full app in a browser (needs `pip install playwright` and the sandbox disabled; uses the cached chromium).
- **Data:** one localStorage key (`lift.v1`) on the phone — the repo holds no user data. Settings floor → Export for JSON backup.
- **Deploy:** commit and `git push` to `main` — GitHub Pages serves it, and the network-first service worker picks the change up on the next load with no version bump. Push only `main`; local archive branches stay local.

Workflow details for Claude Code sessions: `CLAUDE.md`. Design and product spec: `docs/superpowers/specs/2026-09-28-the-lift-v2-design.md`.
