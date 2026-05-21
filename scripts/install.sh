#!/usr/bin/env bash
# Inspect Page — Chrome extension installer (Bash).
#
# Behavior:
#   - When downloaded from a release asset URL
#     (https://github.com/{repo}/releases/download/ext-vX.Y.Z/install.sh),
#     the script auto-pins to that version via its own download URL.
#   - When piped from raw.githubusercontent.com/.../main/scripts/install.sh
#     (or any non-release source), it resolves the latest ext-v* release
#     via the GitHub API.
#
# Usage:
#   curl -fsSL https://github.com/alimtvnetwork/inspect-page/releases/download/ext-v2.7.7/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/alimtvnetwork/inspect-page/main/scripts/install.sh | bash
#
# Env overrides:
#   IP_REPO=owner/repo   (default: alimtvnetwork/inspect-page)
#   IP_VERSION=ext-v2.7.7  (force a specific tag)
#   IP_DEST=/path        (default: ~/inspect-page)
set -euo pipefail

REPO="${IP_REPO:-}"
DEST="${IP_DEST:-$HOME/inspect-page}"
VERSION="${IP_VERSION:-}"

log() { printf '\033[1;36m[inspect-page]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[inspect-page]\033[0m %s\n' "$*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "missing required tool: $1"; }
need curl
need unzip

# 1. Self-URL inspection (works when piped via curl): the parent shell's
#    command line contains the source URL. Parse REPO and VERSION from it.
PARENT_CMD="$(ps -o args= -p $PPID 2>/dev/null || true)"
if [[ "$PARENT_CMD" =~ github\.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/releases/download/(ext-v[0-9A-Za-z.+-]+)/install\.sh ]]; then
  [ -z "$REPO" ]    && REPO="${BASH_REMATCH[1]}"
  [ -z "$VERSION" ] && VERSION="${BASH_REMATCH[2]}"
  log "URL-pinned: repo=$REPO version=$VERSION"
elif [[ "$PARENT_CMD" =~ raw\.githubusercontent\.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/[^/]+/scripts/install\.sh ]]; then
  [ -z "$REPO" ] && REPO="${BASH_REMATCH[1]}"
  log "Latest channel: repo=$REPO"
fi

[ -n "$REPO" ] || die "Cannot determine repository. Set IP_REPO=owner/repo (e.g. IP_REPO=foo/inspect-page)."

if [ -z "$VERSION" ]; then
  log "Resolving latest ext-v* release from GitHub API…"
  API="https://api.github.com/repos/${REPO}/releases"
  VERSION="$(curl -fsSL "$API" \
    | grep -oE '"tag_name": *"ext-v[^"]+"' \
    | head -1 \
    | sed 's/.*"ext-v/ext-v/; s/"$//')"
  [ -n "$VERSION" ] || die "could not resolve latest ext-v* release"
  log "Latest version: $VERSION"
fi

SEMVER="${VERSION#ext-v}"
ZIP="inspect-page-v${SEMVER}.zip"
URL="https://github.com/${REPO}/releases/download/${VERSION}/${ZIP}"
SUMS_URL="https://github.com/${REPO}/releases/download/${VERSION}/checksums.txt"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

log "Downloading $ZIP…"
curl -fsSL "$URL" -o "$TMP/$ZIP"

log "Verifying SHA256…"
if curl -fsSL "$SUMS_URL" -o "$TMP/checksums.txt" 2>/dev/null; then
  EXPECTED="$(grep " $ZIP$" "$TMP/checksums.txt" | awk '{print $1}')"
  ACTUAL="$(sha256sum "$TMP/$ZIP" | awk '{print $1}')"
  if [ -n "$EXPECTED" ] && [ "$EXPECTED" != "$ACTUAL" ]; then
    die "checksum mismatch: expected $EXPECTED, got $ACTUAL"
  fi
  log "SHA256 OK ($ACTUAL)"
else
  log "checksums.txt not available — skipping verification"
fi

DEST_VER="${DEST}-${SEMVER}"
rm -rf "$DEST_VER"
mkdir -p "$DEST_VER"
unzip -q "$TMP/$ZIP" -d "$DEST_VER"

# Refresh the unversioned symlink so chrome://extensions keeps the same folder path
ln -sfn "$DEST_VER" "$DEST"

cat <<EOF

✅ Inspect Page ${VERSION} installed.

Extracted to:    ${DEST_VER}
Stable symlink:  ${DEST}  →  ${DEST_VER}

Next steps:
  1. Open  chrome://extensions  (works in Chrome, Edge, Brave, Arc, Opera)
  2. Toggle  Developer mode  (top-right)
  3. Click  Load unpacked  and select:  ${DEST}

To upgrade later, re-run this script — the symlink is updated in place
so you do not need to remove the extension from Chrome.
EOF