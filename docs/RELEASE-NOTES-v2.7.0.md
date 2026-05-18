# Inspect Page — v2.7.0 (extension) + v2.6.0 (WordPress plugin)

**Team Workspaces.** Inspect Page is no longer single-user. Every WordPress
user belongs to at least one workspace, and Pro subscriptions are now
attached to workspaces — not individuals. Invite teammates, share a single
license, transfer ownership without losing data.

## Highlights

- **Workspaces are first-class.** New tables `wp_pp_workspaces`,
  `wp_pp_workspace_members`, `wp_pp_workspace_invites`. Existing users are
  auto-backfilled into a solo workspace on plugin activation; their legacy
  `inspect_page_license = active` user-meta is copied to
  `workspaces.license_status` so no one loses Pro.
- **Roles.** `owner`, `admin`, `member`. Admin+ can invite, revoke, remove
  members and start checkout / open the Stripe portal. Owners can transfer
  ownership.
- **Invite flow.** Admin-only `POST /workspaces/{id}/invites` issues a
  64-hex single-use token, `wp_mail()`'s it to the invitee, and expires in
  7 days. Recipients land on a hidden `inspect-page-accept` admin page
  that calls `POST /workspaces/accept` after WordPress sign-in.
- **Workspace dashboard.** Tools → *Inspect Page Workspaces* — switcher,
  create form, members table (remove + make-owner), invite form with role
  picker, pending-invites table with revoke.
- **Billing port.** Stripe Checkout and Customer Portal both carry
  `metadata[workspace_id]`. The webhook flips `workspaces.license_status`
  to `active` / `past_due` / `canceled` (and still updates legacy user-meta
  in parallel for back-compat). `GET /billing/status` now returns a
  `workspace` block alongside the legacy top-level fields.
- **Extension data layer.** `getBillingStatus`, `startBillingCheckout`,
  `startBillingPortal` all accept an optional `workspaceId`. New
  `listWorkspaces()` helper with graceful 404 fallback for older plugins.

## REST changes

```
GET    /inspect-page/v1/workspaces
POST   /inspect-page/v1/workspaces                          { name }
GET    /inspect-page/v1/workspaces/{id}
DELETE /inspect-page/v1/workspaces/{id}/members/{user_id}
POST   /inspect-page/v1/workspaces/{id}/transfer-owner      { user_id }
GET    /inspect-page/v1/workspaces/{id}/invites
POST   /inspect-page/v1/workspaces/{id}/invites             { email, role }
DELETE /inspect-page/v1/workspaces/{id}/invites/{invite_id}
POST   /inspect-page/v1/workspaces/accept                   { token }
```

`POST /billing/checkout` and `POST /billing/portal` accept an optional
`workspace_id`; default = the caller's primary workspace.
`GET /billing/status?workspace_id=N` returns a `workspace` block.

## Compatibility

- Old extensions (≤ v2.6.x) keep working — legacy per-user license fields
  on `/billing/status` are preserved and the webhook still updates
  user-meta in parallel.
- Plugin activation is idempotent — re-activating only creates missing
  solo workspaces; existing memberships are left alone.

## Tests

- WP plugin: **68/68** PHP assertions (workspaces, invites, billing
  helpers).
- Extension: **201/201** vitest (+7 new — `listWorkspaces`, workspace
  block parsing in `getBillingStatus`, `workspace_id` forwarding in
  `startBillingCheckout` / `startBillingPortal`).

## Carry-over (not in this release)

Polished `WorkspacePicker` modal in the extension popup and Recent Shares
workspace filter are scheduled for a follow-up minor — the data layer
that those screens consume is already shipped here.
