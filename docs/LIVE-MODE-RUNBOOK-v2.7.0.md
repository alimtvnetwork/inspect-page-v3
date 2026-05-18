# Live-mode launch runbook — Inspect Page v2.7.0

The single source of truth for going live. Drive it via `scripts/launch-orchestrator.sh`
(resumable; state in `.lovable/launch-state.json`).

## Pre-flight (must be done by a human)
1. Pick the production WP site URL. Set `INSPECT_PAGE_WP_SITE_URL` in
   `extension-src/shared/constants.ts` to `https://<your-wp>` (no trailing slash).
2. Re-run `extension/scripts/package.sh` to repackage `public/inspect-page.zip`
   with the baked-in URL. Refresh `public/inspect-page.zip.sha256`.
3. In WP admin → Inspect Page → Billing, paste the **live** Stripe secret key,
   price id, and webhook signing secret. Confirm `/billing/status` returns the
   right tagline for a known account.
4. Confirm the WP plugin v2.6.0 is active and `wp_pp_workspaces*` tables exist.

## Orchestrated steps (`bash scripts/launch-orchestrator.sh`)
 1. `verify-prod-build.sh`     — CWS upload gate (fails on empty WP URL)
 2. `smoke-runbook.sh`         — REST namespace reachable, unauth gates intact
 3. `seed-staging.sh`          — qa_free + qa_pro users (skip if WP_SSH unset)
 4. Pen-tests                  — manual; walk `docs/PEN-TEST-v2.7.0.md`
 5. AC-BILL-1..5               — manual; see `docs/PHASE-6-LAUNCH-CHECKLIST.md`
 6. AC-ANALYTICS-1..3          — manual
 7. AC-WS-1..7                 — manual; workspace invite/accept/transfer
 8. `capture-cws-screenshots.sh` — generates the dir + reminder
 9. CWS upload                 — manual; upload `public/inspect-page.zip`
10. Git tags                   — `ext-v2.7.0` + `wp-v2.6.0`
11. `post-launch-watch.sh`     — first 24h monitor (run `--once` in the orchestrator)

## Rollback
`bash scripts/rollback.sh` — restores v2.6.2 instructions for both extension and WP plugin.

## Comms (after step 9)
See `docs/POST-LAUNCH-COMMS.md` for the CWS "What's new" blurb, X thread,
customer email, in-app banner, and CHANGELOG entry.