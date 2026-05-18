# Pen-test checklist — Inspect Page v2.7.0

Run before flipping CWS listing to Public. Document the result inline.

## Auth & RLS
- [ ] Revoke another user's session (DELETE `/sessions/{id}` as a different WP user) → expect `403`.
- [ ] Tamper `wp_pp_workspace_members.role` via SQL to grant `owner` to a member → confirm REST still enforces owner gate on transfer-owner / billing.
- [ ] `inspect_page_license` cannot be set by an unprivileged user via REST or profile edit.

## Quotas & abuse
- [ ] Upload > 10 MB file → `413`.
- [ ] Hammer `POST /sessions` (>60/hr) → `429`.
- [ ] Path traversal in slug `/share/{id}/..%2fwp-config.php` → `400/404`, never serves filesystem.

## Workspaces (new in v2.7.0)
- [ ] Free member of a workspace whose owner is Pro → unlimited shares (license inherits from workspace).
- [ ] Removed member can no longer list workspace sessions → `403`.
- [ ] Invite token reused after acceptance → `410 Gone`.
- [ ] Invite token > 7 days old → `410 Gone`.
- [ ] Owner transfer: new owner gains billing, old owner downgraded to admin.

## Stripe
- [ ] Replay webhook with tampered body → `403`.
- [ ] Replay webhook > 5 min old timestamp → `400`.
- [ ] `metadata[workspace_id]` mismatch with customer → webhook 200 but no license flip.

## CSP / headers
- [ ] Every shared asset response has `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `frame-ancestors 'self'`.
- [ ] EXIF stripped from uploaded PNG/JPEG screenshots.

## Results
Date: ____  Tester: ____  Pass count: __/__  Filed issues: __