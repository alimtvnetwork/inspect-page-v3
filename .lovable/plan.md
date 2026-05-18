
# Plan — Team Workspaces (WP plugin v2.6.0 + extension v2.7.0)

Goal: let a Pro user invite teammates so they share one workspace's billing, quota, and Recent Shares list. Today every WP user is their own quota silo — teams have no shared upgrade path.

## 1. Data model (WP plugin)

New tables (prefix `{$wpdb->prefix}inspect_page_`):

- `workspaces` — `id`, `name`, `owner_user_id`, `license_status enum('free','active','past_due','canceled')`, `stripe_customer_id`, `stripe_subscription_id`, `created_at`.
- `workspace_members` — `workspace_id`, `user_id`, `role enum('owner','admin','member')`, `joined_at`, PK `(workspace_id, user_id)`.
- `workspace_invites` — `id`, `workspace_id`, `email`, `role`, `token` (32-byte hex), `invited_by_user_id`, `expires_at` (7 days), `accepted_at NULL`.

Schema migration in `class-activator.php` via `dbDelta`. Backfill on activate: every existing user gets a solo workspace (`name = "{display_name}'s workspace"`, role `owner`, `license_status` copied from their `inspect_page_license` user-meta).

Sessions/shares keep `user_id` (for audit) and gain `workspace_id` (indexed). Quota counters move from per-user to per-workspace.

## 2. REST surface (`inspect-page/v1`)

All routes cookie+nonce-authed and scoped to the caller's current workspace.

- `GET  /workspaces` — list workspaces the user belongs to + role.
- `POST /workspaces` — create (free tier defaults).
- `GET  /workspaces/{id}` — detail (members + invites if admin).
- `POST /workspaces/{id}/invites` — admin/owner only; emails token-link.
- `POST /workspaces/accept` — `{token}` → adds caller as member, marks invite accepted.
- `DELETE /workspaces/{id}/members/{user_id}` — admin/owner only; owner cannot be removed.
- `POST /workspaces/{id}/transfer-owner` — owner → other admin.
- `GET  /billing/status` — extended to `{workspace, license, price, quota}` (workspace block: `{id, name, role, member_count}`).
- `POST /billing/checkout` + `/billing/portal` — now keyed off `workspace_id` (Stripe `client_reference_id = workspace:{id}`); webhook flips `workspaces.license_status` instead of user meta.
- All quota gates (`sessions`, `uploads`, share-count → `402 E_SHARE_QUOTA_FREE`) read from `workspaces.license_status` of the caller's active workspace.

Backward compat: legacy user-meta `inspect_page_license` kept as read-only mirror so older extension builds keep working until 2.7.0 ships.

## 3. Admin UI (WP plugin)

New top-level tab in the existing plugin dashboard: **Workspace**.

- Header: workspace name (inline editable, owner only), plan chip (Free / Pro), member count.
- Members table: avatar, display name, email, role, "joined" date, row actions (change role, remove, transfer ownership).
- Invites panel: pending invites with copy-link + revoke; "Invite teammate" form (email + role).
- Billing card: re-uses existing Stripe Checkout / Customer Portal buttons but now upgrades the *workspace*.
- Workspace switcher in the top-right of every plugin admin page when the user belongs to >1 workspace.
- All capability checks via `current_user_can('read')` + workspace-role check helper `inspect_page_user_role_in($workspace_id, $user_id)`.

## 4. Extension surfacing (v2.7.0)

- Settings → Smart Share now reads `billing.workspace` and renders the workspace name + role under the Sign in/Sign out row.
- "Free shares used: X / 5" copy becomes "{workspace_name} — Free X / 5" or "{workspace_name} — Pro · unlimited".
- New `WorkspacePicker` modal triggered from the workspace chip when the user has >1 workspace; POSTs to `/billing/status?workspace_id=…` and stores the selected workspace id in `chrome.storage.local`.
- "Upgrade to Pro" button now reads "Upgrade workspace to Pro" and the Stripe Checkout `client_reference_id` carries the workspace id.
- Recent Shares list filters server-side by active workspace.
- All new copy uses the Blueprint primitives (`.lpe-card`, `.lpe-pill-btn`, `.lpe-chip`) — no design changes needed.

## 5. Invite email + accept flow

- Invite email is sent via `wp_mail()` with a templated body containing the accept URL `https://{wp_site}/wp-admin/admin.php?page=inspect-page-workspace-accept&token={token}`.
- The accept page is a tiny admin screen that auto-calls `POST /workspaces/accept`, then redirects to the workspace dashboard.
- If the invitee is not yet a WP user, they hit the WP registration screen first (open registration is already ON per memory), then are bounced back through the accept URL.
- Tokens are single-use, scoped by email match (case-insensitive), and expire after 7 days.

## 6. Quota math changes

| Item | v2.5.x (per-user) | v2.6.0 (per-workspace) |
|------|-------------------|------------------------|
| Lifetime free shares | 5 | 5 (shared across all members) |
| Active sessions | 30 | 30 × workspace plan multiplier (1 free, 5 pro) |
| Uploads / hour | 60 | 60 × multiplier |
| License flip | user meta `inspect_page_license` | `workspaces.license_status` |

Quota errors gain `workspace_id` + `workspace_role` in the JSON body so the extension can render "Ask {owner_display_name} to upgrade".

## 7. Tests

- `tests/test-workspaces.php` — schema migration, backfill, role checks.
- `tests/test-invites.php` — invite create / accept / expire / revoke / wrong-email.
- `tests/test-billing-workspace.php` — Stripe webhook flips workspace, not user.
- `tests/test-quota-workspace.php` — quota counters sum across members.
- Extension: `WorkspacePicker.test.tsx`, `BillingPanel.workspace.test.tsx`, update `formatBillingPriceTagline.test.ts` for workspace-name interpolation.

Target: keep WP PHPUnit green and lift extension vitest from 194 → ~210.

## 8. Phases

- **W1 — Schema + backfill + REST `/workspaces*`** (WP only, no UI). Includes activator migration, role-check helper, PHPUnit tests.
- **W2 — Invite flow** (REST + accept admin page + wp_mail template + tests).
- **W3 — Admin UI tab** (Workspace dashboard + switcher + member/invite tables).
- **W4 — Billing port to workspaces** (`/billing/*` keyed off workspace_id, webhook flips workspace, `/billing/status` returns workspace block).
- **W5 — Extension v2.7.0** (`WorkspacePicker`, `BillingPanel` updates, copy changes, Recent Shares filter).
- **W6 — QA + release** (PHPUnit + vitest green, repackage both zips + sha256, `docs/RELEASE-NOTES-v2.7.0.md` for extension and `wp-v2.6.0` for plugin, update memory).

Each phase is independently shippable behind a `inspect_page_feature_workspaces` option (default ON after W4 lands so older extensions don't break).

## 9. Out of scope

- SSO / SAML / SCIM — workspaces use plain WP users.
- Per-workspace branding / custom domains.
- Workspace-level audit log (logged separately via existing telemetry).
- Migration of historical sessions to a non-owner workspace — sessions stay attributed to their original user; the workspace_id column lets us filter forward only.

## 10. Risks

- Backfill on activate must be idempotent (re-run after plugin update should not duplicate workspaces).
- Stripe subscription objects created under the old per-user model need a one-shot migration script (`scripts/migrate-stripe-subscriptions-to-workspaces.php`) — runs after W4, requires Stripe API key.
- `client_reference_id` change on Checkout means in-flight checkout sessions started before the upgrade will still credit the user; we accept that and document it in the release notes.

## Remaining tasks (carry-over, post-Blueprint)

1. ⏳ Prod `INSPECT_PAGE_WP_SITE_URL` (needs URL)
2. Stripe live keys + price + webhook secret
3. Pen-tests
4. AC-BILL-1…5 + AC-ANALYTICS + AC-UI-259 manual walk
5. Chrome Web Store upload of v2.6.3 zip
6. Re-shoot CWS screenshots (Blueprint light-mint theme)
7. Git tags `ext-v2.6.3` + `wp-v2.5.5`
8. Team Workspaces — phases W1–W6 above (this plan)

Reply `next` to execute Phase W1 (schema + backfill + `/workspaces*` REST + PHPUnit). Or pick a different carry-over item.
