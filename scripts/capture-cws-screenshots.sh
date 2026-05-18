#!/usr/bin/env bash
# Capture the 5 Chrome Web Store screenshots for Inspect Page v2.7.0.
# See docs/SCREENSHOT-SHOTLIST-v2.7.md for the canonical shot definitions.
#
# What this script automates:
#   - Launches Chromium (via npx playwright) at a forced 1280x800 viewport,
#     DPR=1, English locale, clean profile.
#   - Loads the v2.7.0 unpacked extension from ./extension/dist.
#   - Navigates to each target URL in order and pauses for the operator
#     to set the in-page state described in the shotlist (open the panel,
#     toggle Pick Element, open the popup, etc).
#   - Takes a 1280x800 PNG and burns in the caption band per the shotlist.
#   - Writes store-assets/screen-{1..5}.png (overwrites).
#   - Runs the banned-wording grep from the shotlist as a final guard.
#
# What you still do by hand (the script prompts you):
#   - Sign in to the staging WP as Alice (owner of "Acme Design").
#   - Open / position the floating panel + popup as the shotlist says.
#   - For screen-5, paste the AI block into chat.openai.com composer.
#
# Requirements: node 20+, npx, imagemagick (for the caption band).
#   nix run nixpkgs#imagemagick -- -version   # if `magick` is missing
#
# Usage:
#   STAGING_WP=https://demo.inspect-page.app \
#     bash scripts/capture-cws-screenshots.sh

set -euo pipefail

: "${STAGING_WP:?Set STAGING_WP=https://demo.inspect-page.app (staging URL)}"
EXT_DIR="${EXT_DIR:-$(pwd)/extension/dist}"
OUT_DIR="${OUT_DIR:-$(pwd)/store-assets}"

if [ ! -d "$EXT_DIR" ]; then
  echo "FAIL · extension build not found at $EXT_DIR"
  echo "       cd extension && bun install && bun run build"
  exit 1
fi

command -v magick >/dev/null 2>&1 || {
  echo "FAIL · imagemagick 'magick' CLI not in PATH"
  echo "       try: nix run nixpkgs#imagemagick -- -version"
  exit 1
}

mkdir -p "$OUT_DIR"
RUNNER=$(mktemp -t cws-shoot.XXXXXX.mjs)
trap 'rm -f "$RUNNER"' EXIT

cat > "$RUNNER" <<'JS'
import { chromium } from 'playwright';
import readline from 'node:readline';

const EXT = process.env.EXT_DIR;
const OUT = process.env.OUT_DIR;
const WP  = process.env.STAGING_WP;

const SHOTS = [
  { n: 1, url: 'https://en.wikipedia.org/wiki/HTTP',
    cue: 'Open the Inspect Page floating panel (bottom-right). Mode=Full Page, Format=ZIP. Hover the Export button. Workspace pill = "Acme Design · Pro".',
    caption: 'Capture any page — HTML, CSS, JS, full-page screenshot' },
  { n: 2, url: 'https://stripe.com',
    cue: 'Activate Pick Element. Highlight the hero CTA card. Show the on-page picker chip (Select / Copy selector / Cancel). Panel mode=Pick Element, format=MD+files.',
    caption: 'Pick one element — and act on it without leaving the page' },
  { n: 3, url: 'https://news.ycombinator.com/',
    cue: 'Open the extension POPUP (click the toolbar icon). Expand Settings. Open the workspace <select> dropdown showing "Acme Design (owner)" + "Alice\'s Workspace (owner)". Plan badge=Pro.',
    caption: 'Switch workspaces. Shared Pro billing for the whole team.' },
  { n: 4, url: `${WP}/wp-admin/tools.php?page=inspect-page-workspaces`,
    cue: 'WP admin must already be logged in as Alice. Workspace switcher=Acme Design. Members: Alice/Bob/Carol. One pending invite for dave@demo.inspect-page.app.',
    caption: 'Invite teammates. Owner / Admin / Member roles, email invites.' },
  { n: 5, url: 'https://chat.openai.com/',
    cue: 'Paste the Smart Share AI block into the composer (do not send). The 4 URLs must reference demo.inspect-page.app/share/A1b2C3/...',
    caption: 'Paste once. Your LLM gets the page exactly as you saw it.' },
];

const ask = (q) => new Promise((res) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(q, (a) => { rl.close(); res(a); });
});

const ctx = await chromium.launchPersistentContext('/tmp/cws-profile', {
  headless: false,
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  locale: 'en-US',
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--window-size=1300,900',
  ],
});

console.log(`\nSign in to ${WP}/wp-admin as Alice (owner of "Acme Design") in the opened window.`);
await ask('Press <enter> once signed in to begin shot 1... ');

for (const s of SHOTS) {
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  console.log(`\n── Shot ${s.n}: ${s.url}`);
  await page.goto(s.url, { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log(`   CUE: ${s.cue}`);
  await ask(`   Position the UI exactly per the shotlist. Press <enter> to capture shot ${s.n}... `);
  const raw = `${OUT}/.shot-${s.n}.raw.png`;
  await page.screenshot({ path: raw, clip: { x: 0, y: 0, width: 1280, height: 800 } });
  console.log(`   captured raw → ${raw}`);
}

await ctx.close();
console.log('\nAll raw captures done. Burning captions next (magick).');
JS

EXT_DIR="$EXT_DIR" OUT_DIR="$OUT_DIR" STAGING_WP="$STAGING_WP" \
  npx --yes playwright@1.47.0 install chromium >/dev/null 2>&1 || true
EXT_DIR="$EXT_DIR" OUT_DIR="$OUT_DIR" STAGING_WP="$STAGING_WP" \
  node "$RUNNER"

# Caption overlays per shotlist: 48px Inter SemiBold, white on 60% black,
# 80px tall bottom band, full width.
declare -A CAPTIONS=(
  [1]="Capture any page — HTML, CSS, JS, full-page screenshot"
  [2]="Pick one element — and act on it without leaving the page"
  [3]="Switch workspaces. Shared Pro billing for the whole team."
  [4]="Invite teammates. Owner / Admin / Member roles, email invites."
  [5]="Paste once. Your LLM gets the page exactly as you saw it."
)

for n in 1 2 3 4 5; do
  raw="$OUT_DIR/.shot-$n.raw.png"
  out="$OUT_DIR/screen-$n.png"
  if [ ! -f "$raw" ]; then
    echo "SKIP · shot $n raw missing ($raw) — re-run the capture step"
    continue
  fi
  magick "$raw" \
    \( -size 1280x80 xc:"rgba(0,0,0,0.6)" \) -gravity south -composite \
    -gravity south -fill white -font "Inter-SemiBold" -pointsize 28 \
    -annotate +0+24 "${CAPTIONS[$n]}" \
    -strip -define png:color-type=2 -resize 1280x800\! "$out"
  rm -f "$raw"
  echo "wrote $out"
done

echo
echo "==> Verify dimensions"
magick identify "$OUT_DIR"/screen-*.png

echo
echo "==> Banned-wording guard"
if rg -l -i "pairing|application password|PPT1|bearer|sk_live_|pageport|llm export" "$OUT_DIR"/ 2>/dev/null; then
  echo "FAIL · banned wording found above — reshoot those frames"
  exit 1
fi
echo "clean."
echo
echo "Done. 5 screenshots ready in $OUT_DIR/. Upload via Chrome Web Store dev console (step 8 of docs/LIVE-MODE-RUNBOOK-v2.7.0.md)."