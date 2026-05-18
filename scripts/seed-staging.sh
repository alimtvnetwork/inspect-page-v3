#!/usr/bin/env bash
# seed-staging.sh — seed a staging WP with two users (free + pro) for QA.
# Requires WP-CLI on the remote host. Idempotent.
set -euo pipefail
: "${WP_SSH:?set WP_SSH=user@host:/path/to/wp e.g. deploy@staging:/srv/wp}"

run() { ssh "${WP_SSH%%:*}" "cd ${WP_SSH#*:} && wp $*"; }

ensure_user() {
  local login="$1" role="$2"
  if ! run user get "$login" --field=ID >/dev/null 2>&1; then
    run user create "$login" "$login@example.test" --role="$role" --user_pass="ChangeMe!123"
  else
    echo "  user $login exists"
  fi
}

ensure_user qa_free subscriber
ensure_user qa_pro  subscriber
run user meta update qa_pro inspect_page_license active
echo "[seed] staging ready: qa_free (5/5 quota will trip 402), qa_pro (unlimited)."