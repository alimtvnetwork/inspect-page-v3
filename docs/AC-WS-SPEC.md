# AC-WS — Team Workspaces acceptance criteria (v2.7.0)

Authoritative list. Previously only referenced in `LIVE-MODE-RUNBOOK-v2.7.0.md:23` without definition.

- **AC-WS-1 Solo backfill** — On plugin activation, every existing WP user has exactly one workspace with role `owner`. Legacy `inspect_page_license=active` is copied to that workspace's `license_status`. Re-running activator is idempotent.
- **AC-WS-2 Create + switch** — Owner of solo workspace can create a second workspace from the WP admin (Tools → Inspect Page Workspaces) and from the extension WorkspacePicker; new workspace defaults role `owner`, `license_status=free`.
- **AC-WS-3 Invite (email + accept)** — Owner/admin invites a member by email. `wp_mail()` sends a 64-hex token link to `/wp-admin/admin.php?page=inspect-page-accept&token=…`. Recipient signed in → membership row created with the invited role; token marked used.
- **AC-WS-4 Invite expiry / replay** — Token older than 7 days → `410 Gone`. Token already accepted → `410 Gone`. Token with wrong workspace context → `404`.
- **AC-WS-5 Removal revokes access** — Owner/admin removes a member. Removed user's listings of that workspace's sessions return `403`; their `/billing/status?workspace_id=N` no longer includes it.
- **AC-WS-6 License inheritance** — Free member of a workspace whose `license_status=active` gets unlimited Smart Shares against that workspace (quota gate reads workspace, not user meta). Switching workspaces in the picker flips the quota chip accordingly.
- **AC-WS-7 Owner transfer** — Owner transfers ownership to another member. New owner gains owner role + billing privileges; old owner is demoted to `admin`. Single-owner invariant preserved (one and only one `owner` per workspace at all times).

## Static code/test backing

| AC | Code / test |
|----|-------------|
| WS-1 | `wp-plugin/inspect-page/includes/class-activator.php` (backfill loop + license copy); covered by activator assertion in PHP suite (68/68). |
| WS-2 | `class-rest.php` `POST /workspaces`; `panel/WorkspacePicker.tsx` (create-workspace path). |
| WS-3 | `class-rest.php` `POST /workspaces/{id}/invites` + `/workspaces/accept`; `wp_mail()` template; admin landing `page=inspect-page-accept`. |
| WS-4 | Accept handler checks `created_at + 7d`, `used_at IS NULL`, workspace match → 410/404. |
| WS-5 | Member-only middleware on `/workspaces/{id}/sessions` returns `E_SHARE_FORBIDDEN` 403 when membership row missing. |
| WS-6 | Quota gate reads `workspaces.license_status` (and falls back to legacy user meta for solo workspaces) before emitting `402 E_SHARE_QUOTA_FREE`. |
| WS-7 | `POST /workspaces/{id}/transfer-owner` owner-gated; atomic swap of role rows; PHP test asserts single-owner invariant. |

## Live re-test

All 7 ACs need a live WP host (currently blocked on `INSPECT_PAGE_WP_SITE_URL`). Once set, run the smoke runbook (`bash scripts/smoke-runbook.sh`) which exercises WS-1..7 end-to-end.