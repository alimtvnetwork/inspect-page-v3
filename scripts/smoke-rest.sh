#!/usr/bin/env bash
# Phase 2 smoke test — exercise the Inspect Page WP REST API directly,
# without the Chrome extension. Proves the backend works end-to-end.
#
# Requirements:
#   - WP user with an Application Password (Users → Profile → Application Passwords)
#   - curl, jq
#
# Usage:
#   SITE=https://your-site.com USER=admin PASS='xxxx xxxx xxxx xxxx' \
#     bash scripts/smoke-rest.sh

set -euo pipefail

: "${SITE:?Set SITE=https://your-site.com}"
: "${USER:?Set USER=<wp-username>}"
: "${PASS:?Set PASS=<application-password>}"

NS="$SITE/wp-json/inspect-page/v1"
AUTH="-u $USER:$PASS"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "==> 1. Fetching nonce via /me"
ME=$(curl -fsS $AUTH "$NS/me")
echo "$ME" | jq .
NONCE=$(echo "$ME" | jq -r .nonce)
[ -n "$NONCE" ] && [ "$NONCE" != "null" ] || { echo "FAIL: no nonce returned"; exit 1; }

echo "==> 2. Creating fake session"
echo "<html><body><h1>smoke</h1></body></html>" > "$TMP/i.html"
echo "body{color:red}"                          > "$TMP/s.css"
echo "console.log('smoke');"                    > "$TMP/s.js"
# 1x1 PNG
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf\x00\x00\x00\x03\x00\x01\xc1\xa1Y\xab\x00\x00\x00\x00IEND\xaeB`\x82' > "$TMP/p.png"

RESP=$(curl -fsS $AUTH -H "X-WP-Nonce: $NONCE" \
  -F "kind=fullpage" \
  -F "source_url=https://example.com/smoke" \
  -F "html=@$TMP/i.html;type=text/html;filename=index.html" \
  -F "css=@$TMP/s.css;type=text/css;filename=style.css" \
  -F "js=@$TMP/s.js;type=application/javascript;filename=script.js" \
  -F "image=@$TMP/p.png;type=image/png;filename=preview.png" \
  "$NS/sessions")
echo "$RESP" | jq .
SID=$(echo "$RESP" | jq -r .session_id)

echo "==> 3. Verifying 4 public URLs return 200"
for slug in index.html style.css script.js preview.png; do
  CODE=$(curl -fsS -o /dev/null -w "%{http_code}" "$NS/share/$SID/$slug")
  echo "  $slug -> $CODE"
  [ "$CODE" = "200" ] || { echo "FAIL: $slug returned $CODE"; exit 1; }
done

echo "==> 4. Deleting session"
curl -fsS $AUTH -H "X-WP-Nonce: $NONCE" -X DELETE "$NS/sessions/$SID" | jq .

echo "==> 5. Verifying URLs now 404"
for slug in index.html style.css script.js preview.png; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$NS/share/$SID/$slug")
  echo "  $slug -> $CODE"
  [ "$CODE" = "404" ] || { echo "FAIL: $slug returned $CODE (expected 404)"; exit 1; }
done

echo
echo "✅ All smoke checks passed. Backend is healthy."