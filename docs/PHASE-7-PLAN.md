# Phase 7 — Workspace Analytics & Per-Member Attribution (DRAFT)

Status: DRAFT — awaiting user approval before execution.

## Goal

Give workspace owners/admins visibility into who in the team is using Smart Share, how often, and against quota. Currently `wp_pp_sessions` only stores `user_id` (the WP user) with no `workspace_id`, so there's no way to roll up usage per workspace or per member.

## Acceptance criteria

- **AC-A1** `wp_pp_sessions` gains a nullable `workspace_id BIGINT UNSIGNED` column + index. Backfill: every existing row → owner's primary workspace.
- **AC-A2** Session creation writes `workspace_id` from the caller's active workspace (default = primary).
- **AC-A3** `GET /quota?workspace_id=N` returns `{ workspace_id, license, free_used, free_limit, period_used, period_limit, members: [{user_id, display_name, shares_30d}] }`. Admin/owner only.
- **AC-A4** `GET /analytics?workspace_id=N&days=30` returns daily buckets: `{ days: [{date, total_shares, total_views, unique_members}] }`. Admin/owner only.
- **AC-A5** `GET /analytics.csv?workspace_id=N&days=30` streams the same data as CSV with headers. Admin/owner only.
- **AC-A6** WP admin: **Inspect Page Workspaces → Analytics tab** renders a 30-day sparkline + per-member table + "Download CSV" button.

## Phases

### Phase 1 — Schema migration (WP plugin)
File: `wp-plugin/inspect-page/includes/class-activator.php`
- `ALTER TABLE wp_pp_sessions ADD COLUMN workspace_id BIGINT UNSIGNED NULL, ADD INDEX (workspace_id)`.
- Idempotent: check `information_schema.COLUMNS` first.
- Backfill query: `UPDATE wp_pp_sessions s JOIN wp_pp_workspace_members m ON m.user_id = s.user_id AND m.role = 'owner' SET s.workspace_id = m.workspace_id WHERE s.workspace_id IS NULL`.
- Bump plugin version constant + header → `2.7.0`.
- PHP tests: assert column exists, backfill leaves no NULLs for existing owners.

### Phase 2 — Write path + `/quota` (WP plugin)
File: `wp-plugin/inspect-page/includes/class-rest.php`
- Session insert in `create_share_session` writes `workspace_id` from `$_POST['workspace_id']` (validated against caller's memberships, default = primary).
- New route `GET /inspect-page/v1/quota` with `workspace_id` query param, owner/admin gated via existing `assert_workspace_role` helper.
- Response shape per AC-A3, members sub-query joined from `wp_pp_workspace_members`.
- PHP tests: 403 for non-member, 403 for plain member, 200 for owner/admin, correct totals.

### Phase 3 — Analytics endpoints + admin UI (WP plugin)
- `GET /analytics` + `/analytics.csv` per AC-A4/A5.
- Daily bucket SQL: `GROUP BY DATE(created_at)` over the last N days (cap N at 90).
- New `class-analytics.php` for query helpers (testable in isolation).
- Admin: extend `class-admin.php` workspaces page with **Analytics** tab — server-rendered sparkline (inline SVG, no JS framework), member table sorted by 30-day share count desc, CSV download link.
- PHP tests for bucket aggregation + role gating.

## Out of scope (defer to a later phase)

- Extension UI for analytics (read-only in WP admin for v1).
- Per-share view-count integration (Phase 7b — needs Shortcode read hooks).
- Email digest of weekly workspace activity (Phase 7c).

## Risk

Low. All changes additive — no breaking schema, no extension changes, no Stripe touchpoints. Migration is idempotent + reversible (drop column).

## Versioning

- WP plugin → `2.7.0`
- Extension → unchanged (`2.7.2`)
- New: `docs/RELEASE-NOTES-WP-v2.7.0.md`

---

Reply `next` to execute Phase 1.