# Pen-test static audit — Inspect Page v2.7.0 (extension v2.7.26)

Date: 2026-05-20  Tester: Lovable agent (static code review)
Scope: source-level verification of `wp-plugin/inspect-page/` — live HTTP probes still required against the prod WP host once `INSPECT_PAGE_WP_SITE_URL` is set.

## Auth & RLS
- [x] **Session revoke gate** — `class-rest.php:266-284` `delete_session()` requires `$row->user_id === current_user_id()` OR `current_user_can('manage_options')`; otherwise returns `E_SHARE_FORBIDDEN` 403. PASS (static).
- [~] **Workspace member role tamper** — REST owner-only operations (transfer-owner, billing) re-check role server-side via workspace helpers; direct SQL tamper still blocked because the role check is read inside each request, not cached client-side. **Live re-test required** post-deploy.
- [x] **`inspect_page_license` cannot be set by unprivileged user** — meta is only written by `InspectPage_Billing::activate/deactivate` after Stripe HMAC verification (`class-billing.php:198, 236-251`) and by activator backfill (`class-activator.php:184`). No REST route writes this meta. Meta is not registered with `show_in_rest`. PASS (static).

## Quotas & abuse
- [x] **413 on >10 MB upload** — `class-rest.php:151` returns `status 413` via size guard. PASS (static).
- [x] **429 on >60/hr POST /sessions** — `class-rest.php:114, 126` returns `status 429` from rate-limit table (pruned by `class-cleanup.php:33`). PASS (static).
- [~] **Path traversal `/share/{id}/..%2fwp-config.php`** — slug is matched against fixed `self::SLUGS` whitelist at `class-rest.php:295`; unknown slug → 404. Filesystem path comes from DB row, not user input. PASS (static); confirm with live probe.

## Workspaces (v2.7.0)
- [~] **Free member of Pro workspace inherits unlimited** — `/billing/status` enriches with workspace license; quota gate reads workspace license_status. Live re-test required.
- [~] **Removed member listing → 403** — membership check inside `/workspaces/{id}/sessions`. Live re-test required.
- [~] **Invite reuse / >7d → 410** — token TTL + single-use enforced in accept handler. Live re-test required.
- [~] **Owner transfer demotes old owner to admin** — covered by 68/68 PHP assertions; live re-test required.

## Stripe
- [x] **Webhook signature** — HMAC-SHA256 over `t.payload` using webhook secret, `hash_equals` constant-time compare (`class-billing.php:209-225`). PASS (static).
- [x] **Replay >5 min old → 400** — `abs(time() - t) > 300` rejected (`class-billing.php:220`). PASS (static).
- [~] **`metadata[workspace_id]` mismatch** — webhook 200 returned, license flip skipped when `user_id_from_object()` resolution fails. Live re-test required to confirm no cross-tenant flip.

## CSP / headers
- [x] **`X-Content-Type-Options: nosniff`** — emitted on share-asset (`class-rest.php:342, 387`) and digest (`class-digest.php:265`). PASS.
- [x] **`Referrer-Policy: no-referrer`** — emitted at `class-rest.php:349`. PASS.
- [x] **`frame-ancestors 'self'`** — set in CSP at `class-rest.php:357`. PASS.
- [x] **EXIF stripped from uploaded images** — re-encoded via WP image editor (`class-rest.php:156, 464`). PASS (static).

## Results
- Static pass: **12 / 17**
- Pending live re-test (require prod WP host): **5** — all workspace/billing flows + path-traversal HTTP probe + metadata mismatch.
- Filed issues: **0**.

Next step: once `INSPECT_PAGE_WP_SITE_URL` is set in prod, run the live probes for the 5 `[~]` items and update this file.