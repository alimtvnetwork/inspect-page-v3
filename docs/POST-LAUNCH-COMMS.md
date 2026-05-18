# Post-Launch Comms — v2.7.0 Team Workspaces

Ready-to-send copy for the moment the Chrome Web Store listing flips public. Each block is self-contained — copy, paste, send.

---

## 1. Chrome Web Store listing — "What's new"

Paste into the **What's new in this version** field on the CWS publish form. 200 char budget; this is 187.

> Team Workspaces. Invite teammates by email, share one Pro subscription, switch workspaces from the popup. Existing solo users auto-upgrade — every old share link keeps working.

---

## 2. Twitter / X thread (3 posts)

**Post 1 — hook**
> Inspect Page v2.7.0 is out 🎉
>
> Team Workspaces are here. Invite your design / eng / PM teammates, share one Pro license, ship faster.
>
> Free for solo users. Pooled quota for teams.
>
> [link to chrome web store]

**Post 2 — proof**
> What's in the box:
> • Owner / admin / member roles
> • Email invites (single-use, 7-day TTL)
> • Per-workspace billing — Stripe Checkout attaches to the active workspace
> • Workspace picker in the popup with role + license badges
> • Transfer ownership without losing history

**Post 3 — migration reassurance**
> Already on Inspect Page? Nothing to do.
>
> The plugin update auto-migrates every existing user into a personal workspace, your Pro license follows you, and every share link you created keeps working.
>
> Just reload the extension.

---

## 3. Customer email (existing Pro users)

Subject: **Inspect Page v2.7 — your Pro now covers your whole team**

> Hi {first_name},
>
> Quick heads-up: Inspect Page v2.7 ships Team Workspaces. Your Pro subscription now covers everyone you invite into your workspace — no per-seat upgrade.
>
> **What changed for you**
> • You were auto-migrated into a personal workspace on plugin update.
> • Your share quota stays unlimited (Pro).
> • Every share link you created before today still works.
>
> **What's new**
> • Invite teammates by email — they accept and drop straight into your workspace.
> • Switch workspaces from the popup header (the workspace chip next to "Inspect Page").
> • Owners and admins can manage members in WP admin → Tools → Inspect Page Workspaces.
>
> **One small ask**
> Reload the extension once (chrome://extensions → reload) so the new popup picks up the workspace UI.
>
> Questions? Just reply to this email.
>
> — {your_name}
> Inspect Page

---

## 4. WP admin upgrade notice (in-app banner)

Shown once on first admin page load post-update. Dismissible. Lives in `class-admin.php` as `admin_notices` hook.

> **Inspect Page is now v2.7 — Team Workspaces.** Your account was migrated into a personal workspace. Invite teammates from **Tools → Inspect Page Workspaces** to share your Pro subscription. [Dismiss]

---

## 5. Changelog blurb (for `CHANGELOG.md`)

```
## [2.7.0] — 2026-05-18

### Added
- **Team Workspaces.** Owner / admin / member roles, email invites (7-day single-use tokens), transfer ownership.
- **Per-workspace billing.** Stripe Checkout + Customer Portal attach to the active workspace. One Pro license covers every member.
- **Workspace picker in popup.** Chip in the header opens a dialog with role + license badges and a "Manage in WordPress" deep-link.
- **WP admin → Tools → Inspect Page Workspaces.** Switcher, create workspace, members + invites tables.

### Migration
- Plugin activation auto-creates a personal workspace for every existing user and copies their Pro license to it. Existing share links are unaffected.

### Internal
- New tables: `wp_pp_workspaces`, `wp_pp_workspace_members`, `wp_pp_workspace_invites`.
- New REST: `/workspaces*`, `/workspaces/accept`, admin-only invite CRUD, transfer-owner.
- `/billing/checkout` and `/billing/portal` accept `workspace_id`.
- Webhook flips `workspaces.license_status` and keeps legacy user-meta in parallel for back-compat.
- 201/201 vitest, 68/68 PHP assertions.
```

---

## Sequencing

1. CWS listing goes public.
2. Wait ~15 min for review propagation.
3. Post Twitter thread (queue #2 and #3 with 30-min gaps).
4. Send customer email (Pro users only).
5. Push WP admin banner via WP plugin v2.6.1 hotfix point release (optional — banner code already written, gated by `get_option('inspect_page_v27_announced')`).
6. Update `CHANGELOG.md` blurb above and commit on `main`.