# Inspect Page — Pre-launch pen-test script (v2.7.0 / WP 2.6.0)

Last updated: 18 May 2026 · Covers `wp-plugin/inspect-page` v2.6.0 +
extension v2.7.0. Run against a **throwaway staging WordPress** with
permalinks set to `Post name`. Treat any **PASS criterion that fails**
as a launch-blocker.

## 0. Setup

```bash
# Variables (edit me)
export SITE=https://stage.inspect-page.app
export OWNER_USER=alice  OWNER_PASS=...          # workspace owner
export MEMBER_USER=carol MEMBER_PASS=...         # workspace member
export OTHER_USER=mallory OTHER_PASS=...         # outsider (separate workspace)
export STRIPE_WHSEC=whsec_test_...               # the staging webhook secret
export COOKIE_JAR=/tmp/ip-cookies.txt
rm -f "$COOKIE_JAR"

# Helper: log in as $1/$2, capture cookie + REST nonce into env
ip_login() {
  curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -d "log=$1&pwd=$2&wp-submit=Log+In&redirect_to=$SITE/wp-admin/&testcookie=1" \
    "$SITE/wp-login.php" >/dev/null
  NONCE=$(curl -s -b "$COOKIE_JAR" \
    "$SITE/wp-admin/admin-ajax.php?action=rest-nonce")
  export NONCE
  echo "Logged in as $1 — nonce=$NONCE"
}
```

For each test record: **PASS / FAIL**, the HTTP status, and a 1-line note.

---

## 1. Revoke another user's session (E_SHARE_FORBIDDEN)

```bash
ip_login "$OWNER_USER" "$OWNER_PASS"
SID_OWNER=$(curl -s -b "$COOKIE_JAR" -H "X-WP-Nonce: $NONCE" \
  -X POST "$SITE/wp-json/inspect-page/v1/sessions" \
  -F "html=@/tmp/index.html;type=text/html" \
  -F "css=@/tmp/style.css;type=text/css" \
  -F "js=@/tmp/script.js;type=application/javascript" \
  -F "image=@/tmp/preview.png;type=image/png" \
  -F "source_url=https://example.com" | jq -r .session_id)

ip_login "$MEMBER_USER" "$MEMBER_PASS"   # different WP user, different workspace
curl -i -b "$COOKIE_JAR" -H "X-WP-Nonce: $NONCE" \
  -X DELETE "$SITE/wp-json/inspect-page/v1/sessions/$SID_OWNER"
```

- **PASS** if response is `403` with `code: "E_SHARE_FORBIDDEN"` and
  the original 4 share URLs still resolve `200`.
- **FAIL** if the DELETE returns `200/204` or any 5xx.

## 2. Oversize upload (E_SHARE_TOO_LARGE)

```bash
dd if=/dev/urandom of=/tmp/big.png bs=1M count=12  # 12 MB > 10 MB cap
ip_login "$OWNER_USER" "$OWNER_PASS"
curl -i -b "$COOKIE_JAR" -H "X-WP-Nonce: $NONCE" \
  -X POST "$SITE/wp-json/inspect-page/v1/sessions" \
  -F "image=@/tmp/big.png;type=image/png" \
  -F "html=@/tmp/index.html"  -F "css=@/tmp/style.css" \
  -F "js=@/tmp/script.js"     -F "source_url=https://example.com"
```

- **PASS** if status is `413` with `code: "E_SHARE_TOO_LARGE"` and no
  row appears in `wp_pp_sessions`.

## 3. POST /sessions flood → 429 (E_SHARE_QUOTA_HOURLY)

```bash
ip_login "$OWNER_USER" "$OWNER_PASS"
for i in $(seq 1 65); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -b "$COOKIE_JAR" -H "X-WP-Nonce: $NONCE" \
    -X POST "$SITE/wp-json/inspect-page/v1/sessions" \
    -F "html=@/tmp/index.html" -F "css=@/tmp/style.css" \
    -F "js=@/tmp/script.js" -F "image=@/tmp/preview.png" \
    -F "source_url=https://example.com"
done | sort | uniq -c
```

- **PASS** if the first ≤60 return `201` and the remainder return
  `429` with `code: "E_SHARE_QUOTA_HOURLY"` (`Retry-After` header set).

## 4. Path traversal in slug

```bash
SID=$(curl -s -b "$COOKIE_JAR" -H "X-WP-Nonce: $NONCE" \
  -X POST "$SITE/wp-json/inspect-page/v1/sessions" \
  -F "html=@/tmp/index.html" -F "css=@/tmp/style.css" \
  -F "js=@/tmp/script.js" -F "image=@/tmp/preview.png" \
  -F "source_url=https://example.com" | jq -r .session_id)

for path in \
  "../../../wp-config.php" \
  "..%2F..%2F..%2Fwp-config.php" \
  "%2e%2e%2f%2e%2e%2fwp-config.php" \
  "index.html/../../../wp-config.php"; do
  curl -s -o /dev/null -w "$path -> %{http_code}\n" \
    "$SITE/wp-json/inspect-page/v1/share/$SID/$path"
done
```

- **PASS** if every variant returns `404` (or `400`) and **no**
  response body contains `define('DB_`. The realpath check in
  `read_asset` must hold.

## 5. Webhook tamper + replay

```bash
# 5a. Valid signed event
PAYLOAD='{"id":"evt_test","type":"customer.subscription.updated","data":{"object":{"id":"sub_X","status":"active","metadata":{"workspace_id":"1"}}}}'
TS=$(date +%s)
SIG=$(printf "%s.%s" "$TS" "$PAYLOAD" | openssl dgst -sha256 -hmac "$STRIPE_WHSEC" -hex | awk '{print $2}')
curl -i -X POST "$SITE/wp-json/inspect-page/v1/billing/webhook" \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=$TS,v1=$SIG" \
  --data-raw "$PAYLOAD"      # expect 200

# 5b. Tamper body, same signature
curl -i -X POST "$SITE/wp-json/inspect-page/v1/billing/webhook" \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=$TS,v1=$SIG" \
  --data-raw "${PAYLOAD/active/canceled}"   # expect 403

# 5c. Stale timestamp (>5 min)
OLD_TS=$(( $(date +%s) - 600 ))
OLD_SIG=$(printf "%s.%s" "$OLD_TS" "$PAYLOAD" | openssl dgst -sha256 -hmac "$STRIPE_WHSEC" -hex | awk '{print $2}')
curl -i -X POST "$SITE/wp-json/inspect-page/v1/billing/webhook" \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=$OLD_TS,v1=$OLD_SIG" \
  --data-raw "$PAYLOAD"      # expect 400
```

- **PASS** if 5a=`200`, 5b=`403`, 5c=`400`. Re-check
  `wp_pp_workspaces` row 1 — `license_status` should be `active`
  (only 5a wrote).

## 6. Unprivileged license escalation

```bash
ip_login "$MEMBER_USER" "$MEMBER_PASS"   # role: subscriber
# 6a. REST user-meta poke
curl -i -b "$COOKIE_JAR" -H "X-WP-Nonce: $NONCE" \
  -X POST -H "Content-Type: application/json" \
  -d '{"meta":{"inspect_page_license":"active"}}' \
  "$SITE/wp-json/wp/v2/users/me"
# 6b. Billing portal as member of someone else's workspace
curl -i -b "$COOKIE_JAR" -H "X-WP-Nonce: $NONCE" \
  -X POST "$SITE/wp-json/inspect-page/v1/billing/portal?workspace_id=1"
```

- **PASS** if 6a returns `403` (or `200` with the meta field absent
  from the response — never persisted) **and**
  `get_user_meta($MEMBER_USER_ID,'inspect_page_license',true)` is
  still empty in `wp shell`. 6b must be `403` (member can't open the
  portal on a workspace they don't own/admin).

## 7. Cross-workspace invite leakage (Team Workspaces only)

```bash
ip_login "$OWNER_USER" "$OWNER_PASS"
TOKEN=$(curl -s -b "$COOKIE_JAR" -H "X-WP-Nonce: $NONCE" \
  -X POST "$SITE/wp-json/inspect-page/v1/workspaces/1/invites" \
  -H "Content-Type: application/json" \
  -d '{"email":"dave@example.com","role":"member"}' | jq -r .token)

ip_login "$OTHER_USER" "$OTHER_PASS"  # outsider with a different email
curl -i -b "$COOKIE_JAR" -H "X-WP-Nonce: $NONCE" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\"}" \
  "$SITE/wp-json/inspect-page/v1/workspaces/accept"
```

- **PASS** if response is `403` (email mismatch) and Mallory is
  **not** in `wp_pp_workspace_members` for workspace 1.

## 8. Member → admin self-promotion

```bash
ip_login "$MEMBER_USER" "$MEMBER_PASS"
curl -i -b "$COOKIE_JAR" -H "X-WP-Nonce: $NONCE" \
  -X PATCH -H "Content-Type: application/json" \
  -d '{"role":"admin"}' \
  "$SITE/wp-json/inspect-page/v1/workspaces/1/members/$CAROL_ID"
```

- **PASS** if `403`. Members must not be able to change their own or
  any other member's role.

## 9. Asset response hardening (re-verify §1 ticks)

```bash
SID=$(curl ... )   # any active session id
for kind in index.html style.css script.js preview.png; do
  curl -sI "$SITE/wp-json/inspect-page/v1/share/$SID/$kind" \
    | grep -iE "content-security-policy|x-content-type-options|referrer-policy|permissions-policy|x-frame-options"
done
```

- **PASS** if every kind shows `CSP: default-src 'none'`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `Permissions-Policy:` (any), and either
  `Content-Security-Policy: frame-ancestors 'self'` or
  `X-Frame-Options: SAMEORIGIN`.

---

## Reporting

For each numbered test, record `PASS / FAIL · status · note` in the
PR/launch issue. Any **FAIL** blocks the v2.7.0 / v2.6.0 Chrome Web
Store upload; file a fix-forward issue tagged `security` first.
