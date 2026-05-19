# Plan — Restore "Export Full Page works on any http(s):// site"

Goal: match original brief. No host blocklists. No "open preview tab" requirement.
Active tab is http/https → export the 4 artifacts (HTML + merged CSS + merged JS + full-page screenshot). Period.

## Phase 1 — Strip host gatekeeping from background.ts
- Remove `resolveFullPageExportTarget` host-allowlist / `unsupportedHost` branch.
- Remove `findLovablePreviewTab`, `waitForPreviewTabReady`, preview-tab auto-open logic.
- Remove `E_NOT_AVAILABLE_HERE` emission for lovable.dev / chatgpt.com / leetcode.com / any normal http(s).
- Keep ONLY hard blocks browsers physically forbid: `chrome://`, `chrome-extension://`, `edge://`, `about:`, `view-source:`, `file://`, `devtools://`. For those show a clear "Chrome forbids scripting this URL" message.
- Active tab is the target. Always.

## Phase 2 — Keep capture-readiness retry (genuinely needed)
- Leave `ensureTabReadyForVisibleCapture` (focus + `status==="complete"` poll) in `screenshotOrchestrator.ts`.
- Leave `CAPTURE_RETRY_MAX = 3`.
- No other changes here.

## Phase 3 — Rebuild + repackage
- `cd extension && bun run build`
- `bash extension/scripts/package.sh` → refreshes `public/inspect-page.zip` + `.sha256`.
- Confirm SHA changed.

## Phase 4 — Verify
- Run `bun run test` in `extension/` (must stay green, target 194/194).
- Manual test checklist (user does this after reload):
  1. lovable.dev editor → Export Full Page → 4 artifacts download
  2. chatgpt.com/c/... → Export Full Page → 4 artifacts download
  3. leetcode.com/problems/... → Export Full Page → 4 artifacts download
  4. chrome://extensions → clear "Chrome forbids scripting this URL" error (expected)

## Phase 5 — Update memory + release notes
- Update `mem://features/full-page-export-error-rca` to reflect rollback of host gating.
- Bump extension to v2.7.3, add `docs/RELEASE-NOTES-v2.7.3.md` (one-liner: "Export Full Page works on every http(s):// site again").

---

Say **next** to execute Phase 1.
