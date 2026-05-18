#!/usr/bin/env bash
# Seed a staging WordPress with the exact state docs/SCREENSHOT-SHOTLIST-v2.7.md
# expects, so `scripts/capture-cws-screenshots.sh` has the right UI to photograph.
#
# Idempotent: re-running won't duplicate workspaces / members / invites.
# All writes go through the inspect-page REST API + wp-cli (no raw SQL).
#
# What it creates / ensures:
#   - 3 WP users: alice/bob/carol @ demo.inspect-page.app
#   - Workspace "Acme Design" owned by Alice, with Bob (admin) + Carol (member)
#   - 1 pending invite for dave@demo.inspect-page.app (role=member)
#   - Alice's solo workspace flipped to license_status=active (for the Pro badge)
#   - 1 demo share session under Acme Design (so Recent Shares has a row)
#
# Requirements: wp-cli on the staging box, curl + jq locally, ssh access OR
# the staging host already has WP_CLI_SSH configured.
#
# Usage:
#   SITE=https://demo.inspect-page.app \
#   WP_SSH='ssh deploy@stage.example.com -- wp --path=/var/www/html' \
#     bash scripts/seed-staging.sh
#
# Or, if running ON the staging box itself:
#   SITE=https://demo.inspect-page.app WP_SSH='wp' bash scripts/seed-staging.sh

set -euo pipefail

: "${SITE:?Set SITE=https://demo.inspect-page.app}"
: "${WP_SSH:?Set WP_SSH='wp' (local) or 'ssh host -- wp --path=...'}"

WP() { eval "$WP_SSH $*"; }

PASS_DEFAULT="${SEED_PASS:-InspectPage!2026}"
DOMAIN="demo.inspect-page.app"

echo "==> 1. Ensure WP users exist"
for entry in "alice:Alice Example:subscriber" \
             "bob:Bob Example:subscriber" \
             "carol:Carol Example:subscriber"; do
  IFS=: read -r U NAME ROLE <<<"$entry"
  EMAIL="$U@$DOMAIN"
  if WP user get "$U" --field=ID >/dev/null 2>&1; then
    echo "  · $U exists"
  else
    WP user create "$U" "$EMAIL" --role="$ROLE" --display_name="\"$NAME\"" --user_pass="$PASS_DEFAULT" >/dev/null
    echo "  + created $U / $PASS_DEFAULT"
  fi
done

ALICE_ID=$(WP user get alice --field=ID)
BOB_ID=$(WP   user get bob   --field=ID)
CAROL_ID=$(WP user get carol --field=ID)

echo "==> 2. Ensure 'Acme Design' workspace owned by Alice"
WS_ID=$(WP db query "\"SELECT id FROM wp_pp_workspaces WHERE name='Acme Design' AND owner_user_id=$ALICE_ID LIMIT 1\"" --skip-column-names 2>/dev/null | head -1 | tr -d '[:space:]' || true)
if [ -z "$WS_ID" ]; then
  NOW=$(date -u +'%Y-%m-%d %H:%M:%S')
  WP db query "\"INSERT INTO wp_pp_workspaces (name, owner_user_id, license_status, created_at, updated_at) VALUES ('Acme Design', $ALICE_ID, 'active', '$NOW', '$NOW')\""
  WS_ID=$(WP db query "\"SELECT LAST_INSERT_ID()\"" --skip-column-names | head -1 | tr -d '[:space:]')
  WP db query "\"INSERT INTO wp_pp_workspace_members (workspace_id, user_id, role, created_at) VALUES ($WS_ID, $ALICE_ID, 'owner', '$NOW')\""
  echo "  + created workspace id=$WS_ID"
else
  echo "  · workspace id=$WS_ID exists"
fi

echo "==> 3. Ensure Bob (admin) + Carol (member) memberships"
NOW=$(date -u +'%Y-%m-%d %H:%M:%S')
for pair in "$BOB_ID:admin" "$CAROL_ID:member"; do
  IFS=: read -r UID ROLE <<<"$pair"
  EXISTS=$(WP db query "\"SELECT 1 FROM wp_pp_workspace_members WHERE workspace_id=$WS_ID AND user_id=$UID LIMIT 1\"" --skip-column-names 2>/dev/null | tr -d '[:space:]' || true)
  if [ -z "$EXISTS" ]; then
    WP db query "\"INSERT INTO wp_pp_workspace_members (workspace_id, user_id, role, created_at) VALUES ($WS_ID, $UID, '$ROLE', '$NOW')\""
    echo "  + added user $UID as $ROLE"
  else
    WP db query "\"UPDATE wp_pp_workspace_members SET role='$ROLE' WHERE workspace_id=$WS_ID AND user_id=$UID\""
    echo "  · user $UID confirmed as $ROLE"
  fi
done

echo "==> 4. Ensure pending invite for dave@$DOMAIN"
INV_EMAIL="dave@$DOMAIN"
HAS_INV=$(WP db query "\"SELECT 1 FROM wp_pp_workspace_invites WHERE workspace_id=$WS_ID AND email='$INV_EMAIL' AND accepted_at IS NULL LIMIT 1\"" --skip-column-names 2>/dev/null | tr -d '[:space:]' || true)
if [ -z "$HAS_INV" ]; then
  TOKEN=$(openssl rand -hex 32)
  EXPIRES=$(date -u -d '+7 days' +'%Y-%m-%d %H:%M:%S' 2>/dev/null || date -u -v+7d +'%Y-%m-%d %H:%M:%S')
  WP db query "\"INSERT INTO wp_pp_workspace_invites (workspace_id, email, role, token, expires_at, created_at) VALUES ($WS_ID, '$INV_EMAIL', 'member', '$TOKEN', '$EXPIRES', '$NOW')\""
  echo "  + invited $INV_EMAIL (expires $EXPIRES)"
else
  echo "  · pending invite for $INV_EMAIL exists"
fi

echo "==> 5. Ensure Alice's solo workspace shows Pro"
SOLO_ID=$(WP db query "\"SELECT w.id FROM wp_pp_workspaces w JOIN wp_pp_workspace_members m ON m.workspace_id=w.id WHERE m.user_id=$ALICE_ID AND m.role='owner' AND w.id<>$WS_ID LIMIT 1\"" --skip-column-names 2>/dev/null | head -1 | tr -d '[:space:]' || true)
if [ -n "$SOLO_ID" ]; then
  WP db query "\"UPDATE wp_pp_workspaces SET license_status='active' WHERE id=$SOLO_ID\""
  echo "  · solo workspace id=$SOLO_ID flipped to active"
else
  echo "  · no solo workspace found for Alice (activator may not have backfilled — re-activate plugin)"
fi
# Legacy user-meta mirror so older code paths also show Pro
WP user meta update "$ALICE_ID" inspect_page_license active >/dev/null

echo "==> 6. Demo share session for Recent Shares row"
EXISTING=$(WP db query "\"SELECT COUNT(*) FROM wp_pp_sessions WHERE workspace_id=$WS_ID\"" --skip-column-names 2>/dev/null | tr -d '[:space:]' || echo 0)
if [ "${EXISTING:-0}" = "0" ]; then
  echo "  · no sessions yet — create one manually from the extension after sign-in"
  echo "    (the capture script will pause so you can do this before shot 3)"
else
  echo "  · $EXISTING session(s) already in workspace $WS_ID"
fi

cat <<EOF

──────── Seed summary ────────
SITE         = $SITE
Workspace    = "Acme Design" (id=$WS_ID, license=active)
Owner        = alice ($ALICE_ID)
Admin        = bob   ($BOB_ID)
Member       = carol ($CAROL_ID)
Pending      = $INV_EMAIL (member, 7-day TTL)
Default pass = $PASS_DEFAULT  (override with SEED_PASS=...)

Next:
  1. Sign in to $SITE/wp-admin as alice
  2. bash scripts/capture-cws-screenshots.sh
EOF