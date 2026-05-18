# Phase 7 — Workspace Analytics & Per-Member Attribution

Status: DRAFT (post v2.7.0 launch). Owner: TBD. Target: Extension v2.8.0 + WP plugin v2.7.0.

## A. Problem

v2.7.0 shipped Team Workspaces but billing/analytics still answer at the *user* grain:
- `wp_pp_sessions` has `user_id` but no `workspace_id` column.
- The Pro dashboard shows lifetime free quota used per user, not pooled per workspace.
- Recent-visitors drawer attributes views to share session, not to the *member* who created it.
- Owners cannot see "who on my team is using the most shares" or "which member's links drive the most views".

## B. Goals (in priority order)

1. **Workspace-scoped quotas & analytics.** Every session row stamped with `workspace_id`; quota counters pool across members of a workspace.
2. **Per-member attribution.** Owners/admins see a leaderboard: shares created, views received, last-active per member.
3. **Workspace dashboard widget.** New WP admin card on `Tools → Inspect Page Workspaces` showing 7-day spark, top 5 shared pages, top 5 members.
4. **Extension surfacing.** "Free shares used: X / 5" in Settings becomes "Workspace shares used: X / N" with N = 5 (free) or ∞ (Pro), pulled from `/workspaces/:id/quota`.
5. **Export.** Owners can download a CSV of the last 90 days of workspace activity.

## C. Non-goals

- No real-time websocket dashboard. Polling on demand only.
- No per-member quotas. Pool stays workspace-wide.
- No billing-tier splits within a workspace (one Pro license = whole workspace Pro).
- No PII export. Visitor IP/UA stay anonymised (existing hash scheme).

## D. Schema changes

```sql
ALTER TABLE wp_pp_sessions
  ADD COLUMN workspace_id BIGINT UNSIGNED NULL AFTER user_id,
  ADD INDEX  idx_workspace_created (workspace_id, created_at);

-- Backfill on plugin activation v2.7.0:
UPDATE wp_pp_sessions s
  JOIN wp_pp_workspace_members m ON m.user_id = s.user_id AND m.role = 'owner'
  SET s.workspace_id = m.workspace_id
  WHERE s.workspace_id IS NULL;
```

No new tables. `wp_pp_session_views` (already exists for Recent-visitors drawer) joins via `session_id` so it inherits workspace scope for free.

## E. New REST endpoints (namespace `inspect-page/v1`)

| Method | Route | Auth | Returns |
|---|---|---|---|
| GET | `/workspaces/:id/quota` | member | `{ used, limit, period: "lifetime" }` |
| GET | `/workspaces/:id/analytics?range=7d\|30d\|90d` | owner/admin | `{ shares_per_day[], top_pages[], top_members[] }` |
| GET | `/workspaces/:id/analytics.csv?range=90d` | owner | text/csv stream |

All three accept the existing cookie + `X-WP-Nonce` auth pair. Member-grain endpoints reject with 403 if caller is `member` role.

## F. UI deliverables

- **Extension (Settings → Smart Share).** Quota label switches to `workspaceQuotaLabel` copy key, fed by `getWorkspaceQuota(workspaceId)`.
- **WP admin (Tools → Inspect Page Workspaces).** New "Analytics" tab on the workspace detail row. Recharts spark + two `<table>` widgets. CSV download button (owner-only).
- **Landing site (`src/components/landing/WhatsNew.tsx`).** Bumped to v2.8 with three bullets: workspace analytics, per-member leaderboard, CSV export.

## G. Out-of-band work

- Migration test: confirm backfill SQL runs cleanly on a site with 10k+ sessions (likely needs chunked update).
- Stripe metadata: continue attaching `workspace_id`; no change to webhook handler.
- Privacy: update `store/privacy.md` to mention per-member attribution stays inside the workspace and is never shared with Inspect Page itself.

## H. Acceptance (AC-WS-ANALYTICS-1…6)

1. **AC-WS-ANALYTICS-1.** Fresh install of v2.7.0 → v2.8.0 backfills `workspace_id` on every existing session row; zero rows left NULL.
2. **AC-WS-ANALYTICS-2.** Member creates a share → row's `workspace_id` = currently active workspace, not user's primary.
3. **AC-WS-ANALYTICS-3.** `GET /workspaces/:id/quota` returns pooled count; matches sum of member rows for that workspace.
4. **AC-WS-ANALYTICS-4.** `GET /workspaces/:id/analytics?range=7d` returns top_pages sorted by view count desc, top_members sorted by share count desc.
5. **AC-WS-ANALYTICS-5.** Member role calling `/analytics` → 403 `E_WS_ROLE_INSUFFICIENT`.
6. **AC-WS-ANALYTICS-6.** CSV export streams without buffering all rows in memory (verify on a workspace with 5k+ sessions).

## I. Risk / open questions

- Backfill on huge sites: prefer `LIMIT 1000` loop in PHP cron rather than one big UPDATE.
- Quota race: two members at the same `4/5 used` count both creating a share simultaneously — current code does `SELECT … FOR UPDATE` on the user row; need to switch to row-lock on the workspace row.
- Visitor hash scheme: confirm hashes remain stable across the rename from user-scope to workspace-scope (they should — hash inputs unchanged).

## J. Estimate

~5 working days for backend + analytics endpoints, ~2 days for WP admin UI, ~1 day for extension surfacing, ~1 day for CSV + privacy doc. Total ≈ 9 days + 2 days QA.

## K. Sequencing

1. Schema + backfill migration (gated behind plugin v2.7.0 activation hook).
2. `/workspaces/:id/quota` + extension Settings copy swap (smallest user-visible win).
3. `/workspaces/:id/analytics` JSON + WP admin Analytics tab.
4. CSV export.
5. Landing site `WhatsNew` bump + release notes.

Reply `next` after launch is live to start step 1.