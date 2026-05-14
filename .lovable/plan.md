# Option A — Share-link analytics

Track who actually opens the 4 Smart Share URLs (HTML / CSS / JS / image) so users can tell which shares are getting traction. All counters live in WordPress (the same place the sessions live); the extension just surfaces them.

## Phases (one per `next`)

### Phase 1 — WP backend: hit counter
- Add `views` column to `inspect_page_sessions` table (activator + migration on plugin update).
- In the public file-serving routes (`html.{sig}`, `css.{sig}`, `js.{sig}`, `image.{sig}`), increment `views` once per request, throttled by IP+session for 60 s to dampen reload spam.
- New REST `GET /sessions/{id}/stats` (cookie + nonce, owner-only) returning `{ views, lastViewedAt, perFile: { html, css, js, image } }`.
- PHPUnit: counter increments, throttle window, owner-only access, cross-user isolation.

### Phase 2 — WP plugin admin: dashboard column
- Add a "Views" column to the Recent Sessions table on the WP admin dashboard + Tools → Sessions list.
- Sortable by views; show "—" for sessions older than the new column.

### Phase 3 — Extension client wrapper
- New `extension-src/share/getSessionStats.ts` (GET `/sessions/{id}/stats`, cookie + nonce).
- Extend `listShareSessions` response to include `views` so we can render it inline.
- Vitest: success, 401 → `E_SHARE_AUTH`, 404 → `E_SHARE_NOT_FOUND`, malformed → `E_SHARE_NETWORK`.

### Phase 4 — Extension UI: views badge in Recent Shares
- In the Settings popover's `RecentSharesList`, add a small "👁 N" badge next to each session's expiry countdown.
- Click the badge to expand a per-file breakdown (html / css / js / image).
- Refresh on focus + after each new share.

### Phase 5 — Opt-in event log (Pro only)
- Behind a per-user toggle in WP admin → Inspect Page → Privacy: persist a 30-day rolling `inspect_page_session_events` table (session_id, file, ts, ip_hash, ua_hash).
- Surface a "Recent visitors" drawer in WP admin (anonymized only).
- Default OFF; documented in `wp-plugin/inspect-page/readme.txt` privacy section.

### Phase 6 — Package + docs
- Bump WP plugin to `2.5.1`, extension to `2.5.5`.
- CHANGELOG entries, repackage `inspect-page.zip` + `inspect-page-wp.zip`, refresh sha256s.
- Update `docs/ACCEPTANCE-v2.2.md` with new analytics acceptance row.

## Notes (technical)
- Throttle implemented via `wp_cache_get/set` on key `ip_<hash>_<sid>`; falls back to no-op when persistent cache absent (still safe).
- `views` column = `BIGINT UNSIGNED NOT NULL DEFAULT 0`; per-file counts stored as JSON `views_per_file` to avoid 4 columns.
- All new routes signature-verified the same way `class-rest.php::sign_session_id` already requires.
- No PII leaves the WP site; ip/ua are hashed with `inspect_page_url_secret` before storage.

Send `next` to start Phase 1 (WP backend counter + REST + PHPUnit).