# PagePort v2 plan — Export Modes + Share Links

Locked decisions (from user):
- Backend = **WordPress plugin** (self-hosted), shipped from this repo as `wp-plugin/pageport.zip`.
- Auth = **WP Application Passwords** (WP 5.6+ core feature). User pastes username + app password into PagePort Settings.
- Scope = **both** Full Page AND Pick Element flows.
- Single MD = **base64 inline** images (with degradation fallback per `05` P7).

Detailed spec lives in `spec/21-app/24-export-modes.md`, `spec/21-app/25-share-links.md`, and `spec/21-app/26-implementation-order-v2.md`. The plan below is the user-facing rollup; the spec files are the source of truth.

## Stages (user types `next` to advance)

- **V1 — Shared groundwork.** AI instruction block template, `ExportFlow` enum, `ExportArtifacts` type, `buildPromptMd` helper + tests.
- **V2 — Pick Element 4-mode toolbar.** MD / MD+files / ZIP buttons (Share Links rendered disabled).
- **V3 — Full Page 4-mode toolbar.** Same component reused; bundled ZIP gains `prompt.md` at root.
- **V4 — WP plugin scaffold.** Plugin headers, activator, table schema, route registration stubs, packaging script.
- **V5 — WP plugin sessions/uploads/reads.** POST /sessions, GET /share/{id}/{kind}, DELETE, LIST, hourly wp-cron expiry.
- **V6 — WP admin UI.** Tools → PagePort Sessions table with revoke.
- **V7 — Extension Share Links integration.** Settings UI, SW `CreateShareSession`, button enable + clipboard payload.
- **V8 — Polish + AC.** Error codes, acceptance checklist, repackage both zips, landing page links.

## Out of scope (deferred)

- Lovable Cloud backend (kept in reserve; settings already structured to swap base URL).
- OAuth / SSO. App passwords are sufficient.
- Multi-image uploads beyond the primary screenshot.
